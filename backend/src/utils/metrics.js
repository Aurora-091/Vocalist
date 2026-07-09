const Sentry = require("@sentry/node");
const { getPostHogClient } = require("../config/posthog");

const sentryEnabled = !!process.env.SENTRY_DSN;
const posthogEnabled = !!process.env.POSTHOG_KEY;

// Sentry's metrics beta API (Sentry.metrics.*) was sunset — Sentry is used here only
// for breadcrumb context on captured exceptions. PostHog is the actual metrics sink.
function record(name, value, tags = {}) {
  if (sentryEnabled) {
    Sentry.addBreadcrumb({
      category: "metric",
      message: name,
      level: "info",
      data: { value, ...tags },
    });
  }

  if (posthogEnabled) {
    const { org_id: distinctId, ...properties } = tags;
    getPostHogClient()?.capture({
      distinctId: distinctId || "backend-system",
      event: `metric.${name}`,
      properties: { value, ...properties },
    });
  }
}

function increment(name, value = 1, tags = {}) {
  record(name, value, tags);
}

function distribution(name, value, unit, tags = {}) {
  record(name, value, { unit, ...tags });
}

function gauge(name, value, unit, tags = {}) {
  record(name, value, { unit, ...tags });
}

module.exports = { increment, distribution, gauge };
