const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema(
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
      min: 0,
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      default: "credit",
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
      ],
      default: "submission",
      index: true,
    },

    status: {
      type: String,
      enum: ["completed", "pending", "reversed", "failed"],
      default: "completed",
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

/* ============================
   INDEXES
============================ */
rewardSchema.index(
  { user: 1, refId: 1, type: 1, source: 1 },
  {
    unique: true,
    partialFilterExpression: { refId: { $ne: null } },
  }
);

/* ============================
   VALIDATION
============================ */
rewardSchema.pre("validate", function (next) {
  if (
    ["submission", "referral", "withdrawal"].includes(this.source) &&
    !this.refId
  ) {
    return next(new Error(`refId is required for source: ${this.source}`));
  }

  next();
});

rewardSchema.pre("save", function (next) {
  this.amount = Number(Number(this.amount).toFixed(2));
  next();
});

module.exports = mongoose.model("Reward", rewardSchema);