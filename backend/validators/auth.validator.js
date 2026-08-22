/**
 * validators/auth.validator.js
 * Purpose: request validation for auth routes. The password rule is the
 * SAME one Login.jsx shows users: 6+ chars, 1 uppercase, 1 number —
 * now actually enforced by the server.
 *
 * Emails are lower-cased and nothing else. normalizeEmail() looks tidier but
 * rewrites addresses (gmail dots stripped, +tags removed, googlemail ->
 * gmail), while the User model only applies `lowercase: true`. Any account
 * created outside register() — the seeded admin, for one — would then be
 * unreachable at login: the lookup would search for a normalised address that
 * was never stored, and every attempt would 401 with no way to recover.
 */
const { body } = require("express-validator");

const passwordRule = body("password")
  .isString()
  .isLength({ min: 6, max: 128 })
  .withMessage("Password must be 6-128 characters")
  .matches(/[A-Z]/)
  .withMessage("Password must include an uppercase letter")
  .matches(/[0-9]/)
  .withMessage("Password must include a number");

const registerRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("Name must be 2-60 characters"),
  body("email")
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage("Valid email is required"),
  passwordRule,
];

const loginRules = [
  body("email")
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage("Valid email is required"),
  body("password").isString().notEmpty().withMessage("Password is required"),
];

module.exports = { registerRules, loginRules };
