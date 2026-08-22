/**
 * middlewares/rateLimit.js
 * Purpose: brute-force / abuse protection.
 *  - global: 300 requests / 15 min per IP
 *  - auth:    20 requests / 15 min per IP (login/register/refresh)
 */
const rateLimit = require("express-rate-limit");

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    code: "RATE_LIMITED",
  },
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  ...standardOptions,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  ...standardOptions,
});

module.exports = { globalLimiter, authLimiter };
