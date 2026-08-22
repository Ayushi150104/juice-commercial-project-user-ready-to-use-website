/**
 * validators/product.validator.js
 * Purpose: validation for admin product create/update. Multipart form
 * fields arrive as strings, so price is checked as a numeric string too.
 */
const { body, param } = require("express-validator");

const idParam = [param("id").isMongoId().withMessage("Invalid product id")];

const createRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be 2-80 characters"),
  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a number >= 0"),
  body("address").optional().trim().isLength({ max: 120 }),
  body("time").optional().trim().isLength({ max: 40 }),
  body("isAvailable").optional().isBoolean().toBoolean(),
];

const updateRules = [
  ...idParam,
  body("name").optional().trim().isLength({ min: 2, max: 80 }),
  body("price").optional().isFloat({ min: 0 }),
  body("address").optional().trim().isLength({ max: 120 }),
  body("time").optional().trim().isLength({ max: 40 }),
  body("isAvailable").optional().isBoolean().toBoolean(),
];

module.exports = { idParam, createRules, updateRules };
