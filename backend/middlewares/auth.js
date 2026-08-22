/**
 * middlewares/auth.js
 * Purpose: JWT access-token verification. Attaches req.user
 * ({ id, role, email, name }) after checking the account still
 * exists and is active — a revoked/deactivated user is cut off
 * even with a not-yet-expired token.
 */
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw ApiError.unauthorized("Missing access token", { code: "NO_TOKEN" });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.accessSecret);
  } catch (err) {
    const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    throw ApiError.unauthorized("Invalid or expired access token", { code });
  }

  const user = await User.findById(payload.sub).select("_id name email role isActive");
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Account not found or deactivated", {
      code: "ACCOUNT_INACTIVE",
    });
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
  next();
});

module.exports = { requireAuth };
