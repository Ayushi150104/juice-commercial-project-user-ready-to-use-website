/**
 * services/price.service.js
 * Purpose: ALL prices are computed here, server-side, from the database.
 * The client sends selections, never prices — replicating (and now
 * enforcing) the old client formula: each fruit ₹20, "Mixed Juice" ₹120,
 * bases/extras free. These values live in the customizeroptions
 * collection, so admins can change them without code.
 *
 * quoteTotals() is the single place the order money breakdown is decided,
 * so the cart, the order and any future invoice can never disagree.
 */
const CustomizerOption = require("../models/CustomizerOption");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

/** Rounds to 2 decimals without float drift (₹12.005 -> 12.01). */
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Validates a custom juice selection against DB options and returns
 * { price, fruits, base, extras } with canonical labels.
 */
async function priceCustomJuice({ fruits = [], base = [], extras = [] }) {
  if (!Array.isArray(fruits) || fruits.length === 0) {
    throw ApiError.badRequest("Select at least one fruit", {
      code: "NO_FRUITS",
    });
  }

  const options = await CustomizerOption.find({ isAvailable: true }).lean();
  const byType = { fruit: new Map(), base: new Map(), extra: new Map() };
  for (const opt of options) {
    byType[opt.type].set(opt.label, opt);
  }

  const resolve = (labels, type) =>
    labels.map((label) => {
      const opt = byType[type].get(label);
      if (!opt) {
        throw ApiError.badRequest(`Unknown ${type} option: ${label}`, {
          code: "UNKNOWN_OPTION",
        });
      }
      return opt;
    });

  const fruitOpts = resolve(fruits, "fruit");
  const baseOpts = resolve(base, "base");
  const extraOpts = resolve(extras, "extra");

  const price = [...fruitOpts, ...baseOpts, ...extraOpts].reduce(
    (sum, o) => sum + o.priceModifier,
    0
  );

  return {
    price: money(price),
    fruits: fruitOpts.map((o) => o.label),
    base: baseOpts.length ? baseOpts.map((o) => o.label) : ["None"],
    extras: extraOpts.length ? extraOpts.map((o) => o.label) : ["None"],
  };
}

/** Loads a purchasable product or throws. */
async function getPurchasableProduct(productId) {
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    isAvailable: true,
  });
  if (!product) {
    throw ApiError.notFound("Product not found or unavailable", {
      code: "PRODUCT_UNAVAILABLE",
    });
  }
  return product;
}

/**
 * Turns a list of {unitPrice, quantity} lines into the money breakdown
 * that gets frozen onto the order.
 */
function quoteTotals(lines) {
  const subtotal = money(
    lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  );
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  const { deliveryFee: fee, freeDeliveryAbove, taxPercent } = env.store;
  const deliveryFee =
    subtotal <= 0 || (freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove)
      ? 0
      : money(fee);

  const tax = money((subtotal * taxPercent) / 100);
  const total = money(subtotal + deliveryFee + tax);

  return { subtotal, deliveryFee, tax, total, itemCount };
}

module.exports = {
  priceCustomJuice,
  getPurchasableProduct,
  quoteTotals,
  money,
};
