const ApiError = require("../utils/ApiError");

/**
 * Lightweight body validator. `schema` is a function that receives the body
 * and returns either `{ value }` to pass the normalized body or
 * `{ error: "message" }` / throws an ApiError to reject the request.
 */
function validateBody(schema) {
  return function validator(req, res, next) {
    try {
      const result = schema(req.body || {});
      if (result && result.error) {
        throw ApiError.badRequest(result.error, result.details);
      }
      if (result && Object.prototype.hasOwnProperty.call(result, "value")) {
        req.body = result.value;
      }
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.badRequest(err.message));
    }
  };
}

module.exports = { validateBody };
