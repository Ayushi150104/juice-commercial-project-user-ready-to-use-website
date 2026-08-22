/**
 * utils/response.js
 * Purpose: uniform success envelope — every endpoint responds
 * { success, message?, data? } so the frontend can rely on one shape.
 */
function ok(res, data = null, message = undefined, statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function created(res, data = null, message = undefined) {
  return ok(res, data, message, 201);
}

module.exports = { ok, created };
