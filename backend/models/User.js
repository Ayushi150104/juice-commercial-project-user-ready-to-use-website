/**
 * models/User.js
 * Purpose: user accounts with bcrypt-hashed passwords, roles and
 * hashed refresh-token sessions (revocable, capped at 5 devices).
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name must be at most 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // never returned by default
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
      index: true,
    },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
  },
  { timestamps: true }
);

// Hash password on create/change
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
