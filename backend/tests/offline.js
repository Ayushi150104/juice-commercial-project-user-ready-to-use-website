/**
 * tests/offline.js
 * Purpose: sanity checks that need NO database and NO running server.
 * Run: npm run test:offline
 *
 * Covers what breaks most often after a refactor:
 *  - every module loads and every route mounts
 *  - the Order / Payment schemas accept a valid checkout and reject a
 *    broken one (mongoose validates in memory, no connection needed)
 *  - the document hooks and helper methods behave
 *  - the money maths in price.service
 *
 * The full request/response flow is covered by tests/e2e.js, which
 * needs a running server + MongoDB.
 */
/* eslint-disable no-console */
const mongoose = require("mongoose");

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    failures.push(name + (extra ? ` — ${extra}` : ""));
    console.log(`  ✘ ${name} ${extra}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------- modules
section("modules load");

const app = require("../server");
check("server.js exports an express app", typeof app === "function");

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Cart = require("../models/Cart");
const User = require("../models/User");
const Product = require("../models/Product");
const CustomizerOption = require("../models/CustomizerOption");
const priceService = require("../services/price.service");
const paymentService = require("../services/payment.service");

check(
  "all six models registered",
  ["Order", "Payment", "Cart", "User", "Product", "CustomizerOption"].every((m) =>
    mongoose.modelNames().includes(m)
  ),
  mongoose.modelNames().join(",")
);
void Cart, User, Product, CustomizerOption;

// ---------------------------------------------------------------- routes
section("route table");

function routeList(stack, prefix = "") {
  const out = [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .join("|");
      out.push(`${methods} ${prefix}${layer.route.path}`);
    } else if (layer.name === "router" && layer.handle.stack) {
      const src = layer.regexp.source
        .replace("^\\/", "/")
        .replace("\\/?(?=\\/|$)", "")
        .replace(/\\\//g, "/")
        .replace(/\$$/, "");
      out.push(...routeList(layer.handle.stack, prefix + src));
    }
  }
  return out;
}

const routes = routeList(app._router.stack);
routes.forEach((r) => console.log("   ", r));

const expected = [
  "POST /api/orders/",
  "GET /api/orders/my",
  "GET /api/payment/config",
  "GET /api/payment/my",
  "GET /api/admin/payments",
  "POST /api/cart/merge",
];
for (const r of expected) {
  check(`route mounted: ${r}`, routes.includes(r));
}
check(
  "no /payment/verify route left behind",
  !routes.some((r) => r.includes("/verify"))
);

// ---------------------------------------------------------------- pricing
section("price.service.quoteTotals");

const lines = [
  { unitPrice: 55, quantity: 2 },
  { unitPrice: 40, quantity: 1 },
];
const t = priceService.quoteTotals(lines);
check("subtotal = 150", t.subtotal === 150, String(t.subtotal));
check("itemCount = 3", t.itemCount === 3, String(t.itemCount));
check("total = subtotal + fee + tax", t.total === t.subtotal + t.deliveryFee + t.tax);
check("empty cart totals to 0", priceService.quoteTotals([]).total === 0);
check("money() rounds to 2dp", priceService.money(12.005) === 12.01);
check("money() kills float drift", priceService.money(0.1 + 0.2) === 0.3);

// ---------------------------------------------------------------- payment
section("payment.service (mock gateway)");

check("mock gateway needs no API keys", paymentService.isConfigured() === true);
check("gateway name exposed", paymentService.GATEWAY === "mock-gateway");
check("charge() exists", typeof paymentService.charge === "function");
check("refund() exists", typeof paymentService.refund === "function");

// ---------------------------------------------------------------- Payment doc
section("Payment schema");

const payment = new Payment({
  order: new mongoose.Types.ObjectId(),
  orderNumber: "JU-TEST-0001",
  user: new mongoose.Types.ObjectId(),
  customer: { name: "Akash", email: "a@b.com", phone: "9876543210" },
  amount: 150,
});
payment.recordStatus("initiated", "Checkout started");
payment.recordStatus("paid", "Simulated payment approved");

check("paymentRef generated at construction", /^PAY-\d+-[0-9A-F]{6}$/.test(payment.paymentRef || ""), payment.paymentRef);
check("transactionId generated at construction", /^TXN-\d+-[0-9A-F]{6}$/.test(payment.transactionId || ""), payment.transactionId);
check("status is paid", payment.status === "paid");
check("paidAt stamped", payment.paidAt instanceof Date);
check("audit trail has 2 attempts", payment.attempts.length === 2);
check("attempt order preserved", payment.attempts[0].status === "initiated" && payment.attempts[1].status === "paid");
check("defaults: gateway + method + currency",
  payment.gateway === "mock-gateway" && payment.method === "mock" && payment.currency === "INR");
check("Payment validates", payment.validateSync() === undefined,
  String(payment.validateSync()));

const refunded = new Payment({
  order: new mongoose.Types.ObjectId(),
  orderNumber: "JU-TEST-0002",
  user: new mongoose.Types.ObjectId(),
  amount: 10,
});
refunded.recordStatus("refunded", "cancelled");
check("refundedAt stamped on refund", refunded.refundedAt instanceof Date);

const badPayment = new Payment({ orderNumber: "x", amount: -5 });
check("Payment rejects missing order/user and negative amount",
  badPayment.validateSync() !== undefined);

// ---------------------------------------------------------------- Order doc
section("Order schema");

const validOrder = new Order({
  user: new mongoose.Types.ObjectId(),
  customer: { name: "Akash", email: "AKASH@Example.com", phone: "9876543210" },
  deliveryAddress: {
    line1: "12 MG Road",
    city: "Pune",
    pincode: "411001",
  },
  note: "no ice",
  items: [
    {
      kind: "product",
      product: new mongoose.Types.ObjectId(),
      name: "Nimbu Pani",
      image: "/uploads/products/mocktail1.png",
      unitPrice: 55,
      quantity: 2,
      lineTotal: 110,
    },
    {
      kind: "custom",
      name: "🍎 Apple + 🥭 Mango",
      custom: { fruits: ["🍎 Apple", "🥭 Mango"], base: ["💧 Water"], extras: ["None"] },
      unitPrice: 40,
      quantity: 1,
      lineTotal: 40,
    },
  ],
  subtotal: 150,
  deliveryFee: 0,
  tax: 0,
  total: 150,
  itemCount: 3,
});

validOrder.setStatus("pending_payment", { note: "Checkout started" });
validOrder.payment = {
  paymentId: payment._id,
  method: payment.method,
  gateway: payment.gateway,
  status: payment.status,
  paymentRef: payment.paymentRef,
  transactionId: payment.transactionId,
  amount: payment.amount,
  paidAt: payment.paidAt,
};
validOrder.setStatus("placed", { note: `Paid (${payment.transactionId})` });

const orderErr = validOrder.validateSync();
check("Order validates", orderErr === undefined, String(orderErr));
check("orderNumber generated at construction", /^JU-\d+-[0-9A-F]{6}$/.test(validOrder.orderNumber || ""), validOrder.orderNumber);
check("email lowercased", validOrder.customer.email === "akash@example.com");
check("status timeline recorded", validOrder.statusHistory.length === 2);
check("placedAt stamped", validOrder.placedAt instanceof Date);
check("payment summary linked", String(validOrder.payment.paymentId) === String(payment._id));
check("payment txn id copied onto order", validOrder.payment.transactionId === payment.transactionId);
check("custom juice selections stored", validOrder.items[1].custom.fruits.length === 2);
check("per-line totals stored", validOrder.items[0].lineTotal === 110);
check("currency defaults to INR", validOrder.currency === "INR");

// every field the checkout form collects must survive onto the document
const stored = validOrder.toObject();
const mustExist = [
  "orderNumber", "user", "customer.name", "customer.email", "customer.phone",
  "deliveryAddress.line1", "deliveryAddress.city", "deliveryAddress.pincode",
  "note", "items", "subtotal", "deliveryFee", "tax", "total", "currency",
  "itemCount", "status", "statusHistory", "payment.paymentId",
  "payment.transactionId", "payment.paymentRef", "payment.status",
  "payment.amount", "payment.paidAt", "placedAt",
];
const dig = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
for (const path of mustExist) {
  check(`order stores ${path}`, dig(stored, path) !== undefined && dig(stored, path) !== null);
}

section("Order schema rejects bad input");

const noAddress = new Order({
  user: new mongoose.Types.ObjectId(),
  customer: { name: "A", email: "a@b.com", phone: "1" },
  items: [{ kind: "product", name: "x", unitPrice: 1, quantity: 1, lineTotal: 1 }],
  subtotal: 1, total: 1,
});
check("order without delivery address is rejected", noAddress.validateSync() !== undefined);

const noItems = new Order({
  user: new mongoose.Types.ObjectId(),
  customer: { name: "A", email: "a@b.com", phone: "1" },
  deliveryAddress: { line1: "x road", city: "Pune", pincode: "411001" },
  items: [],
  subtotal: 0, total: 0,
});
check("empty order is rejected", noItems.validateSync() !== undefined);

const badStatus = new Order({
  user: new mongoose.Types.ObjectId(),
  customer: { name: "A", email: "a@b.com", phone: "1" },
  deliveryAddress: { line1: "x road", city: "Pune", pincode: "411001" },
  items: [{ kind: "product", name: "x", unitPrice: 1, quantity: 1, lineTotal: 1 }],
  subtotal: 1, total: 1,
  status: "shipped_to_mars",
});
check("unknown order status is rejected", badStatus.validateSync() !== undefined);

// ---------------------------------------------------------------- result
console.log(
  `\n${failed === 0 ? "✅" : "❌"} offline checks: ${passed} passed, ${failed} failed`
);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(failed === 0 ? 0 : 1);
