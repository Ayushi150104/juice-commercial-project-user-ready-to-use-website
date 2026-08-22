/**
 * models/Product.js
 * Purpose: replaces the 4 hardcoded juices in src/component/cards.jsx.
 * Field names mirror what the frontend already renders:
 * { name, address, time, price, image }. Soft delete via isDeleted.
 */
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: 80,
      index: true,
    },
    // The frontend shows "Taste the delight from {address}"
    address: { type: String, trim: true, default: "", maxlength: 120 },
    // Prep/serve time string shown on cards (e.g. "30 min")
    time: { type: String, trim: true, default: "", maxlength: 40 },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    // Absolute or server-relative URL (served from /uploads or Cloudinary)
    image: { type: String, default: "" },
    // Cloudinary public_id or local file path — needed to delete/replace image
    imageRef: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ isDeleted: 1, isAvailable: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
