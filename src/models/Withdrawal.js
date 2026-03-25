const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    /* PAYMENT DETAILS */
    upiId: {
      type: String,
      default: null,
      trim: true,
    },

    accountNumber: {
      type: String,
      default: null,
      trim: true,
    },

    ifsc: {
      type: String,
      default: null,
      trim: true,
    },

    name: {
      type: String,
      default: null,
      trim: true,
    },

    /* STATUS */
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    /* ADMIN */
    adminNote: {
      type: String,
      default: null,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    /* CASHFREE */
    cashfreeTransferId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);