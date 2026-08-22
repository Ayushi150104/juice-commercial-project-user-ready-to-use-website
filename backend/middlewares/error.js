/**
 * middlewares/error.js
 * Purpose: 404 handler + central error handler. Converts Mongoose and
 * Multer errors into clean 4xx responses; hides stack traces in
 * production; logs everything through winston.
 */
const multer = require("multer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors;
  let code = err.code;

  // Mongoose: bad ObjectId
  if (err.name === "CastError") {
    status = 400;
    message = `Invalid value for ${err.path}`;
    code = "INVALID_ID";
  }

  // Mongoose: schema validation
  if (err.name === "ValidationError") {
    status = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    code = "VALIDATION_ERROR";
  }

  // Mongo duplicate key (e.g. email already registered)
  if (err.code === 11000 && err.keyValue) {
    status = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
    code = "DUPLICATE_KEY";
  }

  // Multer upload errors
  if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image too large (max 2 MB)"
        : `Upload error: ${err.message}`;
    code = "UPLOAD_ERROR";
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}: ${err.stack || err}`);
    if (env.isProd) message = "Internal server error";
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
    code,
    errors,
    ...(env.isProd ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}

module.exports = { notFound, errorHandler };
