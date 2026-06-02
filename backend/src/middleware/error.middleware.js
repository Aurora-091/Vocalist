const ApiError = require("../utils/ApiError");
const env = require("../config/env");

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = "Internal Server Error";
  let details;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err && typeof err === "object" && err.statusCode) {
    statusCode = err.statusCode;
    message = err.message || message;
  } else if (err && err.message) {
    message = err.message;
  }

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = { success: false, message };
  if (details !== undefined) body.details = details;
  if (env.NODE_ENV !== "production" && statusCode >= 500 && err?.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
