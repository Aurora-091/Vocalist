const { z } = require("zod");
const { UnprocessableEntity } = require("../utils/errors");

const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(UnprocessableEntity("Validation failed", err.flatten()));
    }
    next(err);
  }
};

module.exports = { validate };
