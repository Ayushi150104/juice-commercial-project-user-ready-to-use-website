/**
 * controllers/admin.controller.js
 * Purpose: admin-only operations — all orders, order status updates,
 * user management, store stats. (Product/customizer admin CRUD lives in
 * their own controllers; routes gate them with requireRole("admin").)
 */
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const paymentService = require("../services/payment.service");

/** page/limit query parsing shared by every list endpoint. */
function paging(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// GET /api/admin/orders?status=&q=&page=&limit=
const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  // search by order number, customer name, email or phone
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { orderNumber: rx },
      { "customer.name": rx },
      { "customer.email": rx },
      { "customer.phone": rx },
    ];
  }

  const [orders, totalCount] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .select("-__v"),
    Order.countDocuments(filter),
  ]);

  return ok(res, {
    orders,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
});

// PATCH /api/admin/orders/:id/status
// Enforces a forward-only lifecycle so an order can't jump from
// "delivered" back to "preparing".
const FLOW = ["placed", "preparing", "out_for_delivery", "delivered"];

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");

  const next = req.body.status;

  if (order.status === "cancelled") {
    throw ApiError.badRequest("A cancelled order cannot change status");
  }
  if (order.status === "delivered" && next !== "delivered") {
    throw ApiError.badRequest("A delivered order cannot change status");
  }
  if (order.status === "pending_payment" && next !== "cancelled") {
    throw ApiError.badRequest(
      "Payment has not been recorded yet — this order can only be cancelled"
    );
  }
  if (next !== "cancelled") {
    const from = FLOW.indexOf(order.status);
    const to = FLOW.indexOf(next);
    if (from > -1 && to > -1 && to < from) {
      throw ApiError.badRequest(
        `Cannot move an order backwards from "${order.status}" to "${next}"`,
        { code: "INVALID_TRANSITION" }
      );
    }
  }

  // cancelling a paid order refunds the (mock) payment
  if (next === "cancelled" && order.payment.paymentId) {
    const payment = await Payment.findById(order.payment.paymentId);
    if (payment && payment.status === "paid") {
      await paymentService.refund(payment, "Order cancelled by admin");
      order.payment.status = payment.status;
    }
  }

  order.setStatus(next, { note: req.body.note || "", by: "admin" });
  await order.save();
  return ok(res, { order }, "Order status updated");
});

// GET /api/admin/payments?status=&page=&limit=
const listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [payments, totalCount] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .select("-__v"),
    Payment.countDocuments(filter),
  ]);

  return ok(res, {
    payments,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
});

// GET /api/admin/users?page=&limit=
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query);

  const [users, totalCount] = await Promise.all([
    User.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments({}),
  ]);

  return ok(res, {
    users,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
});

// PATCH /api/admin/users/:id  — activate/deactivate or change role
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");

  if (req.user.id === String(user._id) && req.body.isActive === false) {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }
  // an admin locking themselves out of the admin panel is not recoverable
  // from the UI, so block self-demotion too
  if (req.user.id === String(user._id) && req.body.role === "customer") {
    throw ApiError.badRequest("You cannot remove your own admin role");
  }

  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  if (req.body.role !== undefined) user.role = req.body.role;
  await user.save();

  return ok(res, { user }, "User updated");
});

// GET /api/admin/stats
const getStats = asyncHandler(async (_req, res) => {
  const [userCount, productCount, paidAgg, refundAgg, ordersInProgress, totalOrders] =
    await Promise.all([
      User.countDocuments({ role: "customer" }),
      Product.countDocuments({ isDeleted: false }),
      // revenue comes from the Payment collection — the source of truth
      Payment.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { status: "refunded" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      Order.countDocuments({
        status: { $in: ["placed", "preparing", "out_for_delivery"] },
      }),
      Order.countDocuments({}),
    ]);

  const paid = paidAgg[0] || { count: 0, amount: 0 };
  const refunded = refundAgg[0] || { count: 0, amount: 0 };

  // A refunded payment leaves the "paid" bucket entirely, so `paid.amount` is
  // ALREADY net of refunds. Subtracting refunds again would double-count them
  // and drive netRevenue negative after a single cancellation.
  return ok(res, {
    customers: userCount,
    products: productCount,
    totalOrders,
    paidOrders: paid.count,
    revenue: paid.amount,
    netRevenue: paid.amount,
    grossRevenue: paid.amount + refunded.amount,
    refundedPayments: refunded.count,
    refundedAmount: refunded.amount,
    ordersInProgress,
  });
});

module.exports = {
  listOrders,
  updateOrderStatus,
  listPayments,
  listUsers,
  updateUser,
  getStats,
};
