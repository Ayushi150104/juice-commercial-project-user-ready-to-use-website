/**
 * controllers/payment.controller.js
 * Purpose: read access to the Payment collection.
 *
 * There is no /verify endpoint any more — payments are created and
 * settled server-side inside POST /api/orders by the mock gateway, so
 * the client can never influence a payment's status.
 */
const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const paymentService = require("../services/payment.service");

// GET /api/payment/config  (public) — tells the frontend which mode is live
const getConfig = asyncHandler(async (_req, res) => {
  return ok(res, {
    configured: paymentService.isConfigured(),
    mode: "mock",
    gateway: paymentService.GATEWAY,
    // no card form, no redirect — a single button completes checkout
    requiresRedirect: false,
    message: "Demo mode: pressing Place Order records a simulated payment.",
  });
});

// GET /api/payment/my — the signed-in user's payment records
const myPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .select("-__v");
  return ok(res, { payments });
});

// GET /api/payment/:id  (owner or admin)
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).select("-__v");
  if (!payment) throw ApiError.notFound("Payment not found");
  if (String(payment.user) !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("This is not your payment");
  }
  return ok(res, { payment });
});

module.exports = { getConfig, myPayments, getPayment };
