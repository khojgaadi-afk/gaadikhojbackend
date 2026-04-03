const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    carNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
      maxlength: 20,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    area: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    rewardAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    /* LOCATION */
    location: {
      lat: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
      },
    },

    photoUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["pending", "active", "expired"],
      default: "pending",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

/* ==========================
   INDEXES
========================== */

/* Prevent duplicate active posts for same car */
postSchema.index(
  { carNumber: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["active", "pending"] },
    },
  }
);

/* Fast search */
postSchema.index({ city: 1 });
postSchema.index({ area: 1 });

/* ==========================
   VALIDATION
========================== */
postSchema.pre("validate", function (next) {
  /* Normalize reward */
  this.rewardAmount = Number(Number(this.rewardAmount).toFixed(2));

  /* Normalize car number */
  if (this.carNumber) {
    this.carNumber = this.carNumber.replace(/\s+/g, "").toUpperCase();
  }

  /* Validate location consistency */
  const hasLat = this.location?.lat !== null && this.location?.lat !== undefined;
  const hasLng = this.location?.lng !== null && this.location?.lng !== undefined;

  if (hasLat !== hasLng) {
    return next(new Error("Both latitude and longitude must be provided together"));
  }

  next();
});

/* ==========================
   CLEAN JSON OUTPUT
========================== */
postSchema.set("toJSON", {
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Post", postSchema);