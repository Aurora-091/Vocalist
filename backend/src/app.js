const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const logger = require("./config/logger");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { apiLimiter } = require("./middleware/rate-limit.middleware");

const authRoutes = require("./modules/auth/auth.routes");
const orgRoutes = require("./modules/organizations/organizations.routes");
const userRoutes = require("./modules/users/users.routes");
const agentRoutes = require("./modules/agents/agents.routes");
const contactRoutes = require("./modules/contacts/contacts.routes");
const consentRoutes = require("./modules/consent/consent.routes");
const campaignRoutes = require("./modules/campaigns/campaigns.routes");
const callRoutes = require("./modules/calls/calls.routes");
const billingRoutes = require("./modules/billing/billing.routes");
const integrationRoutes = require("./modules/integrations/integration.routes");
const webhookRoutes = require("./modules/webhooks/webhook.routes");
const verticalRoutes = require("./modules/verticals/verticals.routes");
const onboardingRoutes = require("./modules/onboarding/onboarding.routes");
const knowledgeRoutes = require("./modules/knowledge/knowledge.routes");
const numberRoutes = require("./modules/numbers/numbers.routes");
const segmentRoutes = require("./modules/segments/segments.routes");
const gdprRoutes = require("./modules/gdpr/gdpr.routes");
const analyticsRoutes = require("./modules/analytics/analytics.routes");
const settingsRoutes = require("./modules/settings/settings.routes");
const notificationRoutes = require("./modules/notifications/notifications.routes");
const webhooksOutRoutes = require("./modules/webhooks-out/webhooks-out.routes");
const twilioRoutes = require("./modules/twilio/twilio.routes");

function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors());

  app.use(
    morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );

  app.use("/webhooks", webhookRoutes);

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  app.get("/", (_req, res) => res.json({ service: "aurora-api", status: "ok" }));
  app.get("/health", (_req, res) =>
    res.json({ status: "UP", uptime: process.uptime(), timestamp: new Date().toISOString() })
  );

  app.use("/v1/auth", authRoutes);

  app.use("/v1", apiLimiter);

  app.use("/v1/orgs", orgRoutes);
  app.use("/v1/users", userRoutes);
  app.use("/v1/agents", agentRoutes);
  app.use("/v1/contacts", contactRoutes);
  app.use("/v1/consent", consentRoutes);
  app.use("/v1/campaigns", campaignRoutes);
  app.use("/v1/calls", callRoutes);
  app.use("/v1/billing", billingRoutes);
  app.use("/v1/integrations", integrationRoutes);
  app.use("/v1/verticals", verticalRoutes);
  app.use("/v1/onboarding", onboardingRoutes);
  app.use("/v1/knowledge", knowledgeRoutes);
  app.use("/v1/numbers", numberRoutes);
  app.use("/v1/segments", segmentRoutes);
  app.use("/v1/gdpr", gdprRoutes);
  app.use("/v1/analytics", analyticsRoutes);
  app.use("/v1/settings", settingsRoutes);
  app.use("/v1/notifications", notificationRoutes);
  app.use("/v1/webhooks-out", webhooksOutRoutes);
  app.use("/v1/twilio", twilioRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
