const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

const BASE_URL = "https://api.hubapi.com";

class HubspotProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "hubspot"; }

  get headers() {
    return {
      Authorization: `Bearer ${this.config.access_token}`,
      "Content-Type": "application/json",
    };
  }

  async testConnection() {
    if (!this.config.access_token) return { ok: false, reason: "missing_token" };
    try {
      const res = await fetch(
        `${BASE_URL}/oauth/v1/access-tokens/${this.config.access_token}`,
        { headers: { Authorization: `Bearer ${this.config.access_token}` } }
      );
      if (!res.ok) return { ok: false, reason: `hubspot_api_${res.status}` };
      const data = await res.json();
      return { ok: true, hub_id: data.hub_id, hub_domain: data.hub_domain, user: data.user };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ limit = 100, after } = {}) {
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 100)),
      properties: "firstname,lastname,email,phone,mobilephone,hs_lead_status",
    });
    if (after) params.set("after", after);

    const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts?${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(`HubSpot contacts fetch failed: ${res.status}`);

    const { results, paging } = await res.json();
    if (!results || results.length === 0) return { synced: 0, next_cursor: null };

    const admin = requireAdmin();
    const contacts = results
      .map((c) => {
        const phone = c.properties?.phone || c.properties?.mobilephone;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(" ") || null,
          email: c.properties?.email || null,
          crm_ref: `hubspot_${c.id}`,
          source: "hubspot",
          fields: { hubspot_id: c.id, lead_status: c.properties?.hs_lead_status },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "HubSpot contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    return {
      synced: contacts.length,
      total_fetched: results.length,
      next_cursor: paging?.next?.after || null,
    };
  }

  async getContact(contactId) {
    const res = await fetch(
      `${BASE_URL}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,mobilephone,company,hs_lead_status,lifecyclestage`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`HubSpot get contact failed: ${res.status}`);
    return res.json();
  }

  async searchContacts({ email, phone, query } = {}) {
    const filters = [];
    if (email) filters.push({ propertyName: "email", operator: "EQ", value: email });
    if (phone) filters.push({ propertyName: "phone", operator: "EQ", value: phone });
    if (query && !email && !phone) {
      filters.push({ propertyName: "email", operator: "CONTAINS_TOKEN", value: query });
    }

    const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties: ["firstname", "lastname", "email", "phone", "company", "hs_lead_status"],
        limit: 10,
      }),
    });
    if (!res.ok) throw new Error(`HubSpot search contacts failed: ${res.status}`);
    return res.json();
  }

  async createNote({ contactId, dealId, body, callDuration } = {}) {
    const props = {
      hs_note_body: body,
      hs_timestamp: new Date().toISOString(),
    };
    if (callDuration) props.hs_call_duration = String(callDuration);

    const noteRes = await fetch(`${BASE_URL}/crm/v3/objects/notes`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ properties: props }),
    });
    if (!noteRes.ok) throw new Error(`HubSpot create note failed: ${noteRes.status}`);
    const note = await noteRes.json();

    const assocPromises = [];
    if (contactId) {
      assocPromises.push(
        fetch(`${BASE_URL}/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/202`, {
          method: "PUT",
          headers: this.headers,
        })
      );
    }
    if (dealId) {
      assocPromises.push(
        fetch(`${BASE_URL}/crm/v3/objects/notes/${note.id}/associations/deals/${dealId}/214`, {
          method: "PUT",
          headers: this.headers,
        })
      );
    }
    await Promise.allSettled(assocPromises);
    return note;
  }

  async createContact({ firstName, lastName, email, phone, company } = {}) {
    const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        properties: {
          firstname: firstName || "",
          lastname: lastName || "",
          email: email || "",
          phone: phone || "",
          company: company || "",
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HubSpot create contact failed: ${res.status} ${errBody}`);
    }
    return res.json();
  }

  async updateContact(contactId, properties = {}) {
    const res = await fetch(`${BASE_URL}/crm/v3/objects/contacts/${contactId}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) throw new Error(`HubSpot update contact failed: ${res.status}`);
    return res.json();
  }

  async getDeals({ limit = 10, after } = {}) {
    const params = new URLSearchParams({
      limit: String(limit),
      properties: "dealname,amount,dealstage,pipeline,closedate",
    });
    if (after) params.set("after", after);
    const res = await fetch(`${BASE_URL}/crm/v3/objects/deals?${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(`HubSpot get deals failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    const events = Array.isArray(payload) ? payload : [payload];
    const handled = [];

    for (const event of events) {
      const { subscriptionType, objectId, propertyName, propertyValue } = event;
      handled.push({ subscriptionType, objectId, propertyName, propertyValue });

      if (subscriptionType === "contact.propertyChange" && propertyName === "phone") {
        try {
          const admin = requireAdmin();
          const contact = await this.getContact(objectId);
          const phone = contact.properties?.phone;
          if (phone) {
            const e164 = phone.replace(/[^\d+]/g, "");
            if (e164.length >= 7) {
              await admin.from("contacts").upsert(
                {
                  org_id: this.orgId,
                  e164,
                  name: [contact.properties?.firstname, contact.properties?.lastname]
                    .filter(Boolean)
                    .join(" ") || null,
                  email: contact.properties?.email || null,
                  crm_ref: `hubspot_${objectId}`,
                  source: "hubspot",
                  fields: { hubspot_id: String(objectId) },
                },
                { onConflict: "org_id,e164" }
              );
            }
          }
        } catch (err) {
          logger.error({ err: err.message, objectId }, "HubSpot webhook contact sync failed");
        }
      }
    }

    return { received: true, handled: handled.length };
  }
}

module.exports = HubspotProvider;
