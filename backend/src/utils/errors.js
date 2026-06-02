class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BadRequest = (message, details) => new HttpError(400, "bad_request", message, details);
const Unauthorized = (message = "Unauthorized") => new HttpError(401, "unauthorized", message);
const Forbidden = (message = "Forbidden") => new HttpError(403, "forbidden", message);
const NotFound = (message = "Not Found") => new HttpError(404, "not_found", message);
const Conflict = (message, details) => new HttpError(409, "conflict", message, details);
const UnprocessableEntity = (message, details) =>
  new HttpError(422, "unprocessable_entity", message, details);
const TooManyRequests = (message = "Rate limit exceeded") =>
  new HttpError(429, "rate_limited", message);
const Internal = (message = "Internal Server Error") => new HttpError(500, "internal", message);

module.exports = {
  HttpError,
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
  Conflict,
  UnprocessableEntity,
  TooManyRequests,
  Internal,
};
