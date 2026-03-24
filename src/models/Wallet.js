const mongoose = require("mongoose");

/* ==========================
   TRANSACTION SCHEMA
========================== */

const transactionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },

    /* 🔥 ADD THIS */
    source: {
      type: String,
      enum: ["ad", "referral", "withdraw", "bonus"],
      default: "ad",
    },

    description: {
      type: String,
      default: "",
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
);

/* ==========================
   WALLET SCHEMA
========================== */

const walletSchema = new mongoose.Schema(
  {
    user: {
      // ✅ FIXED (user → user)
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
    },

    transactions: [transactionSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Wallet", walletSchema);
