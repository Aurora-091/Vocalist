const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

// DrChrono uses OAuth2. Token refresh uses the standard OAuth2 refresh flow.
const DRCHRONO_BASE_URL = "https://drchrono.com/api";

class DrChronoProvider extends IntegrationProvider {
  static get type() { return "ehr"; }

  async _getTokens() {
    const admin = requireAdmin();
    const { data } = await admin
      .from("oauth_tokens")
      .select("*")
      .eq("org_id", this.orgId)
      .eq("provider_key", "drchrono")
      .maybeSingle();
    if (!data) throw new Error("DrChrono not authorized — connect via OAuth first");
    return data;
  }

  async _refreshIfExpired(tokenRow) {
    if (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date()) {
      return tokenRow.access_token;
    }
    return this._refreshToken(tokenRow);
  }

  async _refreshToken(tokenRow) {
    const clientId = process.env.DRCHRONO_CLIENT_ID;
    const clientSecret = process.env.DRCHRONO_CLIENT_SECRET;

    if (!clientId || !clientSecret || !tokenRow.refresh_token) {
      throw new Error("Cannot refresh DrChrono token — missing credentials");
    }

    const res = await fetch("https://drchrono.com/o/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (!res.ok) throw new Error("Failed to refresh DrChrono token");
    const data = await res.json();

    const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    const admin = requireAdmin();
    await admin.from("oauth_tokens").update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokenRow.refresh_token,
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    return data.access_token;
  }

  async testConnection() {
    try {
      const tokenRow = await this._getTokens();
      const accessToken = await this._refreshIfExpired(tokenRow);
      const res = await fetch(`${DRCHRONO_BASE_URL}/users/current`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, reason: `drchrono_api_${res.status}` };
      const data = await res.json();
      return { ok: true, username: data.username, doctor: data.doctor };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ page = 1, pageSize = 100 } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);

    const headers = { Authorization: `Bearer ${accessToken}` };
    const params = new URLSearchParams({ page_size: String(pageSize) });
    if (page > 1) params.set("cursor", String((page - 1) * pageSize));

    const res = await fetch(`${DRCHRONO_BASE_URL}/patients?${params}`, { headers });
    if (!res.ok) throw new Error(`DrChrono patients fetch failed: ${res.status}`);

    const { results, next } = await res.json();
    if (!results || results.length === 0) return { synced: 0, next_page: null };

    const admin = requireAdmin();
    const contacts = results
      .map((p) => {
        const phone = p.cell_phone || p.home_phone || p.office_phone;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
          email: p.email || null,
          crm_ref: `drchrono_${p.id}`,
          source: "drchrono",
          fields: {
            drchrono_id: p.id,
            dob: p.date_of_birth,
            doctor_id: p.doctor,
          },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "DrChrono contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    return { synced: contacts.length, total_fetched: results.length, next_page: next ? page + 1 : null };
  }

  async getPatient(patientId) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);

    const res = await fetch(`${DRCHRONO_BASE_URL}/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`DrChrono get patient failed: ${res.status}`);
    return res.json();
  }

  async listAppointments({ since, until, patientId, limit = 50 } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);

    const params = new URLSearchParams({ page_size: String(limit) });
    if (since) params.set("date_range", since);
    if (patientId) params.set("patient", String(patientId));

    const res = await fetch(`${DRCHRONO_BASE_URL}/appointments?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`DrChrono list appointments failed: ${res.status}`);
    return res.json();
  }

  async getDocuments({ patientId } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);

    const params = new URLSearchParams({ patient: String(patientId) });
    const res = await fetch(`${DRCHRONO_BASE_URL}/documents?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`DrChrono get documents failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    const { event, data } = payload || {};
    logger.info({ event, org_id: this.orgId }, "DrChrono webhook received");

    if ((event === "PATIENT_CREATE" || event === "PATIENT_UPDATE") && data) {
      try {
        const phone = data.cell_phone || data.home_phone || data.office_phone;
        if (phone) {
          const e164 = phone.replace(/[^\d+]/g, "");
          if (e164.length >= 7) {
            const admin = requireAdmin();
            await admin.from("contacts").upsert(
              {
                org_id: this.orgId,
                e164,
                name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
                email: data.email || null,
                crm_ref: `drchrono_${data.id}`,
                source: "drchrono",
                fields: { drchrono_id: data.id },
              },
              { onConflict: "org_id,e164" }
            );
          }
        }
      } catch (err) {
        logger.error({ err: err.message }, "DrChrono webhook contact sync failed");
      }
    }

    return { received: true, event };
  }
}

module.exports = DrChronoProvider;
