const { HttpError } = require("../utils/errors");
const logger = require("../config/logger");

function notFound(_req, _res, next) {
  next(new HttpError(404, "not_found", "Route not found"));
}

function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.path }, "Request failed");
    } else {
      logger.warn({ code: err.code, path: req.path, message: err.message }, "Request error");
    }
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err?.code === "PGRST301" || err?.code === "42501") {
    return res.status(403).json({
      error: { code: "forbidden", message: "Access denied by RLS policy" },
    });
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({
    error: { code: "internal", message: "Internal server error" },
  });
}

module.exports = { notFound, errorHandler };
