/**
 * services/upload.service.js
 * Purpose: image storage abstraction.
 *  - local driver: writes to /uploads/products, served at /uploads/*
 *  - cloudinary driver: uploads via SDK when CLOUDINARY_* env vars set
 * Returns { url, ref } — ref is what deleteImage needs later.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("../config/env");
const logger = require("../utils/logger");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");

let cloudinary = null;
if (env.storage.driver === "cloudinary") {
  cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: env.storage.cloudinary.cloudName,
    api_key: env.storage.cloudinary.apiKey,
    api_secret: env.storage.cloudinary.apiSecret,
  });
}

function extFromMime(mimetype) {
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mimetype] || ".png";
}

async function saveImage(file) {
  if (env.storage.driver === "cloudinary") {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "juice-products", resource_type: "image" },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, ref: `cloudinary:${result.public_id}` };
  }

  // local driver
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extFromMime(
    file.mimetype
  )}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return { url: `/uploads/products/${filename}`, ref: `local:products/${filename}` };
}

async function deleteImage(ref) {
  try {
    if (!ref) return;
    if (ref.startsWith("cloudinary:")) {
      if (cloudinary) {
        await cloudinary.uploader.destroy(ref.slice("cloudinary:".length));
      }
      return;
    }
    if (ref.startsWith("local:")) {
      const rel = ref.slice("local:".length);
      const filePath = path.join(__dirname, "..", "uploads", rel);
      // stay inside /uploads no matter what the ref contains
      if (!filePath.startsWith(path.join(__dirname, "..", "uploads"))) return;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (err) {
    // an orphaned image must never break the API response
    logger.warn(`[upload] failed to delete image ${ref}: ${err.message}`);
  }
}

module.exports = { saveImage, deleteImage };
