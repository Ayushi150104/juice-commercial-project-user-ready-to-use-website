/**
 * middlewares/validate.js
 * Purpose: runs express-validator chains and turns failures into a
 * single 400 response with per-field messages.
 */
const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: true }).map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  next(
    ApiError.badRequest("Validation failed", {
      code: "VALIDATION_ERROR",
      errors,
    })
  );
}

module.exports = { validate };
