/**
 * utils/asyncHandler.js
 * Purpose: wraps async route handlers so rejected promises reach the
 * central error middleware instead of hanging the request.
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
