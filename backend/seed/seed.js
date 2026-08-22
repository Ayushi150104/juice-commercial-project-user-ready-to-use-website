/**
 * seed/seed.js
 * Purpose: idempotent database seeding — safe to run repeatedly.
 *  - admin user (ADMIN_EMAIL / ADMIN_PASSWORD from .env)
 *  - the 4 juices previously hardcoded in cards.jsx (images copied from
 *    ../src/assets into /uploads/products and served by this API)
 *  - customizer options with priceModifiers reproducing the old
 *    client-side formula (fruit ₹20, Mixed Juice ₹120, bases/extras ₹0)
 * Run: npm run seed
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const env = require("../config/env");
const User = require("../models/User");
const Product = require("../models/Product");
const CustomizerOption = require("../models/CustomizerOption");

// Works with both layouts: <root>/src/assets (frontend at repo root)
// and <root>/frontend/src/assets (frontend/ + backend/ side by side)
const ASSET_CANDIDATES = [
  path.join(__dirname, "..", "..", "src", "assets"),
  path.join(__dirname, "..", "..", "frontend", "src", "assets"),
];
const FRONTEND_ASSETS =
  ASSET_CANDIDATES.find((p) => fs.existsSync(p)) || ASSET_CANDIDATES[0];
const UPLOADS = path.join(__dirname, "..", "uploads", "products");

const PRODUCTS = [
  { name: "Nimbu Pani", address: "123 Street A", time: "30 min", price: 55, asset: "mocktail1.png" },
  { name: "Orange Juice", address: "456 Street B", time: "15 min", price: 50, asset: "mocktail2.png" },
  { name: "Strawberry Juice", address: "789 Street C", time: "20 min", price: 35, asset: "mocktail3.png" },
  { name: "Special Mocktail", address: "101 Street D", time: "3:00 PM", price: 40, asset: "mocktail4.png" },
];

const OPTIONS = [
  ...[
    "🍎 Apple", "🍌 Banana", "🍓 Strawberry", "🍍 Pineapple", "🥭 Mango",
    "🍇 Grapes", "🍉 Watermelon", "🍊 Orange", "🍒 Cherry", "🥝 Kiwi",
  ].map((label, i) => ({ type: "fruit", label, priceModifier: 20, sortOrder: i })),
  { type: "fruit", label: "🥤 Mixed Juice", priceModifier: 120, sortOrder: 10 },
  { type: "base", label: "💧 Water", priceModifier: 0, sortOrder: 0 },
  { type: "base", label: "🥛 Milk", priceModifier: 0, sortOrder: 1 },
  { type: "base", label: "🍶 Yogurt", priceModifier: 0, sortOrder: 2 },
  { type: "extra", label: "💪 Protein", priceModifier: 0, sortOrder: 0 },
  { type: "extra", label: "🍯 Honey", priceModifier: 0, sortOrder: 1 },
];

function copyAsset(asset) {
  const src = path.join(FRONTEND_ASSETS, asset);
  if (!fs.existsSync(src)) {
    console.warn(`[seed] frontend asset not found: ${src} — product will have no image`);
    return { image: "", imageRef: "" };
  }
  fs.mkdirSync(UPLOADS, { recursive: true });
  const dest = path.join(UPLOADS, asset);
  fs.copyFileSync(src, dest);
  return { image: `/uploads/products/${asset}`, imageRef: `local:products/${asset}` };
}

async function run() {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("[seed] connected to", env.mongoUri);

  // --- admin ---
  let admin = await User.findOne({ email: env.admin.email });
  if (!admin) {
    admin = await User.create({
      name: env.admin.name,
      email: env.admin.email,
      password: env.admin.password,
      role: "admin",
    });
    console.log(`[seed] admin created: ${admin.email}`);
  } else {
    console.log(`[seed] admin already exists: ${admin.email}`);
  }

  // --- products ---
  for (const p of PRODUCTS) {
    const exists = await Product.findOne({ name: p.name, isDeleted: false });
    if (exists) {
      console.log(`[seed] product exists: ${p.name}`);
      continue;
    }
    const { image, imageRef } = copyAsset(p.asset);
    await Product.create({
      name: p.name,
      address: p.address,
      time: p.time,
      price: p.price,
      image,
      imageRef,
    });
    console.log(`[seed] product created: ${p.name}`);
  }

  // --- customizer options ---
  for (const opt of OPTIONS) {
    const exists = await CustomizerOption.findOne({
      type: opt.type,
      label: opt.label,
    });
    if (exists) continue;
    await CustomizerOption.create(opt);
    console.log(`[seed] option created: [${opt.type}] ${opt.label}`);
  }

  const counts = {
    users: await User.countDocuments(),
    products: await Product.countDocuments({ isDeleted: false }),
    options: await CustomizerOption.countDocuments(),
  };
  console.log("[seed] done:", counts);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
