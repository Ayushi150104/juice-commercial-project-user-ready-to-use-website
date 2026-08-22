/**
 * server.js
 * Purpose: application entry point. Security middleware order matters:
 * helmet -> cors -> rate limit -> parsers -> sanitizers -> routes -> errors.
 */
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");

const env = require("./config/env");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const ApiError = require("./utils/ApiError");
const { globalLimiter } = require("./middlewares/rateLimit");
const { xssSanitizer } = require("./middlewares/sanitize");
const { notFound, errorHandler } = require("./middlewares/error");
const apiRoutes = require("./routes");

const app = express();

if (env.trustProxy) app.set("trust proxy", 1);
app.disable("x-powered-by");

// ----- security -----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow <img> from the Vite origin
  })
);
// In development the site gets opened from several addresses: localhost,
// 127.0.0.1, and the LAN IP Vite prints as "Network:" (used to test from a
// phone). Hard-coding those in CORS_ORIGINS is a foot-gun, so dev accepts any
// loopback/private-LAN origin. Production stays on the strict whitelist.
const DEV_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      // allow tools like Postman (no Origin header) and whitelisted origins
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!env.isProd && DEV_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      return callback(
        ApiError.forbidden(
          `Origin not allowed by CORS: ${origin}. Add it to CORS_ORIGINS in backend/.env`,
          { code: "CORS_BLOCKED" }
        )
      );
    },
    credentials: true,
  })
);
app.use(globalLimiter);

// ----- parsers -----
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());
app.use(compression());

// ----- sanitization -----
app.use(mongoSanitize()); // strips $ and . operators from body/params/query
app.use(xssSanitizer); // strips HTML/script payloads from body strings

// ----- logging -----
app.use(
  morgan(env.isProd ? "combined" : "dev", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ----- static: uploaded product images -----
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "7d",
    immutable: true,
  })
);

// ----- API -----
app.use("/api", apiRoutes);

// ----- 404 + errors -----
app.use(notFound);
app.use(errorHandler);

// ----- boot -----
async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      logger.info(`[server] ${env.nodeEnv} API listening on http://localhost:${env.port}`);
    });
  } catch (err) {
    logger.error(`[server] failed to start: ${err.message}`);
    process.exit(1);
  }
}

// export for tests; boot only when run directly
if (require.main === module) start();

process.on("unhandledRejection", (err) => {
  logger.error(`[server] unhandled rejection: ${err && err.stack ? err.stack : err}`);
});

module.exports = app;
