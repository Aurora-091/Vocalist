const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");

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
const waitlistRoutes = require("./modules/waitlist/waitlist.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const skillRoutes = require("./modules/skills/skills.routes");
const enterpriseRoutes = require("./modules/enterprise/enterprise.routes");
const shopifyInternalRoutes = require("./modules/integrations/shopify.internal.routes");

function buildCorsOptions() {
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (env.NODE_ENV === "development") {
    allowed.push(
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://admin.localhost:5173",
      "http://app.localhost:5173"
    );
  }

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.some((o) => origin === o || (o.startsWith("*.") && origin.endsWith(o.slice(1))))) {
        return callback(null, true);
      }
      // Only allow this project's own Vercel preview deployments, not every *.vercel.app site.
      if (/^https:\/\/vocalist(-[a-z0-9]+)*(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Client-Info"],
    maxAge: 86400,
  };
}

function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    req.id = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("X-Request-ID", req.id);
    next();
  });

  app.use(helmet());
  app.use(cors(buildCorsOptions()));

  app.use(
    morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );

  app.use("/webhooks", webhookRoutes);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.get("/", (_req, res) => res.json({ service: "aurora-api", status: "ok" }));
  app.get("/health", (_req, res) =>
    res.json({ status: "UP", uptime: process.uptime(), timestamp: new Date().toISOString() })
  );

  // S2S internal routes from weebersh (before JSON parser is fine — it has its own)
  app.use("/api/integrations/shopify", shopifyInternalRoutes);

  app.use("/v1/auth", authRoutes);
  app.use("/v1/waitlist", waitlistRoutes);
  app.use("/v1/enterprise", enterpriseRoutes);

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
  app.use("/v1/admin", adminRoutes);
  app.use("/v1/skills", skillRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
