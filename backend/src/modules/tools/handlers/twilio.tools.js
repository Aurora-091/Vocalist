const logger = require("../../../config/logger");

async function transfer_call(req) {
  const { destination_number } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, destination_number }, "Executing twilio.transfer_call tool");
  return {
    status: "success",
    message: "Call transfer initiated successfully",
    destination: destination_number || "+15550199",
    action: "transfer"
  };
}

async function send_sms(req) {
  const { to_number, message_body } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, to_number }, "Executing twilio.send_sms tool");
  return {
    status: "success",
    message_sid: "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    to: to_number || "+15550199",
    status: "queued"
  };
}

module.exports = { transfer_call, send_sms };
