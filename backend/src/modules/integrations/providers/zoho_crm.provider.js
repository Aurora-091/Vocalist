const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

// Zoho CRM uses OAuth2. Access tokens are stored in oauth_tokens table.
// This provider reads tokens from the DB and refreshes them when expired.

class ZohoCrmProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "zoho_crm"; }

  async _getTokens() {
    const admin = requireAdmin();
    const { data } = await admin
      .from("oauth_tokens")
      .select("*")
      .eq("org_id", this.orgId)
      .eq("provider_key", "zoho_crm")
      .maybeSingle();
    if (!data) throw new Error("Zoho CRM not authorized — connect via OAuth first");
    return data;
  }

  async _refreshIfExpired(tokenRow) {
    if (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date()) {
      return tokenRow.access_token;
    }
    return this._refreshToken(tokenRow);
  }

  async _refreshToken(tokenRow) {
    const clientId = this.config.client_id || process.env.ZOHO_CLIENT_ID;
    const clientSecret = this.config.client_secret || process.env.ZOHO_CLIENT_SECRET;

    if (!clientId || !clientSecret || !tokenRow.refresh_token) {
      throw new Error("Cannot refresh Zoho token — missing credentials");
    }

    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (!res.ok) throw new Error("Failed to refresh Zoho token");
    const data = await res.json();

    const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    const admin = requireAdmin();
    await admin.from("oauth_tokens").update({
      access_token: data.access_token,
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    return data.access_token;
  }

  async _getBaseUrl(tokenRow) {
    // Zoho API domain is returned during auth or can be derived from token metadata
    const apiDomain = tokenRow.metadata?.api_domain || "https://www.zohoapis.com";
    return `${apiDomain}/crm/v7`;
  }

  async testConnection() {
    try {
      const tokenRow = await this._getTokens();
      const accessToken = await this._refreshIfExpired(tokenRow);
      const baseUrl = await this._getBaseUrl(tokenRow);
      const res = await fetch(`${baseUrl}/org`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (!res.ok) return { ok: false, reason: `zoho_api_${res.status}` };
      const { org } = await res.json();
      return { ok: true, org_name: org?.[0]?.company_name };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ page = 1, per_page = 200 } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const baseUrl = await this._getBaseUrl(tokenRow);

    const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
    const res = await fetch(
      `${baseUrl}/Contacts?page=${page}&per_page=${per_page}&fields=First_Name,Last_Name,Email,Phone,Mobile`,
      { headers }
    );
    if (!res.ok) throw new Error(`Zoho CRM contacts fetch failed: ${res.status}`);

    const { data: records, info } = await res.json();
    if (!records || records.length === 0) return { synced: 0, next_page: null };

    const admin = requireAdmin();
    const contacts = records
      .map((r) => {
        const phone = r.Phone || r.Mobile;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [r.First_Name, r.Last_Name].filter(Boolean).join(" ") || null,
          email: r.Email || null,
          crm_ref: `zoho_crm_${r.id}`,
          source: "zoho_crm",
          fields: { zoho_id: r.id },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "Zoho CRM contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    return {
      synced: contacts.length,
      total_fetched: records.length,
      next_page: info?.more_records ? page + 1 : null,
    };
  }

  async searchContacts(query) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const baseUrl = await this._getBaseUrl(tokenRow);

    const res = await fetch(
      `${baseUrl}/Contacts/search?word=${encodeURIComponent(query)}&fields=First_Name,Last_Name,Email,Phone`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Zoho CRM search contacts failed: ${res.status}`);
    return res.json();
  }

  async createNote({ contactId, accountId, note } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const baseUrl = await this._getBaseUrl(tokenRow);

    const body = {
      data: [{
        Note_Content: note,
        Note_Title: "Call Note",
        Parent_Id: contactId || accountId,
        se_module: contactId ? "Contacts" : "Accounts",
      }],
    };

    const res = await fetch(`${baseUrl}/Notes`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Zoho CRM create note failed: ${res.status}`);
    return res.json();
  }

  async getLeads({ page = 1, per_page = 50 } = {}) {
    const tokenRow = await this._getTokens();
    const accessToken = await this._refreshIfExpired(tokenRow);
    const baseUrl = await this._getBaseUrl(tokenRow);

    const res = await fetch(
      `${baseUrl}/Leads?page=${page}&per_page=${per_page}&fields=First_Name,Last_Name,Email,Phone,Lead_Status`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Zoho CRM get leads failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    logger.info({ module: payload?.module, org_id: this.orgId }, "Zoho CRM webhook received");
    return { received: true, module: payload?.module };
  }
}

module.exports = ZohoCrmProvider;
