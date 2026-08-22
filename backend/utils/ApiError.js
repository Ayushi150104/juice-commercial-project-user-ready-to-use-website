/**
 * utils/ApiError.js
 * Purpose: operational error type carrying an HTTP status code and
 * optional machine-readable code + field errors.
 */
class ApiError extends Error {
  constructor(statusCode, message, { code, errors } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || undefined;
    this.errors = errors || undefined;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, opts) {
    return new ApiError(400, message, opts);
  }
  static unauthorized(message = "Not authenticated", opts) {
    return new ApiError(401, message, opts);
  }
  static forbidden(message = "Not allowed", opts) {
    return new ApiError(403, message, opts);
  }
  static notFound(message = "Resource not found", opts) {
    return new ApiError(404, message, opts);
  }
  static conflict(message, opts) {
    return new ApiError(409, message, opts);
  }
}

module.exports = ApiError;
