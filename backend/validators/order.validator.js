/**
 * validators/order.validator.js
 * Purpose: validation for order + payment endpoints.
 *
 * createOrderRules is the checkout contract: the client sends WHO and
 * WHERE, never WHAT IT COSTS — every money value is computed from the
 * database in price.service.js.
 */
const { body, param } = require("express-validator");
const { ORDER_STATUSES } = require("../models/Order");

const idParam = [param("id").isMongoId().withMessage("Invalid order id")];

const createOrderRules = [
  body("customer.name")
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("Full name must be 2-60 characters"),
  body("customer.email")
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
  body("customer.phone")
    .trim()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage("Enter a valid phone number"),

  body("deliveryAddress.line1")
    .trim()
    .isLength({ min: 4, max: 200 })
    .withMessage("Address line 1 must be 4-200 characters"),
  body("deliveryAddress.line2")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 200 }),
  body("deliveryAddress.landmark")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 120 }),
  body("deliveryAddress.city")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("City is required"),
  body("deliveryAddress.state")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 80 }),
  body("deliveryAddress.pincode")
    .trim()
    .matches(/^[0-9]{4,10}$/)
    .withMessage("Enter a valid pincode"),

  body("note").optional({ values: "falsy" }).trim().isLength({ max: 300 }),
];

const cancelRules = [
  ...idParam,
  body("reason").optional({ values: "falsy" }).trim().isLength({ max: 200 }),
];

// admin: PATCH /api/admin/orders/:id/status
const statusRules = [
  ...idParam,
  body("status")
    .isIn(ORDER_STATUSES.filter((s) => s !== "pending_payment"))
    .withMessage("Invalid status"),
  body("note").optional({ values: "falsy" }).trim().isLength({ max: 200 }),
];

const paymentIdParam = [
  param("id").isMongoId().withMessage("Invalid payment id"),
];

module.exports = {
  idParam,
  createOrderRules,
  cancelRules,
  statusRules,
  paymentIdParam,
};
