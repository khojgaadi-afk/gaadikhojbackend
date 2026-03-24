const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    upiId: {
      type: String,
      default: null,
    },

    accountNumber: {
      type: String,
      default: null,
    },

    ifsc: {
      type: String,
      default: null,
    },

    name: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    adminNote: {
      type: String,
      default: null,
    },
    // cashfree setup
    cashfreeTransferId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
