/**
 * models/CustomizerOption.js
 * Purpose: replaces the hardcoded fruits/bases/extras arrays in
 * src/component/CustomizerPanel.jsx. priceModifier reproduces the
 * frontend formula server-side (fruit=20, "Mixed Juice"=120, others 0).
 */
const mongoose = require("mongoose");

const customizerOptionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["fruit", "base", "extra"],
      required: true,
      index: true,
    },
    // Label exactly as rendered in the UI chips (emoji included)
    label: { type: String, required: true, trim: true, maxlength: 60 },
    priceModifier: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A label must be unique within its type
customizerOptionSchema.index({ type: 1, label: 1 }, { unique: true });

module.exports = mongoose.model("CustomizerOption", customizerOptionSchema);
