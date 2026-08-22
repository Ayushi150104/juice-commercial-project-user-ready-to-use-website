/**
 * routes/index.js
 * Purpose: mounts every resource router under /api.
 */
const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/products", require("./product.routes"));
router.use("/customizer", require("./customizer.routes"));
router.use("/cart", require("./cart.routes"));
router.use("/orders", require("./order.routes"));
router.use("/payment", require("./payment.routes"));
router.use("/admin", require("./admin.routes"));

router.get("/health", (_req, res) =>
  res.json({ success: true, status: "ok", uptime: process.uptime() }),
);

module.exports = router;
