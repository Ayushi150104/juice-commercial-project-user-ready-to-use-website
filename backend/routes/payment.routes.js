/**
 * routes/payment.routes.js — /api/payment/*
 * Read-only. Payments are written server-side during POST /api/orders.
 */
const router = require("express").Router();
const controller = require("../controllers/payment.controller");
const { requireAuth } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const { paymentIdParam } = require("../validators/order.validator");

router.get("/config", controller.getConfig);
router.get("/my", requireAuth, controller.myPayments);
router.get("/:id", requireAuth, paymentIdParam, validate, controller.getPayment);

module.exports = router;
