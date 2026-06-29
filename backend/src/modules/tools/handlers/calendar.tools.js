const logger = require("../../../config/logger");

async function check_calendar(req) {
  const { start_time, end_time } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, start_time, end_time }, "Executing calendar.check_calendar tool");
  return {
    status: "success",
    busy: [
      { start: start_time || new Date().toISOString(), end: end_time || new Date(Date.now() + 3600_000).toISOString() }
    ]
  };
}

async function create_event(req) {
  const { title, start_time, end_time, attendees } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, title }, "Executing calendar.create_event tool");
  return {
    status: "success",
    event: {
      id: "event-gc-83749283",
      summary: title || "Consultation Call",
      start: { dateTime: start_time || new Date().toISOString() },
      end: { dateTime: end_time || new Date(Date.now() + 1800_000).toISOString() },
      htmlLink: "https://calendar.google.com/event?eid=abc"
    }
  };
}

async function update_event(req) {
  const { event_id, title } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, event_id, title }, "Executing calendar.update_event tool");
  return {
    status: "success",
    event: {
      id: event_id || "event-gc-83749283",
      summary: title || "Updated Consultation Call",
      status: "confirmed"
    }
  };
}

module.exports = { check_calendar, create_event, update_event };
