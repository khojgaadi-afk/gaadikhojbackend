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
      maxlength: 100,
    },

    accountNumber: {
      type: String,
      default: null,
      trim: true,
      maxlength: 30,
    },

    ifsc: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },

    name: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },

    /* STATUS */
    status: {
      type: String,
      enum: ["pending", "processing", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    /* ADMIN */
    adminNote: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    /* PAYOUT */
    cashfreeTransferId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ==========================
   INDEXES
========================== */

/* One pending withdrawal per user */
withdrawalSchema.index(
  { user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

/* ==========================
   NORMALIZE AMOUNT
========================== */
withdrawalSchema.pre("save", function (next) {
  this.amount = Number(Number(this.amount).toFixed(2));
  next();
});

/* ==========================
   CLEAN JSON OUTPUT
========================== */
withdrawalSchema.set("toJSON", {
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);