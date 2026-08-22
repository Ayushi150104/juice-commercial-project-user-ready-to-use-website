/**
 * models/Payment.js
 * Purpose: every payment attempt gets its own document in its own
 * collection, so payment data is queryable independently of the order
 * (reports, refunds, reconciliation, admin dashboards).
 *
 * This project runs a MOCK gateway — no real money moves. The document
 * shape is deliberately the same one a real gateway integration would
 * need, so swapping in Razorpay/Stripe later means changing
 * services/payment.service.js only, not the schema or the frontend.
 */
const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Reference generator. Implemented as a schema DEFAULT (not a
 * pre("validate") hook) so the value exists the moment the document is
 * constructed — a hook only fires on save()/validate(), which left a
 * window where code could read an undefined reference.
 */
const ref = (prefix) => () =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

/** Audit trail: every state change of this payment, appended never overwritten. */
const attemptSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["initiated", "paid", "failed", "refunded"],
      required: true,
    },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    // Human-readable reference shown in the UI, e.g. PAY-1765432100-3F9A2C
    paymentRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: ref("PAY"),
    },

    // Gateway-side identifier. Real gateways return this; the mock
    // generates one with the same shape so nothing downstream changes.
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: ref("TXN"),
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    // Denormalised so a payment row is readable without a join
    orderNumber: { type: String, required: true, index: true },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who paid — snapshot, so later profile edits don't rewrite history
    customer: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    method: {
      type: String,
      enum: ["mock", "cod"],
      default: "mock",
    },
    gateway: { type: String, default: "mock-gateway" },

    status: {
      type: String,
      enum: ["initiated", "paid", "failed", "refunded"],
      default: "initiated",
      index: true,
    },

    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    failureReason: { type: String, default: "" },

    attempts: { type: [attemptSchema], default: [] },

    // Request fingerprint — useful for support and fraud review
    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

/** Appends an attempt row and moves the payment to that status. */
paymentSchema.methods.recordStatus = function (status, note = "") {
  this.status = status;
  this.attempts.push({ status, at: new Date(), note });
  if (status === "paid") this.paidAt = new Date();
  if (status === "refunded") this.refundedAt = new Date();
  if (status === "failed") this.failureReason = note;
  return this;
};

module.exports = mongoose.model("Payment", paymentSchema);
