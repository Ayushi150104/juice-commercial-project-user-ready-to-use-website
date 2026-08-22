/**
 * scripts/use-db.js
 * Purpose: switch MONGODB_URI in backend/.env between the local server and
 * an Atlas cluster without hand-editing the file (and without pasting the
 * password anywhere except your own terminal).
 *
 *   npm run db:show     — print the current target, password masked
 *   npm run db:local    — point at mongodb://127.0.0.1:27017/juicedb
 *   npm run db:atlas    — paste the Atlas SRV string when prompted
 *   npm run db:atlas -- "mongodb+srv://user:pass@host/juicedb"   (non-interactive)
 *
 * The old .env is copied to .env.backup before anything is written, and the
 * database name is appended automatically if the URI does not carry one —
 * that omission silently sends every document to a database called "test",
 * which looks exactly like "my data was not saved".
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ENV_PATH = path.join(__dirname, "..", ".env");
const BACKUP_PATH = path.join(__dirname, "..", ".env.backup");
const LOCAL_URI = "mongodb://127.0.0.1:27017/juicedb";
const DEFAULT_DB = "juicedb";

/** Hides the password so a URI can safely be printed or screenshotted. */
function mask(uri) {
  return String(uri).replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:••••••@");
}

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(
      `[db] ${ENV_PATH} not found. Copy .env.example to .env first.`
    );
    process.exit(1);
  }
  return fs.readFileSync(ENV_PATH, "utf8");
}

function currentUri(text) {
  const line = text.split(/\r?\n/).find((l) => /^\s*MONGODB_URI\s*=/.test(l));
  return line ? line.split("=").slice(1).join("=").trim() : "";
}

/**
 * Validates the URI and makes sure it ends up pointing at a named database.
 * Returns the normalised URI, or exits with an explanation.
 */
function normalise(raw) {
  const uri = String(raw).trim().replace(/^["']|["']$/g, "");

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    console.error(
      "[db] That does not look like a MongoDB URI.\n" +
        "     It must start with mongodb:// or mongodb+srv://"
    );
    process.exit(1);
  }
  if (/<password>|<db_password>|<user>|<username>/i.test(uri)) {
    console.error(
      "[db] The URI still contains a placeholder like <password>.\n" +
        "     Replace it with your real Atlas database user and password."
    );
    process.exit(1);
  }

  // Atlas hands you ".../<db_password>@...". People replace the TEXT but keep
  // the angle brackets, and the browser then percent-encodes them to %3C/%3E.
  // The URI looks valid, connects, and fails auth — so catch it here.
  const creds = uri.slice(uri.indexOf("://") + 3).split("@")[0];
  if (/(%3C|<).+(%3E|>)/i.test(creds)) {
    console.error(
      "[db] The password still has < > around it (shown as %3C / %3E).\n" +
        "     Those brackets are part of Atlas's placeholder, not your password.\n" +
        "     Remove them, e.g.  :%3CAryan123%3E@  ->  :Aryan123@"
    );
    process.exit(1);
  }

  // split off ?query so the database name lands in the right place
  const [beforeQuery, query = ""] = uri.split("?");
  const schemeEnd = uri.indexOf("://") + 3;
  const hostAndPath = beforeQuery.slice(schemeEnd);
  const slash = hostAndPath.indexOf("/");
  const dbName = slash === -1 ? "" : hostAndPath.slice(slash + 1);

  let fixed = beforeQuery;
  if (!dbName) {
    fixed = beforeQuery.replace(/\/?$/, "") + "/" + DEFAULT_DB;
    console.log(
      `[db] No database name in the URI — appending "/${DEFAULT_DB}".\n` +
        "     Without it MongoDB would quietly use a database called \"test\"."
    );
  }
  return query ? `${fixed}?${query}` : fixed;
}

function writeUri(uri) {
  const text = readEnv();
  fs.writeFileSync(BACKUP_PATH, text, "utf8");

  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*MONGODB_URI\s*=/.test(l));
  const previous = idx === -1 ? "" : lines[idx];

  if (idx === -1) {
    lines.push(`MONGODB_URI=${uri}`);
  } else {
    // keep the old value as a commented line so switching back is one edit
    lines[idx] = `# was: ${previous}\nMONGODB_URI=${uri}`;
  }

  // drop any stale "# was:" lines beyond the most recent one
  const cleaned = lines
    .join("\n")
    .split(/\r?\n/)
    .filter((l, i, arr) => !(l.startsWith("# was:") && arr.slice(i + 1).some((x) => x.startsWith("# was:"))));

  fs.writeFileSync(ENV_PATH, cleaned.join("\n"), "utf8");

  const kind = /mongodb\.net/.test(uri) ? "Atlas" : "local";
  console.log(`[db] .env updated -> ${mask(uri)}  (${kind})`);
  console.log(`[db] previous value saved in .env.backup`);
  console.log("[db] restart the backend for this to take effect.");
  if (kind === "Atlas") {
    console.log(
      "[db] reminder: Atlas > Network Access must allow your IP, or the\n" +
        "     server will fail with MongoServerSelectionError."
    );
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

async function main() {
  const mode = process.argv[2];
  const inlineUri = process.argv[3];

  if (mode === "show") {
    const uri = currentUri(readEnv());
    if (!uri) {
      console.log("[db] MONGODB_URI is not set in .env");
      return;
    }
    const kind = /mongodb\.net/.test(uri) ? "Atlas" : "local";
    console.log(`[db] current target: ${mask(uri)}  (${kind})`);
    return;
  }

  if (mode === "local") {
    writeUri(LOCAL_URI);
    return;
  }

  if (mode === "atlas") {
    let uri = inlineUri;
    if (!uri) {
      console.log(
        "Paste your Atlas connection string.\n" +
          "  Atlas dashboard -> Connect -> Drivers -> Node.js\n" +
          "  It looks like: mongodb+srv://user:password@cluster.mongodb.net/\n"
      );
      uri = await ask("Atlas URI: ");
    }
    writeUri(normalise(uri));
    return;
  }

  console.log(
    "Usage:\n" +
      "  npm run db:show\n" +
      "  npm run db:local\n" +
      "  npm run db:atlas\n" +
      '  npm run db:atlas -- "mongodb+srv://user:pass@cluster.mongodb.net/juicedb"'
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[db] failed:", err.message);
  process.exit(1);
});
