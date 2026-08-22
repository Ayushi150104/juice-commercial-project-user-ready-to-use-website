/**
 * controllers/auth.controller.js
 * Purpose: register / login / refresh / logout / me.
 * Fixes the frontend's fake auth: register and login are now genuinely
 * different operations, passwords are verified, and the navbar gets the
 * real stored name on login (the old code showed "User").
 */
const User = require("../models/User");
const Cart = require("../models/Cart");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const tokenService = require("../services/token.service");

function authPayload(user, accessToken) {
  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
  };
}

async function issueSession(res, user) {
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = tokenService.generateRefreshToken();
  tokenService.attachRefreshSession(user, refreshToken);
  await user.save();
  res.cookie(
    tokenService.REFRESH_COOKIE,
    refreshToken,
    tokenService.refreshCookieOptions(),
  );
  return accessToken;
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists", {
      code: "EMAIL_TAKEN",
    });
  }

  const user = await User.create({ name, email, password });
  await Cart.create({ user: user._id, items: [] });

  const accessToken = await issueSession(res, user);
  return created(res, authPayload(user, accessToken), "Account created");
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password +refreshTokens");
  if (!user || !(await user.comparePassword(password))) {
    // one message for both cases — do not reveal which field failed
    throw ApiError.unauthorized("Invalid email or password", {
      code: "BAD_CREDENTIALS",
    });
  }
  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated", {
      code: "ACCOUNT_INACTIVE",
    });
  }

  const accessToken = await issueSession(res, user);
  return ok(res, authPayload(user, accessToken), "Logged in");
});

// POST /api/auth/refresh  (reads httpOnly cookie, rotates it)
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies[tokenService.REFRESH_COOKIE];
  if (!token) {
    throw ApiError.unauthorized("No refresh token", { code: "NO_REFRESH" });
  }

  const user = await User.findOne({
    "refreshTokens.tokenHash": require("crypto")
      .createHash("sha256")
      .update(token)
      .digest("hex"),
  }).select("+refreshTokens");

  if (!user || !user.isActive) {
    res.clearCookie(
      tokenService.REFRESH_COOKIE,
      tokenService.clearCookieOptions(),
    );
    throw ApiError.unauthorized("Invalid refresh token", {
      code: "BAD_REFRESH",
    });
  }

  const session = tokenService.findRefreshSession(user, token);
  if (!session) {
    // token reuse or expired session — revoke everything for safety
    user.refreshTokens = [];
    await user.save();
    res.clearCookie(
      tokenService.REFRESH_COOKIE,
      tokenService.clearCookieOptions(),
    );
    throw ApiError.unauthorized("Refresh session expired", {
      code: "REFRESH_EXPIRED",
    });
  }

  // rotate: remove used token, issue a fresh pair
  tokenService.removeRefreshSession(user, token);
  const accessToken = await issueSession(res, user);
  return ok(res, authPayload(user, accessToken), "Token refreshed");
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies[tokenService.REFRESH_COOKIE];
  if (token) {
    const user = await User.findOne({
      "refreshTokens.tokenHash": require("crypto")
        .createHash("sha256")
        .update(token)
        .digest("hex"),
    }).select("+refreshTokens");
    if (user) {
      tokenService.removeRefreshSession(user, token);
      await user.save();
    }
  }
  res.clearCookie(tokenService.REFRESH_COOKIE, { path: "/api/auth" });
  return ok(res, null, "Logged out");
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user });
});

module.exports = { register, login, refresh, logout, me };
