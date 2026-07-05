const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

const BASE_URL = "https://api.cal.com/v2";

class CalcomProvider extends IntegrationProvider {
  static get type() { return "calendar"; }

  get headers() {
    return {
      Authorization: `Bearer ${this.config.api_key}`,
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    };
  }

  async testConnection() {
    if (!this.config.api_key) return { ok: false, reason: "missing_api_key" };
    try {
      const res = await fetch(`${BASE_URL}/me`, { headers: this.headers });
      if (!res.ok) return { ok: false, reason: `calcom_api_${res.status}` };
      const data = await res.json();
      return { ok: true, username: data.data?.username, email: data.data?.email };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts() {
    // Cal.com is a scheduling tool — contacts are sourced from bookings
    const res = await fetch(
      `${BASE_URL}/bookings?status=upcoming&take=100`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Cal.com bookings fetch failed: ${res.status}`);

    const { data } = await res.json();
    const bookings = data || [];
    if (bookings.length === 0) return { synced: 0 };

    const admin = requireAdmin();
    const contacts = bookings
      .map((b) => {
        const attendee = b.attendees?.[0];
        if (!attendee?.phoneNumber) return null;
        const e164 = attendee.phoneNumber.replace(/[^\d+]/g, "");
        if (!e164 || e164.length < 7) return null;
        return {
          org_id: this.orgId,
          e164,
          name: attendee.name || null,
          email: attendee.email || null,
          crm_ref: `calcom_${b.id}`,
          source: "calcom",
          fields: { booking_id: b.id, event_type: b.eventType?.title },
        };
      })
      .filter(Boolean);

    if (contacts.length > 0) {
      const { error } = await admin
        .from("contacts")
        .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });
      if (error) throw new Error(`Contact sync failed: ${error.message}`);
    }

    return { synced: contacts.length, total_fetched: bookings.length };
  }

  async listEventTypes() {
    const res = await fetch(`${BASE_URL}/event-types`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cal.com list event types failed: ${res.status}`);
    return res.json();
  }

  async listBookings({ status = "upcoming", take = 20, skip = 0 } = {}) {
    const params = new URLSearchParams({ status, take: String(take), skip: String(skip) });
    const res = await fetch(`${BASE_URL}/bookings?${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cal.com list bookings failed: ${res.status}`);
    return res.json();
  }

  async getBooking(bookingId) {
    const res = await fetch(`${BASE_URL}/bookings/${bookingId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cal.com get booking failed: ${res.status}`);
    return res.json();
  }

  async getAvailability({ eventTypeId, startTime, endTime, timeZone = "UTC" } = {}) {
    if (!eventTypeId || !startTime || !endTime) {
      throw new Error("eventTypeId, startTime, and endTime are required");
    }
    const params = new URLSearchParams({
      eventTypeId: String(eventTypeId),
      startTime,
      endTime,
      timeZone,
    });
    const res = await fetch(`${BASE_URL}/slots?${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Cal.com get availability failed: ${res.status}`);
    return res.json();
  }

  async createBooking({ eventTypeId, start, name, email, phone, timezone = "UTC", notes } = {}) {
    if (!eventTypeId || !start || !email) {
      throw new Error("eventTypeId, start, and email are required");
    }
    const body = {
      eventTypeId,
      start,
      responses: { email, name: name || "" },
      timeZone: timezone,
      language: "en",
      metadata: {},
    };
    if (phone) body.responses.smsReminderNumber = phone;
    if (notes) body.metadata.additionalNotes = notes;

    const res = await fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Cal.com create booking failed: ${res.status} ${errBody}`);
    }
    return res.json();
  }

  async cancelBooking(bookingId, { reason } = {}) {
    const res = await fetch(`${BASE_URL}/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ reason: reason || "" }),
    });
    if (!res.ok) throw new Error(`Cal.com cancel booking failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    const { triggerEvent, payload: data } = payload || {};
    logger.info({ trigger: triggerEvent, org_id: this.orgId }, "Cal.com webhook received");

    if ((triggerEvent === "BOOKING_CREATED" || triggerEvent === "BOOKING_RESCHEDULED") && data?.attendees?.[0]?.phoneNumber) {
      try {
        const attendee = data.attendees[0];
        const e164 = attendee.phoneNumber.replace(/[^\d+]/g, "");
        if (e164.length >= 7) {
          const admin = requireAdmin();
          await admin.from("contacts").upsert(
            {
              org_id: this.orgId,
              e164,
              name: attendee.name || null,
              email: attendee.email || null,
              crm_ref: `calcom_${data.bookingId}`,
              source: "calcom",
              fields: { booking_id: data.bookingId },
            },
            { onConflict: "org_id,e164" }
          );
        }
      } catch (err) {
        logger.error({ err: err.message }, "Cal.com webhook contact sync failed");
      }
    }

    return { received: true, trigger: triggerEvent };
  }
}

module.exports = CalcomProvider;
