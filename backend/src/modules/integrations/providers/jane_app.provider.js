const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

class JaneAppProvider extends IntegrationProvider {
  static get type() { return "ehr"; }

  get baseUrl() {
    if (!this.config.clinic_slug) throw new Error("Jane App clinic_slug not configured");
    return `https://app.janeapp.com/api/v1`;
  }

  // Jane App uses Basic auth with the API token as password
  get headers() {
    const token = this.config.api_key;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async testConnection() {
    if (!this.config.api_key || !this.config.clinic_slug) {
      return { ok: false, reason: "missing_credentials" };
    }
    try {
      const res = await fetch(`${this.baseUrl}/staff_members?per_page=1`, {
        headers: this.headers,
      });
      if (!res.ok) return { ok: false, reason: `jane_app_api_${res.status}` };
      return { ok: true, clinic_slug: this.config.clinic_slug };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ page = 1, per_page = 100 } = {}) {
    const res = await fetch(
      `${this.baseUrl}/patients?page=${page}&per_page=${per_page}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Jane App patients fetch failed: ${res.status}`);

    const body = await res.json();
    const patients = body.patients || body.data || [];

    if (patients.length === 0) return { synced: 0, next_page: null };

    const admin = requireAdmin();
    const contacts = patients
      .map((p) => {
        const phone = p.phone_numbers?.find((ph) => ph.phone_type === "cell" || ph.phone_type === "home")?.number
          || p.phone_numbers?.[0]?.number;
        if (!phone) return null;
        const e164 = phone.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
          email: p.email || null,
          crm_ref: `jane_app_${p.id}`,
          source: "jane_app",
          fields: { jane_app_id: p.id, dob: p.birth_date },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) {
        logger.error({ err: error }, "Jane App contact sync upsert failed");
        throw new Error(`Contact sync failed: ${error.message}`);
      }
    }

    const hasMore = patients.length === per_page;
    return { synced: contacts.length, total_fetched: patients.length, next_page: hasMore ? page + 1 : null };
  }

  async getPatient(patientId) {
    const res = await fetch(`${this.baseUrl}/patients/${patientId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Jane App get patient failed: ${res.status}`);
    return res.json();
  }

  async searchPatients(query) {
    const res = await fetch(
      `${this.baseUrl}/patients?search=${encodeURIComponent(query)}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Jane App search patients failed: ${res.status}`);
    return res.json();
  }

  async listAppointments({ from, to, patientId, limit = 50, page = 1 } = {}) {
    const params = new URLSearchParams({ per_page: String(limit), page: String(page) });
    if (from) params.set("start_at", from);
    if (to) params.set("end_at", to);
    if (patientId) params.set("patient_id", String(patientId));

    const res = await fetch(`${this.baseUrl}/appointments?${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Jane App list appointments failed: ${res.status}`);
    return res.json();
  }

  async getStaffMembers() {
    const res = await fetch(`${this.baseUrl}/staff_members`, { headers: this.headers });
    if (!res.ok) throw new Error(`Jane App get staff failed: ${res.status}`);
    return res.json();
  }

  async createChartNote({ patientId, content, staffId } = {}) {
    const body = { chart_entry: { content, patient_id: patientId } };
    if (staffId) body.chart_entry.staff_member_id = staffId;
    const res = await fetch(`${this.baseUrl}/chart_entries`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Jane App create chart note failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    logger.info({ type: payload?.event_type, org_id: this.orgId }, "Jane App webhook received");
    return { received: true, event: payload?.event_type };
  }
}

module.exports = JaneAppProvider;
