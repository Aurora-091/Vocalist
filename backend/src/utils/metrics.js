const Sentry = require("@sentry/node");

const enabled = !!process.env.SENTRY_DSN;

function increment(name, value = 1, tags = {}) {
  if (!enabled) return;
  Sentry.metrics.increment(name, value, { tags });
}

function distribution(name, value, unit, tags = {}) {
  if (!enabled) return;
  Sentry.metrics.distribution(name, value, { unit, tags });
}

function gauge(name, value, unit, tags = {}) {
  if (!enabled) return;
  Sentry.metrics.gauge(name, value, { unit, tags });
}

module.exports = { increment, distribution, gauge };
