/**
 * tests/e2e.js
 * Purpose: end-to-end test of EVERY API endpoint against a running
 * server + real MongoDB. Run: `npm run seed && npm start` in one
 * terminal, then `npm run test:e2e` in another.
 *
 * Covers happy paths, auth/role failures, validation failures,
 * NoSQL-injection and XSS sanitization, image upload, and the full
 * one-click checkout: order + payment written to MongoDB, cart cleared,
 * cancellation refunding the simulated payment.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("../config/env");

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:5000";

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

async function api(method, url, { token, body, cookie, form, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (cookie) opts.headers.Cookie = cookie;
  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON (e.g. static file) */
  }
  return { status: res.status, json, headers: res.headers };
}

function getRefreshCookie(headers) {
  const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
  const jid = cookies.find((c) => c.startsWith("jid="));
  return jid ? jid.split(";")[0] : null;
}

async function main() {
  const stamp = Date.now();
  const customer = {
    name: "Test Customer",
    email: `customer${stamp}@test.local`,
    password: "Passw0rd",
  };

  // ---------------- health ----------------
  console.log("\n[health]");
  {
    const r = await api("GET", "/api/health");
    check("GET /api/health -> 200 ok", r.status === 200 && r.json.status === "ok");
  }

  // ---------------- auth ----------------
  console.log("\n[auth]");
  let accessToken, refreshCookie, userId;
  {
    let r = await api("POST", "/api/auth/register", {
      body: { name: customer.name, email: customer.email, password: "weak" },
    });
    check("register: weak password rejected 400", r.status === 400 && r.json.code === "VALIDATION_ERROR");

    r = await api("POST", "/api/auth/register", { body: customer });
    check("register: 201 + user + accessToken", r.status === 201 && r.json.data.accessToken && r.json.data.user.role === "customer");
    check("register: sets httpOnly refresh cookie", Boolean(getRefreshCookie(r.headers)));
    check("register: rate-limit headers present", r.headers.get("ratelimit-limit") !== null);
    userId = r.json.data.user.id;

    r = await api("POST", "/api/auth/register", { body: customer });
    check("register: duplicate email 409", r.status === 409);

    r = await api("POST", "/api/auth/login", {
      body: { email: customer.email, password: "WrongPass1" },
    });
    check("login: wrong password 401", r.status === 401 && r.json.code === "BAD_CREDENTIALS");

    r = await api("POST", "/api/auth/login", {
      body: { email: { $gt: "" }, password: "Passw0rd" },
    });
    check("login: NoSQL injection payload rejected (no bypass)", r.status === 400 || r.status === 401);

    r = await api("POST", "/api/auth/login", {
      body: { email: customer.email, password: customer.password },
    });
    check("login: 200 + real name returned", r.status === 200 && r.json.data.user.name === customer.name);
    accessToken = r.json.data.accessToken;
    refreshCookie = getRefreshCookie(r.headers);
    check("login: refresh cookie set", Boolean(refreshCookie));

    r = await api("GET", "/api/auth/me");
    check("me: without token 401", r.status === 401);

    r = await api("GET", "/api/auth/me", { token: accessToken });
    check("me: with token 200", r.status === 200 && r.json.data.user.email === customer.email);

    r = await api("GET", "/api/auth/me", { token: accessToken.slice(0, -2) + "xx" });
    check("me: tampered token 401", r.status === 401);

    r = await api("POST", "/api/auth/refresh");
    check("refresh: without cookie 401", r.status === 401);

    r = await api("POST", "/api/auth/refresh", { cookie: refreshCookie });
    check("refresh: rotates + returns new access token", r.status === 200 && Boolean(r.json.data.accessToken));
    const newCookie = getRefreshCookie(r.headers);
    check("refresh: sets a NEW cookie (rotation)", Boolean(newCookie) && newCookie !== refreshCookie);

    r = await api("POST", "/api/auth/refresh", { cookie: refreshCookie });
    check("refresh: OLD cookie rejected after rotation", r.status === 401);
    refreshCookie = newCookie;

    // XSS sanitization on register
    r = await api("POST", "/api/auth/register", {
      body: {
        name: "<script>alert(1)</script>Bobby",
        email: `xss${stamp}@test.local`,
        password: "Passw0rd",
      },
    });
    check(
      "register: XSS payload stripped from stored name",
      r.status === 201 && !r.json.data.user.name.includes("<script>")
    );
  }

  // ---------------- products (public) ----------------
  console.log("\n[products]");
  let productId, productPrice;
  {
    let r = await api("GET", "/api/products");
    check("list products: 200 + 4 seeded juices", r.status === 200 && r.json.data.products.length >= 4);
    const p = r.json.data.products.find((x) => x.name === "Nimbu Pani");
    check("seeded product matches frontend data (₹55 Nimbu Pani)", Boolean(p) && p.price === 55);
    productId = p._id;
    productPrice = p.price;
    check("product has served image URL", typeof p.image === "string" && p.image.startsWith("/uploads/"));

    if (p.image) {
      const img = await fetch(`${BASE}${p.image}`);
      check("product image is actually served from /uploads", img.status === 200 && (img.headers.get("content-type") || "").startsWith("image/"));
    }

    r = await api("GET", "/api/products/000000000000000000000000");
    check("get product: unknown id 404", r.status === 404);

    r = await api("GET", "/api/products/notanid");
    check("get product: malformed id 400", r.status === 400);
  }

  // ---------------- customizer options ----------------
  console.log("\n[customizer]");
  {
    const r = await api("GET", "/api/customizer/options");
    const d = r.json.data;
    check("options: grouped fruits/bases/extras", r.status === 200 && d.fruits.length === 11 && d.bases.length === 3 && d.extras.length === 2);
    const mixed = d.fruits.find((f) => f.label === "🥤 Mixed Juice");
    check("Mixed Juice priced ₹120 (reproduces old formula)", Boolean(mixed) && mixed.priceModifier === 120);
  }

  // ---------------- cart ----------------
  console.log("\n[cart]");
  let cartItemId;
  {
    let r = await api("GET", "/api/cart");
    check("cart: requires auth 401", r.status === 401);

    r = await api("GET", "/api/cart", { token: accessToken });
    check("cart: starts empty", r.status === 200 && r.json.data.cart.items.length === 0);

    r = await api("POST", "/api/cart/items", {
      token: accessToken,
      body: { kind: "product", productId, quantity: 2 },
    });
    check("cart: add product item", r.status === 200 && r.json.data.cart.items.length === 1);
    check("cart: server-side price used (client sent none)", r.json.data.cart.items[0].price === productPrice);
    check("cart: total = price × qty", r.json.data.cart.total === productPrice * 2);
    cartItemId = r.json.data.cart.items[0].id;

    r = await api("POST", "/api/cart/items", {
      token: accessToken,
      body: { kind: "product", productId, quantity: 1 },
    });
    check("cart: same product merges to qty 3", r.status === 200 && r.json.data.cart.items.length === 1 && r.json.data.cart.items[0].quantity === 3);

    r = await api("POST", "/api/cart/items", {
      token: accessToken,
      body: {
        kind: "custom",
        fruits: ["🍎 Apple", "🥤 Mixed Juice"],
        base: ["🥛 Milk"],
        extras: ["🍯 Honey"],
      },
    });
    const custom = r.json.data.cart.items.find((i) => i.kind === "custom");
    check("cart: add custom juice", r.status === 200 && Boolean(custom));
    check("cart: custom juice priced server-side ₹140 (20+120)", custom && custom.price === 140);

    r = await api("POST", "/api/cart/items", {
      token: accessToken,
      body: { kind: "custom", fruits: ["🍕 Pizza"] },
    });
    check("cart: unknown option rejected 400", r.status === 400 && r.json.code === "UNKNOWN_OPTION");

    r = await api("POST", "/api/cart/items", {
      token: accessToken,
      body: { kind: "product", productId, quantity: 0 },
    });
    check("cart: quantity 0 rejected 400", r.status === 400);

    r = await api("PUT", `/api/cart/items/${cartItemId}`, {
      token: accessToken,
      body: { quantity: 5 },
    });
    check("cart: update quantity", r.status === 200 && r.json.data.cart.items[0].quantity === 5);

    r = await api("DELETE", `/api/cart/items/${cartItemId}`, { token: accessToken });
    check("cart: remove item", r.status === 200 && r.json.data.cart.items.length === 1);

    // merge (guest cart absorption)
    r = await api("POST", "/api/cart/merge", {
      token: accessToken,
      body: {
        items: [
          { kind: "product", productId, quantity: 1 },
          { kind: "custom", fruits: ["🍌 Banana"] },
          { kind: "product", productId: "000000000000000000000000", quantity: 1 },
        ],
      },
    });
    check(
      "cart: merge adds valid items, skips dead product",
      r.status === 200 && r.json.data.skipped === 1 && r.json.data.cart.items.length === 3
    );
  }

  // ---------------- orders + payment (mock gateway) ----------------
  console.log("\n[orders/payment]");
  let db;
  let placedOrderId;
  const DELIVERY = {
    customer: { name: "Test Customer", email: "customer@test.local", phone: "9876543210" },
    deliveryAddress: {
      line1: "12 MG Road",
      line2: "Flat 4B",
      landmark: "Near the park",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    },
    note: "No ice please",
  };
  {
    let r = await api("GET", "/api/payment/config");
    check(
      "payment config: mock mode, no keys needed",
      r.status === 200 && r.json.data.configured === true && r.json.data.mode === "mock"
    );
    check("payment config: no redirect required", r.json.data.requiresRedirect === false);

    r = await api("POST", "/api/orders", { body: DELIVERY });
    check("create order: requires auth 401", r.status === 401);

    // validation of the delivery form
    r = await api("POST", "/api/orders", {
      token: accessToken,
      body: { ...DELIVERY, customer: { ...DELIVERY.customer, phone: "abc" } },
    });
    check("create order: bad phone rejected 400", r.status === 400 && r.json.code === "VALIDATION_ERROR");

    r = await api("POST", "/api/orders", {
      token: accessToken,
      body: { ...DELIVERY, deliveryAddress: { ...DELIVERY.deliveryAddress, pincode: "xx" } },
    });
    check("create order: bad pincode rejected 400", r.status === 400);

    r = await api("POST", "/api/orders", {
      token: accessToken,
      body: { customer: DELIVERY.customer },
    });
    check("create order: missing address rejected 400", r.status === 400);

    // the cart currently holds: product x1, custom Banana, custom Mixed Juice
    const cartBefore = await api("GET", "/api/cart", { token: accessToken });
    const expectedTotal = cartBefore.json.data.cart.total;
    check("cart has items before checkout", cartBefore.json.data.cart.items.length > 0);

    // ---- THE BUTTON: one request does everything ----
    r = await api("POST", "/api/orders", { token: accessToken, body: DELIVERY });
    check("place order: 201 created", r.status === 201, JSON.stringify(r.json).slice(0, 200));

    const order = r.json && r.json.data && r.json.data.order;
    const payment = r.json && r.json.data && r.json.data.payment;
    check("place order: order returned", Boolean(order));
    check("place order: payment record returned in the same response", Boolean(payment));

    if (order && payment) {
      placedOrderId = order.id;
      check("order status is 'placed'", order.status === "placed");
      check("order total matches the cart", order.total === expectedTotal, `${order.total} vs ${expectedTotal}`);
      check("order has an order number", /^JU-\d+-[0-9A-F]{6}$/.test(order.orderNumber));

      // customer details stored
      check("order stores customer name", order.customer.name === DELIVERY.customer.name);
      check("order stores customer phone", order.customer.phone === DELIVERY.customer.phone);
      check("order stores customer email", order.customer.email === DELIVERY.customer.email);

      // address stored
      const a = order.deliveryAddress;
      check("order stores address line1", a.line1 === DELIVERY.deliveryAddress.line1);
      check("order stores landmark", a.landmark === DELIVERY.deliveryAddress.landmark);
      check("order stores city/state/pincode",
        a.city === "Pune" && a.state === "Maharashtra" && a.pincode === "411001");
      check("order stores the kitchen note", order.note === DELIVERY.note);

      // money breakdown stored
      check("order stores subtotal", typeof order.subtotal === "number");
      check("order stores deliveryFee", typeof order.deliveryFee === "number");
      check("order stores tax", typeof order.tax === "number");
      check("order stores itemCount", order.itemCount > 0);
      check("subtotal + fee + tax === total",
        order.subtotal + order.deliveryFee + order.tax === order.total);
      check("every line has its own lineTotal",
        order.items.every((i) => i.lineTotal === i.unitPrice * i.quantity));
      check("custom juice selections snapshotted",
        order.items.some((i) => i.kind === "custom" && i.custom && i.custom.fruits.length > 0));

      // payment stored
      check("payment status is paid", payment.status === "paid");
      check("payment has a transaction id", /^TXN-\d+-[0-9A-F]{6}$/.test(payment.transactionId));
      check("payment has a reference", /^PAY-\d+-[0-9A-F]{6}$/.test(payment.paymentRef));
      check("payment amount === order total", payment.amount === order.total);
      check("payment gateway recorded", payment.gateway === "mock-gateway");
      check("payment paidAt recorded", Boolean(payment.paidAt));
      check("payment audit trail has initiated + paid",
        payment.attempts.length === 2 && payment.attempts[1].status === "paid");
      check("payment snapshots the customer", payment.customer.phone === DELIVERY.customer.phone);
      check("payment records the request IP/user-agent", payment.meta !== undefined);

      // order <-> payment linkage
      check("order carries the payment txn id", order.payment.transactionId === payment.transactionId);
      check("order carries the payment id", String(order.payment.paymentId) === String(payment._id));
      check("order payment status is paid", order.payment.status === "paid");

      // status timeline
      check("status timeline recorded", order.statusHistory.length >= 2);
      check("timeline ends at 'placed'",
        order.statusHistory[order.statusHistory.length - 1].status === "placed");
      check("placedAt timestamp set", Boolean(order.placedAt));
    }

    r = await api("GET", "/api/cart", { token: accessToken });
    check("cart cleared after checkout", r.json.data.cart.items.length === 0);

    r = await api("POST", "/api/orders", { token: accessToken, body: DELIVERY });
    check("empty cart cannot be ordered 400", r.status === 400 && r.json.code === "EMPTY_CART");

    // history + single order
    r = await api("GET", "/api/orders/my", { token: accessToken });
    check("history: the order is listed", r.status === 200 && r.json.data.orders.some((o) => o.id === placedOrderId));
    check("history: full detail included",
      r.json.data.orders[0].deliveryAddress && r.json.data.orders[0].payment.transactionId);

    r = await api("GET", `/api/orders/${placedOrderId}`, { token: accessToken });
    check("get order by id returns order + payment", r.status === 200 && Boolean(r.json.data.payment));

    // payment endpoints
    r = await api("GET", "/api/payment/my", { token: accessToken });
    check("payment history: at least one paid record", r.status === 200 && r.json.data.payments.length >= 1);
    const paymentId = r.json.data.payments[0]._id;

    r = await api("GET", `/api/payment/${paymentId}`, { token: accessToken });
    check("get payment by id (owner)", r.status === 200 && r.json.data.payment.status === "paid");

    // ---- verify the rows really are in MongoDB, not just in the response ----
    db = await mongoose.connect(process.env.MONGODB_URI);
    const OrderModel = require("../models/Order");
    const PaymentModel = require("../models/Payment");

    const dbOrder = await OrderModel.findById(placedOrderId).lean();
    check("DB: order document exists", Boolean(dbOrder));
    check("DB: customer phone persisted", dbOrder && dbOrder.customer.phone === DELIVERY.customer.phone);
    check("DB: delivery address persisted", dbOrder && dbOrder.deliveryAddress.pincode === "411001");
    check("DB: status history persisted", dbOrder && dbOrder.statusHistory.length >= 2);

    const dbPayment = await PaymentModel.findOne({ order: placedOrderId }).lean();
    check("DB: payment document exists in its own collection", Boolean(dbPayment));
    check("DB: payment linked to the order number",
      dbPayment && dbPayment.orderNumber === dbOrder.orderNumber);
    check("DB: payment is paid with a paidAt timestamp",
      dbPayment && dbPayment.status === "paid" && Boolean(dbPayment.paidAt));

    // ---- ownership ----
    const other = await api("POST", "/api/auth/register", {
      body: { name: "Other Person", email: `other${stamp}@test.local`, password: "Passw0rd" },
    });
    const otherToken = other.json.data.accessToken;
    r = await api("GET", `/api/orders/${placedOrderId}`, { token: otherToken });
    check("another user cannot read this order 403", r.status === 403);
    r = await api("GET", `/api/payment/${paymentId}`, { token: otherToken });
    check("another user cannot read this payment 403", r.status === 403);
    r = await api("PATCH", `/api/orders/${placedOrderId}/cancel`, { token: otherToken });
    check("another user cannot cancel this order 403", r.status === 403);
  }

  // ---------------- admin ----------------
  console.log("\n[admin]");
  {
    let r = await api("GET", "/api/admin/stats", { token: accessToken });
    check("admin routes: customer blocked 403", r.status === 403);

    r = await api("POST", "/api/auth/login", {
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    check("admin login (seeded account)", r.status === 200 && r.json.data.user.role === "admin");
    const adminToken = r.json.data.accessToken;

    r = await api("GET", "/api/admin/stats", { token: adminToken });
    check("admin stats: revenue comes from the Payment collection",
      r.status === 200 && r.json.data.paidOrders >= 1 && r.json.data.revenue > 0);
    check("admin stats: gross/net revenue reported",
      typeof r.json.data.netRevenue === "number" && typeof r.json.data.grossRevenue === "number");

    r = await api("GET", "/api/admin/payments", { token: adminToken });
    check("admin: list payments", r.status === 200 && r.json.data.payments.length >= 1);
    check("admin: payment rows carry the customer", Boolean(r.json.data.payments[0].user));

    r = await api("GET", "/api/admin/payments?status=paid", { token: adminToken });
    check("admin: filter payments by status",
      r.status === 200 && r.json.data.payments.every((p) => p.status === "paid"));

    r = await api("GET", `/api/admin/orders?q=${encodeURIComponent("9876543210")}`, { token: adminToken });
    check("admin: search orders by customer phone", r.status === 200 && r.json.data.orders.length >= 1);

    r = await api("GET", "/api/admin/orders?status=placed", { token: adminToken });
    check("admin: list orders w/ pagination + user populated", r.status === 200 && r.json.data.orders.length >= 1 && Boolean(r.json.data.orders[0].user.email));
    const placedOrder = r.json.data.orders[0];

    r = await api("PATCH", `/api/admin/orders/${placedOrder._id}/status`, {
      token: adminToken,
      body: { status: "preparing" },
    });
    check("admin: update order status", r.status === 200 && r.json.data.order.status === "preparing");

    r = await api("PATCH", `/api/admin/orders/${placedOrder._id}/status`, {
      token: adminToken,
      body: { status: "not-a-status" },
    });
    check("admin: invalid status rejected 400", r.status === 400);

    r = await api("PATCH", `/api/admin/orders/${placedOrder._id}/status`, {
      token: adminToken,
      body: { status: "placed" },
    });
    check("admin: cannot move an order backwards 400",
      r.status === 400 && r.json.code === "INVALID_TRANSITION");

    r = await api("PATCH", `/api/admin/orders/${placedOrder._id}/status`, {
      token: adminToken,
      body: { status: "out_for_delivery", note: "rider assigned" },
    });
    check("admin: advance to out_for_delivery", r.status === 200 && r.json.data.order.status === "out_for_delivery");
    check("admin: status note recorded on the timeline",
      r.json.data.order.statusHistory.some((h) => h.note === "rider assigned" && h.by === "admin"));

    r = await api("PATCH", `/api/orders/${placedOrder._id}/cancel`, { token: accessToken });
    check("customer cannot cancel an order already out for delivery 400",
      r.status === 400 && r.json.code === "NOT_CANCELLABLE");

    r = await api("GET", "/api/admin/users", { token: adminToken });
    check("admin: list users (no password/refresh leakage)", r.status === 200 && r.json.data.users.length >= 2 && r.json.data.users.every((u) => u.password === undefined && u.refreshTokens === undefined));

    // product CRUD with real image upload
    const imgPath = path.join(__dirname, "..", "uploads", "products", "mocktail1.png");
    const buf = fs.readFileSync(imgPath);
    let form = new FormData();
    form.append("name", "Guava Fresh");
    form.append("price", "45");
    form.append("address", "Test Lane 9");
    form.append("time", "10 min");
    form.append("image", new Blob([buf], { type: "image/png" }), "guava.png");

    r = await api("POST", "/api/products", { token: adminToken, form });
    check("admin: create product with image upload", r.status === 201 && r.json.data.product.image.startsWith("/uploads/products/"));
    const newProd = r.json.data.product;

    const served = await fetch(`${BASE}${newProd.image}`);
    check("admin: uploaded image served back", served.status === 200);

    form = new FormData();
    form.append("image", new Blob([Buffer.from("hello")], { type: "text/plain" }), "evil.txt");
    form.append("name", "X");
    form.append("price", "1");
    r = await api("POST", "/api/products", { token: adminToken, form });
    check("admin: non-image upload rejected 400", r.status === 400);

    r = await api("PUT", `/api/products/${newProd._id}`, {
      token: adminToken,
      body: { price: 48, isAvailable: true },
    });
    check("admin: update product price", r.status === 200 && r.json.data.product.price === 48);

    r = await api("POST", "/api/products", { token: accessToken, body: { name: "Hack", price: 1 } });
    check("customer cannot create products 403", r.status === 403);

    // customizer option CRUD
    r = await api("POST", "/api/customizer/options", {
      token: adminToken,
      body: { type: "fruit", label: "🍑 Peach", priceModifier: 25 },
    });
    check("admin: create customizer option", r.status === 201);
    const optId = r.json.data.option._id;

    r = await api("PUT", `/api/customizer/options/${optId}`, {
      token: adminToken,
      body: { priceModifier: 30 },
    });
    check("admin: update option", r.status === 200 && r.json.data.option.priceModifier === 30);

    r = await api("DELETE", `/api/customizer/options/${optId}`, { token: adminToken });
    check("admin: delete option", r.status === 200);

    // soft delete product -> vanishes from public list, cart add blocked
    r = await api("DELETE", `/api/products/${newProd._id}`, { token: adminToken });
    check("admin: soft-delete product", r.status === 200);

    r = await api("GET", "/api/products");
    check("soft-deleted product hidden from public list", !r.json.data.products.some((p) => p._id === newProd._id));

    r = await api("POST", "/api/cart/items", {
      token: accessToken,
      body: { kind: "product", productId: newProd._id, quantity: 1 },
    });
    check("soft-deleted product cannot be added to cart 404", r.status === 404);

    // user deactivation cuts off live tokens
    r = await api("PATCH", `/api/admin/users/${userId}`, {
      token: adminToken,
      body: { isActive: false },
    });
    check("admin: deactivate user", r.status === 200 && r.json.data.user.isActive === false);

    r = await api("GET", "/api/auth/me", { token: accessToken });
    check("deactivated user's valid JWT now rejected 401", r.status === 401);

    r = await api("PATCH", `/api/admin/users/${userId}`, {
      token: adminToken,
      body: { isActive: true },
    });
    check("admin: reactivate user", r.status === 200);

    // self-deactivation guard
    const adminId = (await api("GET", "/api/auth/me", { token: adminToken })).json.data.user.id;
    r = await api("PATCH", `/api/admin/users/${adminId}`, {
      token: adminToken,
      body: { isActive: false },
    });
    check("admin cannot deactivate self 400", r.status === 400);

    r = await api("PATCH", `/api/admin/users/${adminId}`, {
      token: adminToken,
      body: { role: "customer" },
    });
    check("admin cannot demote self 400", r.status === 400);
  }

  // ---------------- cancel + refund ----------------
  console.log("\n[cancel + refund]");
  {
    const products = await api("GET", "/api/products");
    const pid = products.json.data.products[0]._id;
    await api("POST", "/api/cart/items", {
      token: accessToken,
      body: { kind: "product", productId: pid, quantity: 1 },
    });

    let r = await api("POST", "/api/orders", { token: accessToken, body: DELIVERY });
    check("second order placed", r.status === 201);
    const o = r.json.data.order;

    r = await api("PATCH", `/api/orders/${o.id}/cancel`, {
      token: accessToken,
      body: { reason: "changed my mind" },
    });
    check("customer can cancel a freshly placed order", r.status === 200 && r.json.data.order.status === "cancelled");
    check("cancelling refunds the simulated payment", r.json.data.order.payment.status === "refunded");
    check("cancellation reason stored on the timeline",
      r.json.data.order.statusHistory.some((h) => h.note === "changed my mind" && h.by === "customer"));
    check("cancelledAt stamped", Boolean(r.json.data.order.cancelledAt));

    const PaymentModel = require("../models/Payment");
    const dbPay = await PaymentModel.findById(o.payment.paymentId).lean();
    check("DB: payment marked refunded with a timestamp",
      Boolean(dbPay) && dbPay.status === "refunded" && Boolean(dbPay.refundedAt));
    check("DB: refund appended to the audit trail",
      Boolean(dbPay) && dbPay.attempts[dbPay.attempts.length - 1].status === "refunded");

    r = await api("PATCH", `/api/orders/${o.id}/cancel`, { token: accessToken });
    check("cancelling twice is idempotent (200, still cancelled)",
      r.status === 200 && r.json.data.order.status === "cancelled");
  }

  // ---------------- misc security ----------------
  console.log("\n[security misc]");
  {
    let r = await api("GET", "/api/nope");
    check("unknown route 404 JSON", r.status === 404 && r.json.success === false);

    r = await api("GET", "/api/health", { headers: { Origin: "http://evil.example" } });
    check("CORS: unknown origin blocked 403", r.status === 403);

    const res = await fetch(`${BASE}/api/health`);
    check("helmet headers present", res.headers.get("x-content-type-options") === "nosniff");
    check("x-powered-by hidden", res.headers.get("x-powered-by") === null);

    // logout invalidates refresh cookie
    const login = await api("POST", "/api/auth/login", {
      body: { email: customer.email, password: customer.password },
    });
    const cookie = getRefreshCookie(login.headers);
    r = await api("POST", "/api/auth/logout", { cookie });
    check("logout 200", r.status === 200);
    r = await api("POST", "/api/auth/refresh", { cookie });
    check("refresh after logout rejected 401", r.status === 401);
  }

  console.log(`\n========== RESULT: ${passed} passed, ${failed} failed ==========`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(" -", f));
  }
  if (db) await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
