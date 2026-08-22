/**
 * models/Cart.js
 * Purpose: one server-side cart per user. Reconciles the two item shapes
 * the frontend produces:
 *  - product item  (cards.jsx/order.jsx): { name, price, image, quantity }
 *  - custom juice  (CustomizerPanel.jsx): { fruits[], base[], extras[], price }
 * unitPrice is always computed server-side; the client never sets prices.
 */
const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  kind: { type: String, enum: ["product", "custom"], required: true },
  // product items
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null,
  },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  image: { type: String, default: "" },
  // custom juice items
  custom: {
    fruits: { type: [String], default: undefined },
    base: { type: [String], default: undefined },
    extras: { type: [String], default: undefined },
  },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, default: 1, min: 1, max: 20 },
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

cartSchema.virtual("total").get(function () {
  return this.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
});

cartSchema.set("toJSON", { virtuals: true });
cartSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Cart", cartSchema);
