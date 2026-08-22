/**
 * models/Order.js
 * Purpose: immutable snapshot of a checkout. Everything needed to
 * reconstruct the order months later lives here — customer details,
 * delivery address, per-line pricing, the money breakdown, the payment
 * summary and a full status timeline. Nothing is looked up live.
 *
 * The authoritative payment record is models/Payment.js (its own
 * collection); the embedded `payment` block here is a denormalised
 * summary so the History panel needs no join.
 */
const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Order number generator. A schema DEFAULT rather than a
 * pre("validate") hook, so `orderNumber` is populated as soon as the
 * document is constructed and can never be read as undefined.
 */
const nextOrderNumber = () =>
  `JU-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

const orderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "custom"], required: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    custom: {
      fruits: { type: [String], default: undefined },
      base: { type: [String], default: undefined },
      extras: { type: [String], default: undefined },
    },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    // unitPrice * quantity, frozen at checkout time
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, default: "", trim: true, maxlength: 200 },
    landmark: { type: String, default: "", trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, default: "", trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 12 },
  },
  { _id: false }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    // "system" | "customer" | "admin"
    by: { type: String, default: "system" },
  },
  { _id: false }
);

const ORDER_STATUSES = [
  "pending_payment",
  "placed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: nextOrderNumber,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Contact snapshot taken at checkout (NOT read live from the user doc)
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 60 },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true, maxlength: 20 },
    },

    deliveryAddress: { type: addressSchema, required: true },

    // Free-text instructions from the customer ("no ice", "gate 2")
    note: { type: String, default: "", trim: true, maxlength: 300 },

    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, "Order must contain at least one item"],
    },

    // Money breakdown — every component stored, not recomputed on read
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    itemCount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending_payment",
      index: true,
    },
    statusHistory: { type: [statusEventSchema], default: [] },

    // Denormalised summary of the Payment document
    payment: {
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
      },
      method: { type: String, enum: ["mock", "cod"], default: "mock" },
      gateway: { type: String, default: "mock-gateway" },
      status: {
        type: String,
        enum: ["initiated", "paid", "failed", "refunded"],
        default: "initiated",
      },
      paymentRef: { type: String, default: "", index: true },
      transactionId: { type: String, default: "", index: true },
      amount: { type: Number, default: 0, min: 0 },
      paidAt: { type: Date, default: null },
    },

    placedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "customer.phone": 1 });

/** Moves the order to a status and appends a timeline entry. */
orderSchema.methods.setStatus = function (status, { note = "", by = "system" } = {}) {
  this.status = status;
  this.statusHistory.push({ status, at: new Date(), note, by });
  if (status === "placed" && !this.placedAt) this.placedAt = new Date();
  if (status === "cancelled") this.cancelledAt = new Date();
  if (status === "delivered") this.deliveredAt = new Date();
  return this;
};

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
