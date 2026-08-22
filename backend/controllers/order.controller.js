/**
 * controllers/order.controller.js
 * Purpose: checkout + history.
 *
 * Checkout is ONE request — POST /api/orders. There is no real payment
 * gateway and no redirect. Pressing the button:
 *   1. CLAIMS the cart atomically (one findOneAndUpdate that empties it and
 *      returns the pre-update contents) so two concurrent clicks cannot
 *      produce two orders from the same items,
 *   2. RE-PRICES every line from the live database — the cart's stored
 *      unitPrice is never trusted, so a price change or a soft-deleted
 *      product is caught at checkout instead of being sold at a stale price,
 *   3. writes the Order document with customer + address + breakdown,
 *   4. writes a Payment document via the mock gateway (status "paid"),
 *   5. links the two and moves the order to "placed".
 *
 * Every write from step 3 onwards is inside one try/catch: if anything
 * fails the order is deleted, the payment is marked failed and the cart is
 * put back exactly as it was, so Order and Payment can never disagree and
 * the customer never loses their cart.
 */
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Cart = require("../models/Cart");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const paymentService = require("../services/payment.service");
const {
  quoteTotals,
  getPurchasableProduct,
  priceCustomJuice,
} = require("../services/price.service");
const env = require("../config/env");
const logger = require("../utils/logger");

/** Shapes an order for the client (history panel + confirmation screen). */
function serializeOrder(order) {
  const o = order.toObject ? order.toObject() : order;
  return {
    id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    statusHistory: o.statusHistory,
    customer: o.customer,
    deliveryAddress: o.deliveryAddress,
    note: o.note,
    items: o.items,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    tax: o.tax,
    total: o.total,
    currency: o.currency,
    itemCount: o.itemCount,
    payment: o.payment,
    placedAt: o.placedAt,
    cancelledAt: o.cancelledAt,
    deliveredAt: o.deliveredAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Rebuilds one order line from the LIVE database.
 * The cart only supplies the selection (which product, which fruits, how
 * many) — never the money.
 */
async function repriceLine(cartItem) {
  if (cartItem.kind === "product") {
    // throws PRODUCT_UNAVAILABLE if it was deleted or turned off meanwhile
    const product = await getPurchasableProduct(cartItem.product);
    return {
      kind: "product",
      product: product._id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity: cartItem.quantity,
      lineTotal: product.price * cartItem.quantity,
    };
  }

  const selection = cartItem.custom || {};
  const priced = await priceCustomJuice({
    fruits: selection.fruits || [],
    base: (selection.base || []).filter((b) => b !== "None"),
    extras: (selection.extras || []).filter((e) => e !== "None"),
  });
  return {
    kind: "custom",
    product: null,
    name: priced.fruits.join(" + "),
    image: "",
    custom: { fruits: priced.fruits, base: priced.base, extras: priced.extras },
    unitPrice: priced.price,
    quantity: cartItem.quantity,
    lineTotal: priced.price * cartItem.quantity,
  };
}

/** Puts a claimed cart back after a failed checkout. */
async function restoreCart(userId, items) {
  try {
    await Cart.updateOne({ user: userId }, { $set: { items } });
  } catch (err) {
    logger.error(`[order] could not restore cart for ${userId}: ${err.message}`);
  }
}

// POST /api/orders — place the order and record the (mock) payment
const createOrder = asyncHandler(async (req, res) => {
  // ---- 1. claim the cart atomically ----
  // Emptying and reading in one operation means a second concurrent request
  // sees an empty cart and is rejected, instead of duplicating the order.
  const claimed = await Cart.findOneAndUpdate(
    { user: req.user.id, "items.0": { $exists: true } },
    { $set: { items: [] } },
    { new: false }
  );
  if (!claimed) {
    throw ApiError.badRequest("Your cart is empty", { code: "EMPTY_CART" });
  }
  const claimedItems = claimed.items.map((i) => i.toObject());

  // ---- 2. re-price everything from the database ----
  let items;
  try {
    items = [];
    for (const cartItem of claimedItems) {
      items.push(await repriceLine(cartItem));
    }
  } catch (err) {
    await restoreCart(req.user.id, claimedItems);
    throw err; // PRODUCT_UNAVAILABLE / UNKNOWN_OPTION — already a 4xx
  }

  const { subtotal, deliveryFee, tax, total, itemCount } = quoteTotals(items);
  if (total <= 0) {
    await restoreCart(req.user.id, claimedItems);
    throw ApiError.badRequest("Order total must be greater than zero", {
      code: "ZERO_TOTAL",
    });
  }

  const { customer, deliveryAddress, note } = req.body;

  const order = new Order({
    user: req.user.id,
    customer: {
      // fall back to the account details when a field is left blank
      name: customer.name || req.user.name,
      email: customer.email || req.user.email,
      phone: customer.phone,
    },
    deliveryAddress: {
      line1: deliveryAddress.line1,
      line2: deliveryAddress.line2 || "",
      landmark: deliveryAddress.landmark || "",
      city: deliveryAddress.city,
      state: deliveryAddress.state || "",
      pincode: deliveryAddress.pincode,
    },
    note: note || "",
    items,
    subtotal,
    deliveryFee,
    tax,
    total,
    currency: env.store.currency,
    itemCount,
    status: "pending_payment",
  });
  order.setStatus("pending_payment", { note: "Checkout started" });

  // ---- 3-5. order + payment, all-or-nothing ----
  let payment = null;
  try {
    await order.save();

    payment = await paymentService.charge({
      order,
      user: req.user,
      customer: order.customer,
      req,
    });

    order.payment = {
      paymentId: payment._id,
      method: payment.method,
      gateway: payment.gateway,
      status: payment.status,
      paymentRef: payment.paymentRef,
      transactionId: payment.transactionId,
      amount: payment.amount,
      paidAt: payment.paidAt,
    };

    if (payment.status !== "paid") {
      order.setStatus("cancelled", {
        note: payment.failureReason || "Payment failed",
      });
      await order.save();
      await restoreCart(req.user.id, claimedItems);
      throw ApiError.badRequest("Payment failed, order was not placed", {
        code: "PAYMENT_DECLINED",
      });
    }

    order.setStatus("placed", {
      note: `Paid via ${payment.gateway} (${payment.transactionId})`,
    });
    await order.save();
  } catch (err) {
    if (err instanceof ApiError) throw err; // PAYMENT_DECLINED, already tidy

    // Nothing half-created may survive: drop the order, void the payment,
    // give the customer their cart back.
    await Order.deleteOne({ _id: order._id }).catch(() => {});
    if (payment) {
      payment.recordStatus("failed", "Checkout could not be completed");
      await payment.save().catch(() => {});
    }
    await restoreCart(req.user.id, claimedItems);

    logger.error(
      `[order] checkout failed for ${order.orderNumber}: ${err.stack || err}`
    );
    throw new ApiError(
      502,
      "Could not complete the checkout. Your cart has been restored — please try again.",
      { code: "CHECKOUT_FAILED" }
    );
  }

  return created(
    res,
    { order: serializeOrder(order), payment },
    "Order placed and payment recorded"
  );
});

// GET /api/orders/my
const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .select("-__v");
  return ok(res, { orders: orders.map(serializeOrder) });
});

// GET /api/orders/:id  (owner or admin)
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select("-__v");
  if (!order) throw ApiError.notFound("Order not found");
  if (String(order.user) !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("This is not your order");
  }
  // fall back to a lookup by order id: an interrupted checkout can leave a
  // Payment row whose id never made it onto the order
  const payment = order.payment.paymentId
    ? await Payment.findById(order.payment.paymentId).select("-__v")
    : await Payment.findOne({ order: order._id }).select("-__v");
  return ok(res, { order: serializeOrder(order), payment });
});

// PATCH /api/orders/:id/cancel  (owner; only before it goes out for delivery)
const CANCELLABLE = ["pending_payment", "placed", "preparing"];

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (String(order.user) !== req.user.id) {
    throw ApiError.forbidden("This is not your order");
  }
  if (order.status === "cancelled") {
    return ok(res, { order: serializeOrder(order) }, "Order is already cancelled");
  }
  if (!CANCELLABLE.includes(order.status)) {
    throw ApiError.badRequest(
      "This order is already on its way and can no longer be cancelled",
      { code: "NOT_CANCELLABLE" }
    );
  }

  // refund the mock payment so the two documents never disagree
  const payment = order.payment.paymentId
    ? await Payment.findById(order.payment.paymentId)
    : await Payment.findOne({ order: order._id });
  if (payment && payment.status === "paid") {
    await paymentService.refund(payment, "Order cancelled by customer");
    order.payment.status = payment.status;
  }

  order.setStatus("cancelled", {
    note: req.body && req.body.reason ? String(req.body.reason).slice(0, 200) : "",
    by: "customer",
  });
  await order.save();
  return ok(res, { order: serializeOrder(order) }, "Order cancelled");
});

module.exports = {
  createOrder,
  myOrders,
  getOrder,
  cancelOrder,
  serializeOrder,
};
