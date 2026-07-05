const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

class PipedriveProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "pipedrive"; }

  get baseUrl() {
    const domain = this.config.domain || "api";
    return `https://${domain}.pipedrive.com/api/v1`;
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.config.api_token}`,
      "Content-Type": "application/json",
    };
  }

  async testConnection() {
    if (!this.config.api_token) return { ok: false, reason: "missing_token" };
    try {
      const res = await fetch(`${this.baseUrl}/users/me`, { headers: this.headers });
      if (!res.ok) return { ok: false, reason: `pipedrive_api_${res.status}` };
      const { data } = await res.json();
      return { ok: true, user_name: data?.name, company_name: data?.company_name };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ limit = 100, start = 0 } = {}) {
    const res = await fetch(
      `${this.baseUrl}/persons?limit=${limit}&start=${start}&fields=name,email,phone`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Pipedrive persons fetch failed: ${res.status}`);

    const { data: persons, additional_data } = await res.json();
    if (!persons || persons.length === 0) return { synced: 0, next_start: null };

    const admin = requireAdmin();
    const contacts = persons
      .flatMap((p) => {
        const phoneEntries = Array.isArray(p.phone) ? p.phone : [];
        const primary = phoneEntries.find((ph) => ph.primary) || phoneEntries[0];
        if (!primary?.value) return [];
        const e164 = primary.value.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return [];
        const email = Array.isArray(p.email)
          ? (p.email.find((em) => em.primary) || p.email[0])?.value || null
          : null;
        return [{
          org_id: this.orgId,
          e164,
          name: p.name || null,
          email,
          crm_ref: `pipedrive_${p.id}`,
          source: "pipedrive",
          fields: { pipedrive_id: p.id, owner_id: p.owner_id?.id },
        }];
      });

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "Pipedrive contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    const nextStart = additional_data?.pagination?.next_start || null;
    return { synced: contacts.length, total_fetched: persons.length, next_start: nextStart };
  }

  async getPerson(personId) {
    const res = await fetch(`${this.baseUrl}/persons/${personId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Pipedrive get person failed: ${res.status}`);
    return res.json();
  }

  async searchPersons(term) {
    const res = await fetch(
      `${this.baseUrl}/persons/search?term=${encodeURIComponent(term)}&fields=name,email,phone`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Pipedrive search persons failed: ${res.status}`);
    return res.json();
  }

  async createNote({ personId, dealId, content } = {}) {
    const body = { content };
    if (personId) body.person_id = personId;
    if (dealId) body.deal_id = dealId;

    const res = await fetch(`${this.baseUrl}/notes`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Pipedrive create note failed: ${res.status}`);
    return res.json();
  }

  async getDeals({ limit = 10, start = 0, status = "open" } = {}) {
    const res = await fetch(
      `${this.baseUrl}/deals?limit=${limit}&start=${start}&status=${status}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Pipedrive get deals failed: ${res.status}`);
    return res.json();
  }

  async addActivity({ dealId, personId, subject, type = "call", dueDate, dueTime } = {}) {
    const body = { subject, type };
    if (dealId) body.deal_id = dealId;
    if (personId) body.person_id = personId;
    if (dueDate) body.due_date = dueDate;
    if (dueTime) body.due_time = dueTime;

    const res = await fetch(`${this.baseUrl}/activities`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Pipedrive add activity failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    const { event, meta, current } = payload || {};
    logger.info({ event, meta, org_id: this.orgId }, "Pipedrive webhook received");

    if (event === "updated.person" || event === "added.person") {
      try {
        const phone = Array.isArray(current?.phone)
          ? (current.phone.find((p) => p.primary) || current.phone[0])?.value
          : null;
        if (phone) {
          const e164 = phone.replace(/[^\d+]/g, "");
          if (e164.length >= 7) {
            const admin = requireAdmin();
            const email = Array.isArray(current.email)
              ? (current.email.find((em) => em.primary) || current.email[0])?.value || null
              : null;
            await admin.from("contacts").upsert(
              {
                org_id: this.orgId,
                e164,
                name: current.name || null,
                email,
                crm_ref: `pipedrive_${current.id}`,
                source: "pipedrive",
                fields: { pipedrive_id: current.id },
              },
              { onConflict: "org_id,e164" }
            );
          }
        }
      } catch (err) {
        logger.error({ err: err.message }, "Pipedrive webhook contact sync failed");
      }
    }

    return { received: true, event };
  }
}

module.exports = PipedriveProvider;
