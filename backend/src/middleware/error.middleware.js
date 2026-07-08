const { HttpError } = require("../utils/errors");
const logger = require("../config/logger");
const env = require("../config/env");
const Sentry = require("@sentry/node");
const metrics = require("../utils/metrics");

function notFound(_req, _res, next) {
  next(new HttpError(404, "not_found", "Route not found"));
}

function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    metrics.increment("http.error", 1, { status: String(err.status), code: err.code });
    if (err.status >= 500) {
      logger.error({ err, path: req.path, method: req.method, requestId: req.id }, "Request failed");
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err, { extra: { path: req.path, method: req.method, requestId: req.id } });
      }
    } else {
      logger.warn(
        { code: err.code, path: req.path, method: req.method, message: err.message, requestId: req.id, status: err.status },
        `[${err.status}] ${req.method} ${req.path} - ${err.code}: ${err.message}`
      );
    }

    const details = env.NODE_ENV === "production" ? undefined : err.details;

    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details },
    });
  }

  if (err?.code === "PGRST301" || err?.code === "42501") {
    logger.warn({ path: req.path, method: req.method, requestId: req.id, pgCode: err.code }, "RLS policy denied access");
    return res.status(403).json({
      error: { code: "forbidden", message: "Access denied by RLS policy" },
    });
  }

  if (err?.message?.startsWith("CORS:")) {
    logger.warn({ origin: req.headers.origin, path: req.path, requestId: req.id }, err.message);
    return res.status(403).json({
      error: { code: "cors_rejected", message: err.message },
    });
  }

  logger.error({ err, path: req.path, method: req.method, requestId: req.id }, "Unhandled error");
  metrics.increment("http.error", 1, { status: "500", code: "internal" });
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: { path: req.path, method: req.method, requestId: req.id } });
  }
  res.status(500).json({
    error: { code: "internal", message: "Internal server error" },
  });
}

module.exports = { notFound, errorHandler };
