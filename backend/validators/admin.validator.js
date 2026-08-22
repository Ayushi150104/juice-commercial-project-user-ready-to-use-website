/**
 * validators/admin.validator.js
 * Purpose: validation for admin user management.
 */
const { body, param } = require("express-validator");

const userIdParam = [param("id").isMongoId().withMessage("Invalid user id")];

const updateUserRules = [
  ...userIdParam,
  body("isActive").optional().isBoolean().toBoolean(),
  body("role").optional().isIn(["customer", "admin"]),
];

module.exports = { userIdParam, updateUserRules };
