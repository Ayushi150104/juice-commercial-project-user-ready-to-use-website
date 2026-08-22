/**
 * controllers/customizer.controller.js
 * Purpose: serves the Customizer panel's fruits/bases/extras from the DB
 * (grouped exactly how the component consumes them) + admin CRUD.
 */
const CustomizerOption = require("../models/CustomizerOption");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created } = require("../utils/response");

// GET /api/customizer/options  (public)
const listOptions = asyncHandler(async (_req, res) => {
  const options = await CustomizerOption.find({ isAvailable: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .select("-__v");

  const grouped = { fruits: [], bases: [], extras: [] };
  for (const opt of options) {
    if (opt.type === "fruit") grouped.fruits.push(opt);
    else if (opt.type === "base") grouped.bases.push(opt);
    else grouped.extras.push(opt);
  }
  return ok(res, grouped);
});

// POST /api/customizer/options  (admin)
const createOption = asyncHandler(async (req, res) => {
  const { type, label, priceModifier = 0, isAvailable = true, sortOrder = 0 } =
    req.body;
  const option = await CustomizerOption.create({
    type,
    label,
    priceModifier,
    isAvailable,
    sortOrder,
  });
  return created(res, { option }, "Option created");
});

// PUT /api/customizer/options/:id  (admin)
const updateOption = asyncHandler(async (req, res) => {
  const option = await CustomizerOption.findById(req.params.id);
  if (!option) throw ApiError.notFound("Option not found");

  const updatable = ["type", "label", "priceModifier", "isAvailable", "sortOrder"];
  for (const field of updatable) {
    if (req.body[field] !== undefined) option[field] = req.body[field];
  }
  await option.save();
  return ok(res, { option }, "Option updated");
});

// DELETE /api/customizer/options/:id  (admin — hard delete; historical
// orders keep label snapshots, so nothing dangles)
const deleteOption = asyncHandler(async (req, res) => {
  const option = await CustomizerOption.findById(req.params.id);
  if (!option) throw ApiError.notFound("Option not found");
  await CustomizerOption.deleteOne({ _id: option._id });
  return ok(res, null, "Option deleted");
});

module.exports = { listOptions, createOption, updateOption, deleteOption };
