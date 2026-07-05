const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

// Salesforce uses OAuth2 connected apps.
// instance_url is returned during OAuth and stored in oauth_tokens.metadata.

class SalesforceProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "salesforce"; }

  async _getTokens() {
    const admin = requireAdmin();
    const { data } = await admin
      .from("oauth_tokens")
      .select("*")
      .eq("org_id", this.orgId)
      .eq("provider_key", "salesforce")
      .maybeSingle();
    if (!data) throw new Error("Salesforce not authorized — connect via OAuth first");
    return data;
  }

  async _refreshIfExpired(tokenRow) {
    if (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date()) {
      return tokenRow.access_token;
    }
    return this._refreshToken(tokenRow);
  }

  async _refreshToken(tokenRow) {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !tokenRow.refresh_token) {
      throw new Error("Cannot refresh Salesforce token — missing credentials");
    }

    const instanceUrl = tokenRow.metadata?.instance_url || "https://login.salesforce.com";
    const res = await fetch(`${instanceUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (!res.ok) throw new Error("Failed to refresh Salesforce token");
    const data = await res.json();

    const newExpiry = new Date(Date.now() + 7200 * 1000).toISOString();
    const admin = requireAdmin();
    await admin.from("oauth_tokens").update({
      access_token: data.access_token,
      expires_at: newExpiry,
      metadata: { ...tokenRow.metadata, instance_url: data.instance_url || instanceUrl },
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    return data.access_token;
  }

  async testConnection() {
    try {
      const tokenRow = await this._getTokens();
      const accessToken = await this._refreshIfExpired(tokenRow);
      const instanceUrl = tokenRow.metadata?.instance_url;
      if (!instanceUrl) return { ok: false, reason: "missing_instance_url" };

      const res = await fetch(`${instanceUrl}/services/data/v60.0/limits/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, reason: `salesforce_api_${res.status}` };
      return { ok: true, instance_url: instanceUrl };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ offset = 0, limit = 200 } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const instanceUrl = tokenRow.metadata?.instance_url;

    const query = `SELECT Id,FirstName,LastName,Email,Phone,MobilePhone FROM Contact LIMIT ${limit} OFFSET ${offset}`;
    const res = await fetch(
      `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Salesforce query failed: ${res.status}`);

    const { records, totalSize, done } = await res.json();
    if (!records || records.length === 0) return { synced: 0, next_offset: null };

    const admin = requireAdmin();
    const contacts = records
      .map((r) => {
        const phone = r.Phone || r.MobilePhone;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [r.FirstName, r.LastName].filter(Boolean).join(" ") || null,
          email: r.Email || null,
          crm_ref: `salesforce_${r.Id}`,
          source: "salesforce",
          fields: { salesforce_id: r.Id },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "Salesforce contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    return {
      synced: contacts.length,
      total_fetched: records.length,
      next_offset: !done ? offset + limit : null,
    };
  }

  async query(soql) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const instanceUrl = tokenRow.metadata?.instance_url;

    const res = await fetch(
      `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Salesforce query failed: ${res.status}`);
    return res.json();
  }

  async createTask({ whoId, subject, description, activityDate, callDuration } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const instanceUrl = tokenRow.metadata?.instance_url;

    const body = {
      Subject: subject || "Call",
      Description: description || "",
      Status: "Completed",
      ActivityDate: activityDate || new Date().toISOString().split("T")[0],
    };
    if (whoId) body.WhoId = whoId;
    if (callDuration) body.CallDurationInSeconds = callDuration;

    const res = await fetch(`${instanceUrl}/services/data/v60.0/sobjects/Task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Salesforce create task failed: ${res.status} ${errBody}`);
    }
    return res.json();
  }

  async searchContacts(query) {
    const sosl = `FIND {${query}} IN NAME FIELDS RETURNING Contact(Id,FirstName,LastName,Email,Phone)`;
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const instanceUrl = tokenRow.metadata?.instance_url;

    const res = await fetch(
      `${instanceUrl}/services/data/v60.0/search?q=${encodeURIComponent(sosl)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Salesforce search failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    logger.info({ type: payload?.event_type, org_id: this.orgId }, "Salesforce webhook received");
    return { received: true, event: payload?.event_type };
  }
}

module.exports = SalesforceProvider;
