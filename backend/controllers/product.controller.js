/**
 * controllers/product.controller.js
 * Purpose: public product listing (feeds cards.jsx) + admin CRUD with
 * image upload/replace/delete and soft delete.
 */
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");
const uploadService = require("../services/upload.service");

// GET /api/products  (public)
const listProducts = asyncHandler(async (_req, res) => {
  const products = await Product.find({ isDeleted: false, isAvailable: true })
    .sort({ createdAt: 1 })
    .select("-isDeleted -deletedAt -imageRef -__v");
  return ok(res, { products });
});

// GET /api/products/:id  (public)
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  }).select("-isDeleted -deletedAt -imageRef -__v");
  if (!product) throw ApiError.notFound("Product not found");
  return ok(res, { product });
});

// POST /api/products  (admin, multipart: image?)
const createProduct = asyncHandler(async (req, res) => {
  const { name, price, address = "", time = "", isAvailable = true } = req.body;

  let image = "";
  let imageRef = "";
  if (req.file) {
    const saved = await uploadService.saveImage(req.file);
    image = saved.url;
    imageRef = saved.ref;
  }

  const product = await Product.create({
    name,
    price,
    address,
    time,
    isAvailable,
    image,
    imageRef,
  });
  return created(res, { product }, "Product created");
});

// PUT /api/products/:id  (admin, multipart: image?)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw ApiError.notFound("Product not found");

  const updatable = ["name", "price", "address", "time", "isAvailable"];
  for (const field of updatable) {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  }

  if (req.file) {
    const saved = await uploadService.saveImage(req.file);
    // replace: remove the old file/cloudinary asset
    if (product.imageRef) await uploadService.deleteImage(product.imageRef);
    product.image = saved.url;
    product.imageRef = saved.ref;
  }

  await product.save();
  return ok(res, { product }, "Product updated");
});

// DELETE /api/products/:id  (admin — soft delete, order history keeps its snapshots)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw ApiError.notFound("Product not found");

  product.isDeleted = true;
  product.deletedAt = new Date();
  product.isAvailable = false;
  await product.save();

  return ok(res, null, "Product deleted");
});

// DELETE /api/products/:id/image  (admin — remove image only)
const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw ApiError.notFound("Product not found");

  if (product.imageRef) await uploadService.deleteImage(product.imageRef);
  product.image = "";
  product.imageRef = "";
  await product.save();

  return ok(res, { product }, "Product image removed");
});

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
};
