/**
 * validators/cart.validator.js
 * Purpose: validation for cart mutations. Two add shapes:
 *  { kind:"product", productId, quantity }
 *  { kind:"custom", fruits[], base[], extras[], quantity }
 * Prices are never accepted from the client.
 */
const { body, param } = require("express-validator");

const addItemRules = [
  body("kind")
    .isIn(["product", "custom"])
    .withMessage("kind must be 'product' or 'custom'"),
  body("productId")
    .if(body("kind").equals("product"))
    .isMongoId()
    .withMessage("Valid productId required for product items"),
  body("fruits")
    .if(body("kind").equals("custom"))
    .isArray({ min: 1 })
    .withMessage("fruits must be a non-empty array"),
  body("fruits.*").optional().isString().trim().isLength({ min: 1, max: 60 }),
  body("base").optional().isArray(),
  body("base.*").optional().isString().trim().isLength({ min: 1, max: 60 }),
  body("extras").optional().isArray(),
  body("extras.*").optional().isString().trim().isLength({ min: 1, max: 60 }),
  body("quantity").optional().isInt({ min: 1, max: 20 }).toInt(),
];

// POST /api/cart/merge — the guest localStorage cart. Individual entries
// are still validated one-by-one by buildItem() (invalid ones are skipped
// rather than failing the whole merge); this only guards the envelope.
const mergeRules = [
  body("items").isArray({ max: 50 }).withMessage("items must be an array of at most 50 entries"),
  body("items.*.kind")
    .isIn(["product", "custom"])
    .withMessage("Each item needs kind 'product' or 'custom'"),
  body("items.*.quantity").optional().isInt({ min: 1, max: 20 }).toInt(),
];

const itemIdParam = [
  param("itemId").isMongoId().withMessage("Invalid cart item id"),
];

const updateQtyRules = [
  ...itemIdParam,
  body("quantity")
    .isInt({ min: 1, max: 20 })
    .withMessage("quantity must be 1-20")
    .toInt(),
];

module.exports = { addItemRules, mergeRules, itemIdParam, updateQtyRules };
