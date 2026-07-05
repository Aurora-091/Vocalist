const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

// Cliniko has regional API endpoints; default to AU1
const REGION_URLS = {
  au1: "https://api.au1.cliniko.com/v1",
  ca1: "https://api.ca1.cliniko.com/v1",
  uk1: "https://api.uk1.cliniko.com/v1",
  us1: "https://api.us1.cliniko.com/v1",
};

class ClinikoProvider extends IntegrationProvider {
  static get type() { return "ehr"; }

  get baseUrl() {
    const region = this.config.region || "au1";
    return REGION_URLS[region] || REGION_URLS.au1;
  }

  get headers() {
    return {
      Authorization: `Basic ${Buffer.from(this.config.api_key + ":").toString("base64")}`,
      Accept: "application/json",
      "User-Agent": "Aurora AI Platform (support@aurora.ai)",
    };
  }

  async testConnection() {
    if (!this.config.api_key) return { ok: false, reason: "missing_api_key" };
    try {
      const res = await fetch(`${this.baseUrl}/practitioners?page=1&per_page=1`, {
        headers: this.headers,
      });
      if (!res.ok) return { ok: false, reason: `cliniko_api_${res.status}` };
      const data = await res.json();
      return { ok: true, practitioner_count: data.total_entries };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ page = 1, per_page = 100 } = {}) {
    const res = await fetch(
      `${this.baseUrl}/patients?page=${page}&per_page=${per_page}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Cliniko patients fetch failed: ${res.status}`);

    const { patients, total_entries } = await res.json();
    if (!patients || patients.length === 0) return { synced: 0, next_page: null };

    const admin = requireAdmin();
    const contacts = patients
      .map((p) => {
        const phone = p.phone_numbers?.[0]?.number || p.patient_phone_numbers?.[0]?.number;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
          email: p.email || null,
          crm_ref: `cliniko_${p.id}`,
          source: "cliniko",
          fields: { cliniko_id: p.id, dob: p.date_of_birth },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "Cliniko contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    const hasMore = page * per_page < total_entries;
    return { synced: contacts.length, total_fetched: patients.length, next_page: hasMore ? page + 1 : null };
  }

  async getPatient(patientId) {
    const res = await fetch(`${this.baseUrl}/patients/${patientId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cliniko get patient failed: ${res.status}`);
    return res.json();
  }

  async searchPatients(query) {
    const res = await fetch(
      `${this.baseUrl}/patients?q[]=${encodeURIComponent(`last_name~${query}`)}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Cliniko search patients failed: ${res.status}`);
    return res.json();
  }

  async listAppointments({ from, to, patientId, limit = 50 } = {}) {
    const params = new URLSearchParams({ per_page: String(limit) });
    const timeFrom = from || new Date().toISOString();
    const timeTo = to || new Date(Date.now() + 30 * 86400000).toISOString();
    params.set("q[]", `starts_at>=${timeFrom}`);
    params.append("q[]", `starts_at<=${timeTo}`);
    if (patientId) params.append("q[]", `patient_id=${patientId}`);

    const res = await fetch(`${this.baseUrl}/appointments?${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cliniko list appointments failed: ${res.status}`);
    return res.json();
  }

  async getPractitioners() {
    const res = await fetch(`${this.baseUrl}/practitioners`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cliniko get practitioners failed: ${res.status}`);
    return res.json();
  }

  async createPatientNote({ patientId, content } = {}) {
    const res = await fetch(`${this.baseUrl}/patient_notes`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ patient_note: { note: content, patient_id: patientId } }),
    });
    if (!res.ok) throw new Error(`Cliniko create patient note failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    logger.info({ type: payload?.event, org_id: this.orgId }, "Cliniko webhook received");
    return { received: true, event: payload?.event };
  }
}

module.exports = ClinikoProvider;
