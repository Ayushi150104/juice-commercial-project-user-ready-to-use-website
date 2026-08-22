/**
 * validators/customizer.validator.js
 * Purpose: validation for admin customizer-option CRUD.
 */
const { body, param } = require("express-validator");

const idParam = [param("id").isMongoId().withMessage("Invalid option id")];

const createRules = [
  body("type")
    .isIn(["fruit", "base", "extra"])
    .withMessage("type must be fruit, base or extra"),
  body("label")
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage("Label must be 1-60 characters"),
  body("priceModifier")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("priceModifier must be >= 0"),
  body("isAvailable").optional().isBoolean().toBoolean(),
  body("sortOrder").optional().isInt(),
];

const updateRules = [
  ...idParam,
  body("type").optional().isIn(["fruit", "base", "extra"]),
  body("label").optional().trim().isLength({ min: 1, max: 60 }),
  body("priceModifier").optional().isFloat({ min: 0 }),
  body("isAvailable").optional().isBoolean().toBoolean(),
  body("sortOrder").optional().isInt(),
];

module.exports = { idParam, createRules, updateRules };
