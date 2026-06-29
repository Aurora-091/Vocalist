const logger = require("../../../config/logger");

async function check_availability(req) {
  const { date } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, date }, "Executing calcom.check_availability tool");
  const targetDate = date || new Date().toISOString().slice(0, 10);
  return {
    status: "success",
    slots: [
      { start: `${targetDate}T09:00:00Z`, end: `${targetDate}T09:30:00Z` },
      { start: `${targetDate}T10:30:00Z`, end: `${targetDate}T11:00:00Z` },
      { start: `${targetDate}T14:00:00Z`, end: `${targetDate}T14:30:00Z` }
    ]
  };
}

async function book_appointment(req) {
  const { slot_start, customer_name, customer_email } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, slot_start, customer_name }, "Executing calcom.book_appointment tool");
  return {
    status: "success",
    booking: {
      id: "booking-9923847",
      start: slot_start || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      attendee: { name: customer_name || "John Doe", email: customer_email || "john@example.com" },
      status: "confirmed",
      event_type_id: 12345,
      uid: "cal-uid-xyz"
    }
  };
}

async function cancel_appointment(req) {
  const { booking_id } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, booking_id }, "Executing calcom.cancel_appointment tool");
  return {
    status: "success",
    cancelled_booking_id: booking_id || "booking-9923847",
    status: "cancelled"
  };
}

async function reschedule_appointment(req) {
  const { booking_id, new_slot_start } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, booking_id, new_slot_start }, "Executing calcom.reschedule_appointment tool");
  return {
    status: "success",
    booking: {
      id: booking_id || "booking-9923847",
      start: new_slot_start || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      status: "confirmed"
    }
  };
}

module.exports = { check_availability, book_appointment, cancel_appointment, reschedule_appointment };
