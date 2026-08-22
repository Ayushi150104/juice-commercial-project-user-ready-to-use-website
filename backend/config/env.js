/**
 * config/env.js
 * Purpose: single source of truth for environment variables.
 * Validates required variables at boot so the server fails fast
 * with a clear message instead of crashing mid-request.
 */
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Refresh tokens are 64 random bytes stored as sha256 hashes (see
// services/token.service.js), NOT JWTs — so there is no refresh secret to
// require. Demanding one only made deployments fail over a unused variable.
const required = ["MONGODB_URI", "JWT_ACCESS_SECRET"];

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  // eslint-disable-next-line no-console
  console.error(
    `[env] Missing required environment variables: ${missing.join(", ")}\n` +
      "Copy .env.example to .env and fill the values."
  );
  process.exit(1);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT, 10) || 5000,
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS, 10) || 7,
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || "admin@juice.local").toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "Admin@1234",
    name: process.env.ADMIN_NAME || "Store Admin",
  },
  // Storefront money rules. All three are stored on every order, so
  // changing them later never rewrites historical totals.
  store: {
    currency: process.env.CURRENCY || "INR",
    // Flat delivery fee in ₹, waived once the subtotal reaches the threshold.
    // Defaults to 0 so the cart total and the order total always match.
    deliveryFee: parseFloat(process.env.DELIVERY_FEE || "0") || 0,
    freeDeliveryAbove:
      parseFloat(process.env.FREE_DELIVERY_ABOVE || "0") || 0,
    // Percentage, e.g. 5 for 5% GST. 0 = no tax line.
    taxPercent: parseFloat(process.env.TAX_PERCENT || "0") || 0,
  },
  storage: {
    driver: process.env.STORAGE_DRIVER === "cloudinary" ? "cloudinary" : "local",
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
      apiKey: process.env.CLOUDINARY_API_KEY || "",
      apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    },
  },
  trustProxy: process.env.TRUST_PROXY === "1",
  logLevel: process.env.LOG_LEVEL || "info",
};

module.exports = env;
