/**
 * config/db.js
 * Purpose: MongoDB connection with sane timeouts and event logging.
 */
const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../utils/logger");

async function connectDB() {
  // Log host AND database name. Pointing the app at localhost while
  // browsing Atlas in Compass (or vice versa) looks exactly like "my data
  // was not saved", so the boot line must be unambiguous.
  mongoose.connection.on("connected", () => {
    const { host, name } = mongoose.connection;
    const kind = /mongodb\.net$/.test(host || "") ? "Atlas" : "local";
    logger.info(`[db] MongoDB connected: ${host} — database "${name}" (${kind})`);
  });
  mongoose.connection.on("error", (err) =>
    logger.error(`[db] MongoDB error: ${err.message}`)
  );
  mongoose.connection.on("disconnected", () =>
    logger.warn("[db] MongoDB disconnected")
  );

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
  } catch (err) {
    // The raw driver errors ("SSL alert number 80", "ECONNREFUSED") say
    // nothing about the actual cause, so translate them into the three
    // things that are actually wrong in practice.
    const isAtlas = /mongodb\+srv|mongodb\.net/.test(env.mongoUri);
    const msg = String(err.message || "");

    if (isAtlas && /bad auth|Authentication failed/i.test(msg)) {
      logger.error(
        "[db] Atlas rejected the username/password.\n" +
          "     Check Atlas > Database Access, then re-run: npm run db:atlas\n" +
          "     (a password still wrapped in < > is the usual cause)"
      );
    } else if (isAtlas) {
      logger.error(
        "[db] Could not reach the Atlas cluster.\n" +
          "     1. Atlas > Network Access — is your CURRENT IP on the list?\n" +
          "        Home IPs change, so an entry added yesterday may be stale.\n" +
          "     2. Antivirus/firewall HTTPS scanning can break the TLS handshake\n" +
          "        (shows up as \"SSL alert number 80\").\n" +
          "     3. To keep working offline meanwhile: npm run db:local"
      );
    } else {
      logger.error(
        "[db] Could not reach MongoDB on this machine.\n" +
          "     Start it with:  net start MongoDB   (admin PowerShell)\n" +
          "     or point at Atlas with:  npm run db:atlas"
      );
    }
    throw err;
  }
  return mongoose.connection;
}

module.exports = connectDB;
