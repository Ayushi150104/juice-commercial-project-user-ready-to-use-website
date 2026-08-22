/**
 * routes/order.routes.js — /api/orders/*  (all authenticated)
 */
const router = require("express").Router();
const controller = require("../controllers/order.controller");
const { requireAuth } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const {
  idParam,
  createOrderRules,
  cancelRules,
} = require("../validators/order.validator");

router.use(requireAuth);

// one call = order created + payment recorded + cart cleared
router.post("/", createOrderRules, validate, controller.createOrder);
router.get("/my", controller.myOrders);
router.get("/:id", idParam, validate, controller.getOrder);
router.patch("/:id/cancel", cancelRules, validate, controller.cancelOrder);

module.exports = router;
