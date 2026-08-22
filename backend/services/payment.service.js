/**
 * services/payment.service.js
 * Purpose: MOCK payment gateway.
 *
 * There is no real money movement and no third-party SDK. Pressing
 * "Place Order" calls charge(), which writes a Payment document with a
 * generated transaction id and status "paid". Everything a real
 * integration would persist is persisted here — amount, currency,
 * method, gateway, transaction id, timestamps, per-attempt audit trail
 * and the request fingerprint.
 *
 * Swapping in a real gateway later means rewriting THIS FILE ONLY:
 * keep charge()/refund() signatures and neither the controllers, the
 * models nor the frontend need to change.
 */
const Payment = require("../models/Payment");
const logger = require("../utils/logger");

const GATEWAY = "mock-gateway";

/** The mock never declines. Kept as a function so it is easy to swap. */
function authorize() {
  return { approved: true, reason: "" };
}

/**
 * Creates and settles a payment for an order.
 * @returns {Promise<Payment>} the saved Payment document
 */
async function charge({ order, user, customer, req }) {
  const payment = new Payment({
    order: order._id,
    orderNumber: order.orderNumber,
    user: user.id || user._id,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    amount: order.total,
    currency: order.currency || "INR",
    method: "mock",
    gateway: GATEWAY,
    meta: {
      ip: req ? req.ip || "" : "",
      userAgent: req ? String(req.headers["user-agent"] || "").slice(0, 300) : "",
    },
  });

  payment.recordStatus("initiated", "Checkout started");

  const result = authorize();
  if (result.approved) {
    payment.recordStatus("paid", "Simulated payment approved (no real charge)");
  } else {
    payment.recordStatus("failed", result.reason || "Simulated decline");
  }

  await payment.save();
  logger.info(
    `[payment] ${payment.status} ${payment.transactionId} for ${order.orderNumber} (₹${payment.amount})`
  );
  return payment;
}

/** Marks a settled payment as refunded (used when a paid order is cancelled). */
async function refund(payment, note = "Order cancelled by customer") {
  if (!payment || payment.status !== "paid") return payment;
  payment.recordStatus("refunded", note);
  await payment.save();
  logger.info(`[payment] refunded ${payment.transactionId}`);
  return payment;
}

/** The mock gateway is always available — no API keys required. */
function isConfigured() {
  return true;
}

module.exports = { charge, refund, isConfigured, GATEWAY };
