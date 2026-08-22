/**
 * routes/admin.routes.js — /api/admin/*  (admin only)
 */
const router = require("express").Router();
const controller = require("../controllers/admin.controller");
const { requireAuth } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/roles");
const { validate } = require("../middlewares/validate");
const { statusRules } = require("../validators/order.validator");
const { updateUserRules } = require("../validators/admin.validator");

router.use(requireAuth, requireRole("admin"));

router.get("/orders", controller.listOrders);
router.patch("/orders/:id/status", statusRules, validate, controller.updateOrderStatus);
router.get("/payments", controller.listPayments);
router.get("/users", controller.listUsers);
router.patch("/users/:id", updateUserRules, validate, controller.updateUser);
router.get("/stats", controller.getStats);

module.exports = router;
