# Juice Backend — API Documentation

Base URL (dev): `http://localhost:5000`
All endpoints are under `/api`. Responses always use the envelope:

```json
{ "success": true,  "message": "…", "data": { … } }          // success
{ "success": false, "message": "…", "code": "…", "errors": [ { "field": "…", "message": "…" } ] }  // failure
```

**Auth header** for protected routes: `Authorization: Bearer <accessToken>`
Access tokens expire in 15 min; `POST /api/auth/refresh` (httpOnly cookie `jid`) returns a fresh one.
Common failure codes on protected routes: `401 NO_TOKEN / TOKEN_EXPIRED / TOKEN_INVALID / ACCOUNT_INACTIVE`, `403 FORBIDDEN_ROLE`, `429 RATE_LIMITED`.

---

## Health

### GET /api/health

Auth: none.
**200** `{ "success": true, "status": "ok", "uptime": 123.4 }`

---

## Auth (`/api/auth`, rate-limited 20 req/15 min)

### POST /api/auth/register

Auth: none. Headers: `Content-Type: application/json`.
Body:

```json
{ "name": "Akash", "email": "a@b.com", "password": "Passw0rd" }
```

Password rule: ≥6 chars, 1 uppercase, 1 number.
**201** `data: { user: { id, name, email, role }, accessToken }` + `Set-Cookie: jid=…; HttpOnly; Path=/api/auth`
**400** `VALIDATION_ERROR` · **409** `EMAIL_TAKEN` / `DUPLICATE_KEY`

### POST /api/auth/login

Auth: none.
Body: `{ "email": "a@b.com", "password": "Passw0rd" }`
**200** same shape as register (+ rotated cookie)
**401** `BAD_CREDENTIALS` · **403** `ACCOUNT_INACTIVE`

### POST /api/auth/refresh

Auth: cookie `jid` (sent automatically by the browser; `withCredentials: true`).
**200** `data: { user, accessToken }` + new rotated cookie. Reusing an old cookie revokes all sessions.
**401** `NO_REFRESH` / `BAD_REFRESH` / `REFRESH_EXPIRED`

### POST /api/auth/logout

Auth: cookie `jid` (optional). Revokes the session, clears the cookie.
**200** `{ success: true, message: "Logged out" }`

### GET /api/auth/me

Auth: Bearer token.
**200** `data: { user: { id, name, email, role } }`

---

## Products (`/api/products`)

### GET /api/products

Auth: none. Lists available, non-deleted products (feeds the cards grid).
**200** `data: { products: [ { _id, name, address, time, price, image, isAvailable, createdAt, updatedAt } ] }`
`image` is server-relative (`/uploads/products/x.png`) or a Cloudinary URL.

### GET /api/products/:id

Auth: none. **200** `data: { product }` · **400** `INVALID_ID` · **404** not found

### POST /api/products (admin)

Auth: Bearer (admin). Headers: `multipart/form-data`.
Fields: `name` (2-80), `price` (≥0), `address?`, `time?`, `isAvailable?`, `image?` (png/jpg/webp/gif ≤2 MB).
**201** `data: { product }` · **400** validation/`BAD_FILE_TYPE`/`UPLOAD_ERROR` · **403** not admin

### PUT /api/products/:id (admin)

Auth: Bearer (admin). JSON or multipart; any subset of the create fields. New `image` replaces (and deletes) the old file.
**200** `data: { product }` · **404** not found

### DELETE /api/products/:id (admin)

Soft delete — hidden from the store, order history snapshots stay intact.
**200** `{ message: "Product deleted" }`

### DELETE /api/products/:id/image (admin)

Removes the product image (also from disk/Cloudinary).
**200** `data: { product }`

---

## Customizer (`/api/customizer`)

### GET /api/customizer/options

Auth: none. Feeds the Customizer panel; grouped and sorted.
**200** `data: { fruits: [ { _id, type, label, priceModifier, … } ], bases: […], extras: […] }`

### POST /api/customizer/options (admin)

Body: `{ "type": "fruit|base|extra", "label": "🍑 Peach", "priceModifier": 25, "isAvailable": true, "sortOrder": 0 }`
**201** `data: { option }` · **409** duplicate label within type

### PUT /api/customizer/options/:id (admin) — any subset of fields. **200** `data: { option }`

### DELETE /api/customizer/options/:id (admin) — **200** (hard delete; orders keep label snapshots)

---

## Cart (`/api/cart` — all require Bearer token)

Cart item shape in every response:
`{ id, kind: "product"|"custom", productId?, name, image, fruits?, base?, extras?, price, quantity }`
`price` is always the server-computed unit price.

### GET /api/cart

**200** `data: { cart: { id, items: […], total } }`

### POST /api/cart/items

Body (product): `{ "kind": "product", "productId": "<id>", "quantity": 2 }`
Body (custom): `{ "kind": "custom", "fruits": ["🍎 Apple", "🥤 Mixed Juice"], "base": ["🥛 Milk"], "extras": [], "quantity": 1 }`
Re-adding the same product bumps its quantity (max 20).
**200** `data: { cart }` · **400** `UNKNOWN_OPTION`/`NO_FRUITS`/validation · **404** `PRODUCT_UNAVAILABLE`

### PUT /api/cart/items/:itemId

Body: `{ "quantity": 5 }` (1-20). **200** `data: { cart }` · **404** item not found

### DELETE /api/cart/items/:itemId — **200** `data: { cart }`

### DELETE /api/cart — empties the cart. **200** `data: { cart }`

### POST /api/cart/merge

One-shot guest-cart absorption after login. Body: `{ "items": [ <same payloads as add> ] }` (max 50).
Invalid entries are skipped, not fatal. **200** `data: { cart, skipped }`

---

## Orders (`/api/orders` — all require Bearer token)

### POST /api/orders — **the whole checkout, in one request**

There is no payment gateway, no popup and no redirect. The client sends WHO
and WHERE; every money value is computed server-side from the database.

Body:

```json
{
  "customer": { "name": "Akash", "email": "a@b.com", "phone": "9876543210" },
  "deliveryAddress": {
    "line1": "12 MG Road",
    "line2": "Flat 4B",
    "landmark": "Near the park",
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411001"
  },
  "note": "No ice please"
}
```

Required: `customer.name` (2-60), `customer.email`, `customer.phone`,
`deliveryAddress.line1` (4-200), `.city`, `.pincode` (4-10 digits).
Optional: `line2`, `landmark`, `state`, `note` (≤300).

The server then, in this order: snapshots the cart → writes the **Order** →
writes the **Payment** (mock gateway, status `paid`) → links them → moves the
order to `placed` → empties the cart. If the payment write fails the pending
order is deleted, so nothing half-created survives.

**201**

```json
{ "data": {
  "order": {
    "id": "…", "orderNumber": "JU-1786644323275-BCE5FD", "status": "placed",
    "customer": { "name": "…", "email": "…", "phone": "…" },
    "deliveryAddress": { "line1": "…", "city": "…", "pincode": "…" },
    "note": "No ice please",
    "items": [ { "kind": "product", "name": "Nimbu Pani",
                 "unitPrice": 55, "quantity": 2, "lineTotal": 110 } ],
    "subtotal": 250, "deliveryFee": 0, "tax": 0, "total": 250,
    "currency": "INR", "itemCount": 3,
    "statusHistory": [ { "status": "pending_payment", "at": "…", "by": "system" },
                       { "status": "placed", "at": "…", "by": "system" } ],
    "payment": { "paymentId": "…", "method": "mock", "gateway": "mock-gateway",
                 "status": "paid", "paymentRef": "PAY-…", "transactionId": "TXN-…",
                 "amount": 250, "paidAt": "…" },
    "placedAt": "…", "createdAt": "…"
  },
  "payment": { "…full Payment document, including the attempts audit trail…" }
} }
```

**400** `EMPTY_CART` · `ZERO_TOTAL` · `VALIDATION_ERROR` · **502** `PAYMENT_ERROR` (order rolled back)

### GET /api/orders/my

**200** `data: { orders: [ <same shape as above> ] }` (newest first, ≤100)

### GET /api/orders/:id

Owner or admin. **200** `data: { order, payment }` · **403** not yours · **404** unknown

### PATCH /api/orders/:id/cancel

Owner. Allowed while the order is `pending_payment`, `placed` or `preparing`.
Body (optional): `{ "reason": "changed my mind" }`
A paid payment is marked **refunded** (never deleted) and the order timeline
records who cancelled it. Cancelling twice is idempotent.
**200** `data: { order }` · **400** `NOT_CANCELLABLE` · **403** not yours

Order status flow: `pending_payment → placed → preparing → out_for_delivery → delivered`,
with `cancelled` reachable from the first three. Backwards transitions are rejected.

---

## Payment (`/api/payment`)

Payments are **written server-side inside `POST /api/orders`** — the client
can never create one or influence its status. These endpoints are read-only.

### GET /api/payment/config

Auth: none.
**200** `data: { configured: true, mode: "mock", gateway: "mock-gateway", requiresRedirect: false, message: "…" }`

### GET /api/payment/my

Auth: Bearer. **200** `data: { payments: [ … ] }` (newest first, ≤100)

### GET /api/payment/:id

Auth: Bearer, owner or admin. **200** `data: { payment }` · **403** not yours · **404** unknown

A Payment document:

```json
{
  "paymentRef": "PAY-…",
  "transactionId": "TXN-…",
  "order": "<orderId>",
  "orderNumber": "JU-…",
  "user": "<userId>",
  "customer": { "name": "…", "email": "…", "phone": "…" },
  "amount": 250,
  "currency": "INR",
  "method": "mock",
  "gateway": "mock-gateway",
  "status": "paid",
  "paidAt": "…",
  "refundedAt": null,
  "failureReason": "",
  "attempts": [
    { "status": "initiated", "at": "…", "note": "Checkout started" },
    {
      "status": "paid",
      "at": "…",
      "note": "Simulated payment approved (no real charge)"
    }
  ],
  "meta": { "ip": "…", "userAgent": "…" },
  "createdAt": "…",
  "updatedAt": "…"
}
```

---

## Admin (`/api/admin` — Bearer + role admin)

### GET /api/admin/orders?status=&q=&page=&limit=

`q` searches order number, customer name, email and phone.
**200** `data: { orders: [ …, user: { name, email } ], pagination: { page, limit, totalCount, totalPages } }`

### PATCH /api/admin/orders/:id/status

Body: `{ "status": "preparing", "note": "rider assigned" }`
(`placed|preparing|out_for_delivery|delivered|cancelled`).
Forward-only: an order cannot move backwards, a delivered or cancelled order
is frozen, and an unpaid order can only be cancelled. Cancelling a paid order
refunds its Payment document.
**200** `data: { order }` · **400** `INVALID_TRANSITION`

### GET /api/admin/payments?status=&page=&limit=

Every payment record with its customer populated.
**200** `data: { payments, pagination }`

### GET /api/admin/users?page=&limit=

**200** `data: { users, pagination }` — passwords/refresh tokens never serialized.

### PATCH /api/admin/users/:id

Body: `{ "isActive": false }` and/or `{ "role": "admin" }`. Deactivation kills the user's live JWTs on next request. Self-deactivation and self-demotion are blocked.
**200** `data: { user }` · **400** self-deactivation / self-demotion

### GET /api/admin/stats

Revenue is aggregated from the **Payment** collection, not from orders.
**200** `data: { customers, products, totalOrders, paidOrders, revenue, refundedPayments, refundedAmount, netRevenue, ordersInProgress }`

---

## Security summary

helmet headers · CORS whitelist w/ credentials (`CORS_ORIGINS`) · global 300 req/15 min + auth 20 req/15 min rate limits · NoSQL-operator sanitization (express-mongo-sanitize) · XSS stripping on all body strings · express-validator on every route · bcrypt(10) passwords · JWT access 15 min + rotated hashed refresh tokens (httpOnly, SameSite=Lax, Secure in prod) · role middleware · Multer type/size limits · centralized error handler (no stack traces in production) · winston + morgan logging · body size limit 100 kb.
