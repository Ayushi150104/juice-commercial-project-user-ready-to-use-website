/**
 * routes/auth.routes.js — /api/auth/*
 */
const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/rateLimit");
const { validate } = require("../middlewares/validate");
const { registerRules, loginRules } = require("../validators/auth.validator");

router.post(
  "/register",
  authLimiter,
  registerRules,
  validate,
  controller.register,
);
router.post("/login", authLimiter, loginRules, validate, controller.login);
router.post("/refresh", authLimiter, controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);

module.exports = router;
