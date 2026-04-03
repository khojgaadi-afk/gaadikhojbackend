const mongoose = require("mongoose");

/* ==========================
   TRANSACTION SCHEMA
========================== */
const transactionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: [
        "submission",
        "referral",
        "bonus",
        "withdrawal",
        "signup_bonus",
        "admin_bonus",
        "manual_adjustment",
        "refund",
        "ad",
      ],
      default: "submission",
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "completed",
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);

/* Normalize transaction amount */
transactionSchema.pre("save", function (next) {
  this.amount = Number(Number(this.amount).toFixed(2));
  next();
});

/* Clean JSON output */
transactionSchema.set("toJSON", {
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

/* ==========================
   WALLET SCHEMA
========================== */
const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCredited: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDebited: {
      type: Number,
      default: 0,
      min: 0,
    },

    transactions: {
      type: [transactionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* ==========================
   INDEXES
========================== */
walletSchema.index({ user: 1 }, { unique: true });

/* ==========================
   NORMALIZE NUMBERS
========================== */
walletSchema.pre("save", function (next) {
  this.balance = Number(Number(this.balance).toFixed(2));
  this.totalCredited = Number(Number(this.totalCredited).toFixed(2));
  this.totalDebited = Number(Number(this.totalDebited).toFixed(2));
  next();
});

/* ==========================
   CLEAN JSON OUTPUT
========================== */
walletSchema.set("toJSON", {
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Wallet", walletSchema);