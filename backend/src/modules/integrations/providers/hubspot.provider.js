const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

class HubspotProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "hubspot"; }

  async testConnection() {
    const config = await this.getResolvedConfig();
    const token = config.access_token || config.api_key;
    if (!token) {
      return { ok: false, reason: "missing_credentials" };
    }
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        return { ok: false, reason: `hubspot_api_${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ limit = 100 } = {}) {
    const config = await this.getResolvedConfig();
    const token = config.access_token || config.api_key;
    if (!token) {
      throw new Error("HubSpot credentials unavailable");
    }
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,phone`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`HubSpot CRM contacts fetch failed: ${res.status}`);
    }
    const { results } = await res.json();
    if (!results || results.length === 0) {
      return { synced: 0, note: "No contacts found" };
    }

    const admin = requireAdmin();
    const contacts = results
      .filter((c) => c.properties?.phone)
      .map((c) => {
        const phone = c.properties.phone.replace(/[^\d+]/g, "");
        const firstName = c.properties.firstname || "";
        const lastName = c.properties.lastname || "";
        const email = c.properties.email || null;
        return {
          org_id: this.orgId,
          e164: phone.startsWith("+") ? phone : `+${phone}`,
          name: [firstName, lastName].filter(Boolean).join(" ") || null,
          email,
          crm_ref: `hubspot_${c.id}`,
          source: "crm",
          consent_status: "none",
          fields: { hubspot_id: c.id },
        };
      });

    if (contacts.length === 0) {
      return { synced: 0, note: "No HubSpot contacts with phone numbers" };
    }

    const { error } = await admin
      .from("contacts")
      .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });

    if (error) {
      logger.error({ err: error }, "HubSpot contact sync upsert failed");
      throw new Error(`Contact sync failed: ${error.message}`);
    }

    return { synced: contacts.length };
  }

  async webhook(payload) {
    return { received: true, subscription: payload?.subscriptionType };
  }
}

module.exports = HubspotProvider;
