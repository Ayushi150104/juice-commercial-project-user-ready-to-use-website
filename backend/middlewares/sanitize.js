/**
 * middlewares/sanitize.js
 * Purpose: XSS input sanitization. Strips HTML/script payloads from
 * every string in req.body (deep). Values like "🍎 Apple" pass through
 * untouched; "<script>alert(1)</script>" does not survive.
 * (Mongo-operator injection is handled separately by express-mongo-sanitize.)
 */
const xss = require("xss");

const cleaner = new xss.FilterXSS({
  whiteList: {}, // no tags allowed at all
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
});

function deepClean(value) {
  if (typeof value === "string") return cleaner.process(value);
  if (Array.isArray(value)) return value.map(deepClean);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = deepClean(value[key]);
    }
    return value;
  }
  return value;
}

function xssSanitizer(req, _res, next) {
  if (req.body) deepClean(req.body);
  next();
}

module.exports = { xssSanitizer };
