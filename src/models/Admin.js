const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["superadmin", "moderator", "finance"],
      default: "moderator",
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    // 🔥 Password Reset Fields
    resetToken: {
      type: String,
    },

    resetTokenExpire: {
      type: Date,
    },
  },
  { timestamps: true }
);

// 🔐 Hash password before save
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// 🔐 Match password
adminSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);
