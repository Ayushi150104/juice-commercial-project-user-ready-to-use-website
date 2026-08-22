/**
 * services/token.service.js
 * Purpose: JWT issuing + refresh-token rotation.
 * Refresh tokens are random 64-byte strings stored ONLY as sha256
 * hashes on the user document (max 5 concurrent sessions), delivered
 * as an httpOnly cookie — they never touch frontend JS.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const REFRESH_COOKIE = "jid";
const MAX_SESSIONS = 5;

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiryDate() {
  return new Date(Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000);
}

/**
 * Adds a refresh session to the user doc (rotating out the oldest
 * beyond MAX_SESSIONS and any expired ones). Caller saves the doc.
 */
function attachRefreshSession(user, refreshToken) {
  const now = new Date();
  user.refreshTokens = (user.refreshTokens || []).filter(
    (s) => s.expiresAt > now
  );
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiryDate(),
  });
  while (user.refreshTokens.length > MAX_SESSIONS) {
    user.refreshTokens.shift();
  }
}

function removeRefreshSession(user, refreshToken) {
  const hash = hashToken(refreshToken);
  user.refreshTokens = (user.refreshTokens || []).filter(
    (s) => s.tokenHash !== hash
  );
}

function findRefreshSession(user, refreshToken) {
  const hash = hashToken(refreshToken);
  const now = new Date();
  return (user.refreshTokens || []).find(
    (s) => s.tokenHash === hash && s.expiresAt > now
  );
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  };
}

/**
 * Browsers only drop a cookie when path/sameSite/secure match the ones
 * it was set with — a bare clearCookie("jid") silently does nothing.
 */
function clearCookieOptions() {
  const { maxAge, ...rest } = refreshCookieOptions();
  return rest;
}

module.exports = {
  REFRESH_COOKIE,
  clearCookieOptions,
  signAccessToken,
  generateRefreshToken,
  attachRefreshSession,
  removeRefreshSession,
  findRefreshSession,
  refreshCookieOptions,
};
