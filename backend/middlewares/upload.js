/**
 * middlewares/upload.js
 * Purpose: multer config for product images. Memory storage (the
 * upload service decides whether bytes go to disk or Cloudinary).
 * Limits: 2 MB, images only (png/jpg/jpeg/webp/gif).
 */
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest("Only png, jpg, webp or gif images are allowed", {
          code: "BAD_FILE_TYPE",
        })
      );
    }
    cb(null, true);
  },
});

module.exports = { uploadProductImage: upload.single("image") };
