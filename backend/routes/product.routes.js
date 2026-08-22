/**
 * routes/product.routes.js — /api/products/*
 * Public reads, admin-only writes with optional image upload.
 *
 * xssSanitizer runs again AFTER multer on the multipart routes: the global
 * one in server.js sees req.body as undefined because multer has not parsed
 * the form yet, so without this a script payload in a text field would be
 * stored raw and served back by the public product list.
 */
const router = require("express").Router();
const controller = require("../controllers/product.controller");
const { requireAuth } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/roles");
const { uploadProductImage } = require("../middlewares/upload");
const { xssSanitizer } = require("../middlewares/sanitize");
const { validate } = require("../middlewares/validate");
const {
  idParam,
  createRules,
  updateRules,
} = require("../validators/product.validator");

router.get("/", controller.listProducts);
router.get("/:id", idParam, validate, controller.getProduct);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  uploadProductImage,
  xssSanitizer,
  createRules,
  validate,
  controller.createProduct
);
router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  uploadProductImage,
  xssSanitizer,
  updateRules,
  validate,
  controller.updateProduct
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  idParam,
  validate,
  controller.deleteProduct
);
router.delete(
  "/:id/image",
  requireAuth,
  requireRole("admin"),
  idParam,
  validate,
  controller.deleteProductImage
);

module.exports = router;
