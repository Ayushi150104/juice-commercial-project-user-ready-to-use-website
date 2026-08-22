/**
 * tests/checkout.js
 * Purpose: exercises the REAL checkout controller with persistence stubbed
 * out, so the logic that money depends on is tested without a database.
 * Run: npm run test:checkout
 *
 * What it pins down (each of these was a bug at some point):
 *  - every line is re-priced from the live catalogue; the price stored in the
 *    cart is ignored, so a price change or a soft-deleted product is caught
 *    at checkout instead of being sold at yesterday's price
 *  - two concurrent "Place Order" clicks produce ONE order and ONE payment
 *  - a failed checkout leaves no order, no payment, and gives the cart back
 *  - cancelling refunds the payment so the two documents never disagree
 *
 * tests/offline.js covers the schemas; tests/e2e.js covers real HTTP + Mongo.
 */
/* eslint-disable no-console */
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const CustomizerOption = require("../models/CustomizerOption");

let pass = 0, fail = 0;
const ck = (n, c, x = "") => { if (c) { pass++; console.log("  ✔", n); } else { fail++; console.log("  ✘", n, x); } };

const saved = { orders: new Map(), payments: new Map() };
Order.prototype.save = async function () { saved.orders.set(String(this._id), this); return this; };
Payment.prototype.save = async function () { saved.payments.set(String(this._id), this); return this; };
Order.deleteOne = (q) => { saved.orders.delete(String(q._id)); const p = Promise.resolve({ deletedCount: 1 }); p.catch = () => p; return p; };
const chain = (doc) => { const q = Promise.resolve(doc); q.select = () => Promise.resolve(doc); return q; };
Order.findById = (id) => chain(saved.orders.get(String(id)) || null);
Payment.findById = (id) => chain(saved.payments.get(String(id)) || null);
Payment.findOne = () => chain(null);

const userId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();

// live catalogue the checkout re-prices against
let PRODUCT = { _id: productId, name: "Nimbu Pani", image: "/uploads/products/mocktail1.png", price: 55, isAvailable: true, isDeleted: false };
Product.findOne = async (q) => (PRODUCT && String(q._id) === String(productId) && PRODUCT.isAvailable && !PRODUCT.isDeleted ? PRODUCT : null);
CustomizerOption.find = () => ({ lean: async () => [
  { type: "fruit", label: "🍎 Apple", priceModifier: 20, isAvailable: true },
  { type: "fruit", label: "🥤 Mixed Juice", priceModifier: 120, isAvailable: true },
  { type: "base", label: "🥛 Milk", priceModifier: 0, isAvailable: true },
]});

// server-side cart, backed by an atomic findOneAndUpdate stub
const freshItems = () => [
  { kind: "product", product: productId, name: "Nimbu Pani", image: "x", unitPrice: 55, quantity: 2, toObject() { return { ...this, toObject: undefined }; } },
  { kind: "custom", name: "old name", custom: { fruits: ["🍎 Apple", "🥤 Mixed Juice"], base: ["🥛 Milk"], extras: ["None"] }, unitPrice: 999, quantity: 1, toObject() { return { ...this, toObject: undefined }; } },
];
let CART = freshItems();
let restoreCalls = 0;
Cart.findOneAndUpdate = async (filter) => {
  if (filter["items.0"] && CART.length === 0) return null;   // already claimed
  const snapshot = CART;
  CART = [];
  return { items: snapshot };
};
Cart.updateOne = async (_f, upd) => { restoreCalls++; CART = upd.$set.items; return { modifiedCount: 1 }; };

const orderCtl = require("../controllers/order.controller");

const mkRes = () => { const r = { statusCode: 0, body: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const REQ = () => ({
  user: { id: String(userId), name: "Akash", email: "akash@test.local", role: "customer" },
  ip: "127.0.0.1", headers: { "user-agent": "harness" },
  body: {
    customer: { name: "Akash Kumar", email: "akash@test.local", phone: "9876543210" },
    deliveryAddress: { line1: "12 MG Road", city: "Pune", pincode: "411001" },
    note: "No ice",
  },
});

(async () => {
  console.log("\n=== happy path (re-prices from the live DB) ===");
  const res = mkRes();
  await orderCtl.createOrder(REQ(), res, (e) => { throw e; });
  const { order, payment } = res.body.data;
  ck("201 created", res.statusCode === 201);
  ck("status placed", order.status === "placed");
  ck("product line re-priced from DB (55x2)", order.items[0].unitPrice === 55 && order.items[0].lineTotal === 110);
  ck("custom line RE-PRICED, cart's fake 999 ignored", order.items[1].unitPrice === 140, order.items[1].unitPrice);
  ck("custom name rebuilt from DB labels", order.items[1].name.includes("Apple") && order.items[1].name.includes("Mixed"));
  ck("total = 110 + 140 = 250", order.total === 250, order.total);
  ck("itemCount 3", order.itemCount === 3);
  ck("payment paid + linked", payment.status === "paid" && String(order.payment.paymentId) === String(payment._id));
  ck("cart emptied", CART.length === 0);

  console.log("\n=== concurrent double-click (the high-severity bug) ===");
  CART = freshItems(); saved.orders.clear(); saved.payments.clear(); restoreCalls = 0;
  const run = async () => {
    let caught = null;
    const r = mkRes();
    await orderCtl.createOrder(REQ(), r, (e) => (caught = e));
    return caught ? caught.code || "err" : "ok";
  };
  const results = await Promise.all([run(), run()]);
  const okCount = results.filter((r) => r === "ok").length;
  ck("exactly ONE order created", saved.orders.size === 1, `orders=${saved.orders.size} results=${results}`);
  ck("exactly ONE payment created", saved.payments.size === 1, `payments=${saved.payments.size}`);
  ck("second request rejected with EMPTY_CART", okCount === 1 && results.includes("EMPTY_CART"), String(results));

  console.log("\n=== product deleted between add-to-cart and checkout ===");
  CART = freshItems(); saved.orders.clear(); saved.payments.clear(); restoreCalls = 0;
  PRODUCT = { ...PRODUCT, isDeleted: true };
  let err = null;
  await orderCtl.createOrder(REQ(), mkRes(), (e) => (err = e));
  ck("rejected 404 PRODUCT_UNAVAILABLE", err && err.statusCode === 404 && err.code === "PRODUCT_UNAVAILABLE", err && err.message);
  ck("no order written", saved.orders.size === 0);
  ck("no payment written", saved.payments.size === 0);
  ck("CART RESTORED (customer keeps their items)", CART.length === 2 && restoreCalls === 1, `len=${CART.length} restores=${restoreCalls}`);
  PRODUCT = { ...PRODUCT, isDeleted: false };

  console.log("\n=== price changed after add-to-cart ===");
  CART = freshItems(); saved.orders.clear(); saved.payments.clear();
  PRODUCT = { ...PRODUCT, price: 80 };
  const res5 = mkRes();
  await orderCtl.createOrder(REQ(), res5, (e) => { throw e; });
  ck("charges the NEW price (80x2=160)", res5.body.data.order.items[0].lineTotal === 160, res5.body.data.order.items[0].lineTotal);
  ck("total follows (160+140=300)", res5.body.data.order.total === 300, res5.body.data.order.total);
  PRODUCT = { ...PRODUCT, price: 55 };

  console.log("\n=== empty cart ===");
  CART = [];
  let err2 = null;
  await orderCtl.createOrder(REQ(), mkRes(), (e) => (err2 = e));
  ck("400 EMPTY_CART", err2 && err2.statusCode === 400 && err2.code === "EMPTY_CART");

  console.log("\n=== cancel -> refund ===");
  CART = freshItems(); saved.orders.clear(); saved.payments.clear();
  const resFresh = mkRes();
  await orderCtl.createOrder(REQ(), resFresh, (e) => { throw e; });
  const cancelId = resFresh.body.data.order.id;
  const res6 = mkRes();
  await orderCtl.cancelOrder({ ...REQ(), params: { id: String(cancelId) }, body: { reason: "changed my mind" } }, res6, (e) => { throw e; });
  ck("order cancelled", res6.body.data.order.status === "cancelled");
  ck("payment refunded", res6.body.data.order.payment.status === "refunded");

  console.log(`\n${fail === 0 ? "✅" : "❌"} checkout flow: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(1); });
