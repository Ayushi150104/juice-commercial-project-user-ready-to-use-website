/**
 * routes/cart.routes.js — /api/cart/*  (all authenticated)
 */
const router = require("express").Router();
const controller = require("../controllers/cart.controller");
const { requireAuth } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const {
  addItemRules,
  mergeRules,
  itemIdParam,
  updateQtyRules,
} = require("../validators/cart.validator");

router.use(requireAuth);

router.get("/", controller.getCart);
router.post("/items", addItemRules, validate, controller.addItem);
router.put("/items/:itemId", updateQtyRules, validate, controller.updateItemQuantity);
router.delete("/items/:itemId", itemIdParam, validate, controller.removeItem);
router.delete("/", controller.clearCart);
router.post("/merge", mergeRules, validate, controller.mergeCart);

module.exports = router;
