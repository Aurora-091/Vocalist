const express = require("express");
const { resolveOrgFromAgent } = require("./tools.middleware");
const shopifyTools = require("./handlers/shopify.tools");
const calcomTools = require("./handlers/calcom.tools");
const calendarTools = require("./handlers/calendar.tools");
const twilioTools = require("./handlers/twilio.tools");
const { NotFound } = require("../../utils/errors");
const asyncHandler = require("../../utils/asyncHandler");

const router = express.Router();

// Apply auth/org resolution middleware to all tool routes
router.use(resolveOrgFromAgent);

const HANDLERS = {
  shopify: shopifyTools,
  calcom: calcomTools,
  calendar: calendarTools,
  twilio: twilioTools,
};

router.post("/:integration/:action", asyncHandler(async (req, res, next) => {
  const { integration, action } = req.params;
  const handler = HANDLERS[integration];
  if (!handler) {
    return next(NotFound(`Integration tools handler not found: ${integration}`));
  }

  const actionFn = handler[action];
  if (typeof actionFn !== "function") {
    return next(NotFound(`Tool action not found: ${integration}/${action}`));
  }

  const result = await actionFn(req);
  res.json(result);
}));

module.exports = router;
