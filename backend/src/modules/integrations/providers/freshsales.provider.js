const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

class FreshsalesProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "freshsales"; }

  get baseUrl() {
    if (!this.config.domain) throw new Error("Freshsales domain not configured");
    return `https://${this.config.domain}.freshsales.io/api`;
  }

  get headers() {
    return {
      Authorization: `Token token=${this.config.api_key}`,
      "Content-Type": "application/json",
    };
  }

  async testConnection() {
    if (!this.config.api_key || !this.config.domain) {
      return { ok: false, reason: "missing_credentials" };
    }
    try {
      const res = await fetch(`${this.baseUrl}/contacts?per_page=1`, { headers: this.headers });
      if (!res.ok) return { ok: false, reason: `freshsales_api_${res.status}` };
      return { ok: true, domain: this.config.domain };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ page = 1, per_page = 100 } = {}) {
    const res = await fetch(
      `${this.baseUrl}/contacts?page=${page}&per_page=${per_page}&include=phone_numbers`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Freshsales contacts fetch failed: ${res.status}`);

    const body = await res.json();
    const contacts_data = body.contacts || body.data || [];

    if (contacts_data.length === 0) return { synced: 0, next_page: null };

    const admin = requireAdmin();
    const contacts = contacts_data
      .map((c) => {
        const phone = c.work_number || c.mobile_number || c.phone;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.display_name || null,
          email: c.email || null,
          crm_ref: `freshsales_${c.id}`,
          source: "freshsales",
          fields: { freshsales_id: c.id, lead_stage: c.lead_stage?.name },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "Freshsales contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    const hasMore = contacts_data.length === per_page;
    return { synced: contacts.length, total_fetched: contacts_data.length, next_page: hasMore ? page + 1 : null };
  }

  async getContact(contactId) {
    const res = await fetch(`${this.baseUrl}/contacts/${contactId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Freshsales get contact failed: ${res.status}`);
    return res.json();
  }

  async searchContacts(query) {
    const res = await fetch(
      `${this.baseUrl}/lookup?q=${encodeURIComponent(query)}&f=email,work_number,mobile_number&entities=contact`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Freshsales search contacts failed: ${res.status}`);
    return res.json();
  }

  async createNote({ contactId, dealId, description } = {}) {
    const body = { note: { description } };
    if (contactId) body.note.notable_id = contactId, body.note.notable_type = "Contact";
    if (!contactId && dealId) body.note.notable_id = dealId, body.note.notable_type = "Deal";

    const res = await fetch(`${this.baseUrl}/notes`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Freshsales create note failed: ${res.status}`);
    return res.json();
  }

  async getDeals({ page = 1, per_page = 20 } = {}) {
    const res = await fetch(
      `${this.baseUrl}/deals?page=${page}&per_page=${per_page}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Freshsales get deals failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    logger.info({ type: payload?.event, org_id: this.orgId }, "Freshsales webhook received");
    return { received: true, event: payload?.event };
  }
}

module.exports = FreshsalesProvider;
