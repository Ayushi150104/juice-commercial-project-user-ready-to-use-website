# Juice Website — Backend

Node.js + Express + MongoDB (Mongoose) REST API for the Juice React frontend.
MVC architecture, JWT auth with refresh-token rotation, role-based access
(customer/admin), server-side pricing, **one-click checkout with a mock
payment gateway**, image uploads (local disk or Cloudinary), and hardened
security middleware.

Every order and every payment is written to MongoDB — customer details,
delivery address, per-line prices, money breakdown, transaction id and a
full status timeline. No real money moves and no payment provider account
is needed.

## Requirements

- Node.js 18+
- MongoDB 4.2+ — either
  - local: [MongoDB Community Server](https://www.mongodb.com/try/download/community), or
  - cloud: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (put its URI in `.env`)

## Quick start

**Backend Terminal** (from the project root):

```bash
cd backend
npm install
npm run seed     # admin user + 4 juices + customizer options (safe to re-run)
npm run dev      # API on http://localhost:5000
```

**Frontend Terminal** (from the project root):

```bash
npm install
npm run dev      # site on http://localhost:5173
```

Seeded admin login: `admin@juice.local` / `Admin@1234` (change in `.env`).

## Environment

All secrets live in `backend/.env` (see `.env.example`). A dev-ready `.env`
ships with this folder — replace both JWT secrets and the admin password
before any deployment.

### Payments (mock gateway)

There is **no payment provider and nothing to configure**. Pressing
"Place Order" sends one request:

```
POST /api/orders   { customer, deliveryAddress, note }
```

and the server, in that single request:

1. re-prices the cart from the database (the client never sends money values),
2. writes the **Order** document — customer, address, items, per-line totals,
   subtotal / delivery / tax / total, status timeline,
3. writes a **Payment** document in its own collection — amount, currency,
   method, gateway, generated `transactionId` + `paymentRef`, `paidAt`, an
   append-only attempt trail and the request IP / user-agent,
4. links the two, moves the order to `placed`,
5. empties the cart,

and returns both documents. If the payment write fails, the pending order is
deleted — no half-created checkout is ever left behind.

Cancelling a placed order marks the payment `refunded` (both documents stay
in sync) rather than deleting anything.

**Swapping in a real gateway later** means rewriting
`services/payment.service.js` only — keep the `charge()` / `refund()`
signatures and the models, controllers and frontend stay as they are.

Money rules live in `.env` and are stored on every order, so changing them
never rewrites past orders:

```
DELIVERY_FEE=0          # flat fee in rupees
FREE_DELIVERY_ABOVE=0   # waive the fee above this subtotal (0 = never)
TAX_PERCENT=0           # e.g. 5 for 5% GST
```

### Switching database (local <-> Atlas)

`MONGODB_URI` in `.env` decides where every document goes. Editing it by hand
is easy to get wrong — the classic mistake is leaving the database name out of
the URI, which silently writes everything to a database called `test` and looks
exactly like "my orders were not saved". Use the helper instead:

```bash
npm run db:show                                   # current target, password masked
npm run db:local                                  # mongodb://127.0.0.1:27017/juicedb
npm run db:atlas                                  # paste the Atlas SRV string when asked
npm run db:atlas -- "mongodb+srv://u:p@host/db"   # non-interactive
```

It backs `.env` up to `.env.backup`, keeps the previous value as a comment, and
appends `/juicedb` if the URI has no database name. Restart the backend after
switching — the boot log prints which host and database it actually connected
to, and whether it is local or Atlas.

Atlas also needs your IP in **Network Access**, otherwise the server fails with
`MongoServerSelectionError`, which looks identical to "MongoDB is not running".

### Images

`STORAGE_DRIVER=local` (default) stores product images in `uploads/` and
serves them at `/uploads/...`. Set `STORAGE_DRIVER=cloudinary` + the three
`CLOUDINARY_*` vars to switch — no code changes needed.

## Testing

No database or server needed — schemas, route wiring and pricing maths:

```bash
npm run test:offline   # 67 checks
```

Full request/response suite (start the API and seed it first, in another
terminal):

```bash
npm run seed && npm start
npm run test:e2e       # 145 checks across every endpoint
```

## Structure

```
backend/
├── server.js           # app entry: helmet → cors → rate-limit → parsers → sanitize → routes → errors
├── config/             # env validation, db connection
├── models/             # User, Product, CustomizerOption, Cart, Order, Payment
├── controllers/        # auth, product, customizer, cart, order, payment, admin
├── routes/             # one router per resource, mounted under /api
├── middlewares/        # auth (JWT), roles, validate, upload, rate limit, sanitize, errors
├── validators/         # express-validator chains per resource
├── services/           # tokens, pricing, mock payment gateway, image storage
├── utils/              # ApiError, asyncHandler, logger, response envelope
├── scripts/use-db.js   # switch MONGODB_URI between local and Atlas
├── seed/seed.js        # idempotent seeding
├── tests/offline.js    # schema + routing + pricing checks (no DB needed)
├── tests/e2e.js        # full endpoint test suite (needs a running API)
├── uploads/            # served statically at /uploads
└── logs/               # winston error.log + combined.log
```

Full endpoint reference: see `API_DOCUMENTATION.md`.
