const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    refId: {
      type: String, // submission id
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      default: "credit",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reward", rewardSchema);
