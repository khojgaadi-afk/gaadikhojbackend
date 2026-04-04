const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use valid email"],
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["superadmin", "moderator", "finance"],
      default: "moderator",
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
      index: true,
    },

    /* ==========================
       ADMIN PERMISSIONS
    ========================== */
    permissions: {
      dashboard: {
        type: Boolean,
        default: true,
      },
      users: {
        type: Boolean,
        default: false,
      },
      tasks: {
        type: Boolean,
        default: false,
      },
      submissions: {
        type: Boolean,
        default: false,
      },
      reports: {
        type: Boolean,
        default: false,
      },
      withdrawals: {
        type: Boolean,
        default: false,
      },
      wallet: {
        type: Boolean,
        default: false,
      },
      admins: {
        type: Boolean,
        default: false,
      },
      settings: {
        type: Boolean,
        default: false,
      },
      analytics: {
        type: Boolean,
        default: false,
      },
    },

    /* ==========================
       PASSWORD RESET
    ========================== */
    resetToken: {
      type: String,
      default: null,
      select: false,
    },

    resetTokenExpire: {
      type: Date,
      default: null,
    },

    /* ==========================
       TOKEN INVALIDATION
    ========================== */
    passwordChangedAt: {
      type: Date,
      default: null,
    },

    /* ==========================
       SECURITY / TRACKING
    ========================== */
    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIP: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

/* ==========================
   HASH PASSWORD
========================== */
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);

  // password change track
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }

  next();
});

/* ==========================
   MATCH PASSWORD
========================== */
adminSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("Admin", adminSchema);