/**
 * controllers/cart.controller.js
 * Purpose: server-side cart. Mirrors CartContext operations
 * (add/remove/clear) plus quantity updates and a merge endpoint used
 * once at login to absorb the guest localStorage cart.
 * Every price comes from the DB via price.service — client prices are ignored.
 */
const Cart = require("../models/Cart");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const {
  priceCustomJuice,
  getPurchasableProduct,
} = require("../services/price.service");

/**
 * Atomic upsert rather than find-then-create. `user` carries a unique index,
 * so two concurrent first-time requests (the frontend fires GET /cart and
 * POST /cart/items together) would otherwise race and the loser would get an
 * E11000 surfaced as a nonsensical 409 "user already exists".
 */
async function getOrCreateCart(userId) {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function serializeCart(cart) {
  return {
    id: cart._id,
    items: cart.items.map((i) => ({
      id: i._id,
      kind: i.kind,
      productId: i.product || null,
      name: i.name,
      image: i.image,
      fruits: i.custom && i.custom.fruits ? i.custom.fruits : undefined,
      base: i.custom && i.custom.base ? i.custom.base : undefined,
      extras: i.custom && i.custom.extras ? i.custom.extras : undefined,
      price: i.unitPrice,
      quantity: i.quantity,
    })),
    total: cart.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
  };
}

/** Builds a validated, server-priced cart item from a request payload. */
async function buildItem(payload) {
  const quantity = payload.quantity || 1;

  if (payload.kind === "product") {
    const product = await getPurchasableProduct(payload.productId);
    return {
      kind: "product",
      product: product._id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity,
    };
  }

  // custom juice
  const priced = await priceCustomJuice({
    fruits: payload.fruits,
    base: payload.base || [],
    extras: payload.extras || [],
  });
  return {
    kind: "custom",
    product: null,
    name: priced.fruits.join(" + "),
    image: "",
    custom: { fruits: priced.fruits, base: priced.base, extras: priced.extras },
    unitPrice: priced.price,
    quantity,
  };
}

// GET /api/cart
const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  return ok(res, { cart: serializeCart(cart) });
});

// POST /api/cart/items
const addItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  const item = await buildItem(req.body);

  // same product added again -> bump quantity instead of duplicating
  if (item.kind === "product") {
    const existing = cart.items.find(
      (i) => i.kind === "product" && String(i.product) === String(item.product)
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + item.quantity, 20);
      await cart.save();
      return ok(res, { cart: serializeCart(cart) }, "Quantity updated");
    }
  }

  cart.items.push(item);
  await cart.save();
  return ok(res, { cart: serializeCart(cart) }, "Added to cart");
});

// PUT /api/cart/items/:itemId
const updateItemQuantity = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound("Cart item not found");

  item.quantity = req.body.quantity;
  await cart.save();
  return ok(res, { cart: serializeCart(cart) }, "Quantity updated");
});

// DELETE /api/cart/items/:itemId
const removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound("Cart item not found");

  cart.items.pull({ _id: req.params.itemId });
  await cart.save();
  return ok(res, { cart: serializeCart(cart) }, "Removed from cart");
});

// DELETE /api/cart
const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  cart.items = [];
  await cart.save();
  return ok(res, { cart: serializeCart(cart) }, "Cart cleared");
});

// POST /api/cart/merge  — one-shot guest-cart absorption at login.
// Body: { items: [{kind, productId?, fruits?, base?, extras?, quantity?}] }
// Invalid entries are skipped (guest cart may reference removed products).
const mergeCart = asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];
  if (incoming.length > 50) {
    throw ApiError.badRequest("Too many items to merge (max 50)");
  }
  const cart = await getOrCreateCart(req.user.id);

  let skipped = 0;
  for (const payload of incoming) {
    try {
      const item = await buildItem(payload);
      if (item.kind === "product") {
        const existing = cart.items.find(
          (i) =>
            i.kind === "product" && String(i.product) === String(item.product)
        );
        if (existing) {
          existing.quantity = Math.min(existing.quantity + item.quantity, 20);
          continue;
        }
      }
      cart.items.push(item);
    } catch {
      skipped += 1;
    }
  }

  await cart.save();
  return ok(
    res,
    { cart: serializeCart(cart), skipped },
    skipped ? `Merged with ${skipped} item(s) skipped` : "Cart merged"
  );
});

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  mergeCart,
  // exported for order controller reuse
  getOrCreateCart,
  serializeCart,
};
