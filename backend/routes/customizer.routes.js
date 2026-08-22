/**
 * routes/customizer.routes.js — /api/customizer/*
 */
const router = require("express").Router();
const controller = require("../controllers/customizer.controller");
const { requireAuth } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/roles");
const { validate } = require("../middlewares/validate");
const {
  idParam,
  createRules,
  updateRules,
} = require("../validators/customizer.validator");

router.get("/options", controller.listOptions);

router.post(
  "/options",
  requireAuth,
  requireRole("admin"),
  createRules,
  validate,
  controller.createOption
);
router.put(
  "/options/:id",
  requireAuth,
  requireRole("admin"),
  updateRules,
  validate,
  controller.updateOption
);
router.delete(
  "/options/:id",
  requireAuth,
  requireRole("admin"),
  idParam,
  validate,
  controller.deleteOption
);

module.exports = router;
