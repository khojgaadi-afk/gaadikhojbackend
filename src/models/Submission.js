const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LostVehicle",
      default: null,
      index: true,
    },

    photoUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

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

    distanceKm: {
      type: Number,
      default: null,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    rewardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/* ==========================
   INDEXES
========================== */

// One active submission per post
submissionSchema.index(
  { post: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      post: { $exists: true, $ne: null },
      status: { $in: ["pending", "approved"] },
    },
  }
);

// One active submission per vehicle
submissionSchema.index(
  { vehicle: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      vehicle: { $exists: true, $ne: null },
      status: { $in: ["pending", "approved"] },
    },
  }
);

// Same user cannot submit same post twice
submissionSchema.index(
  { user: 1, post: 1 },
  {
    unique: true,
    partialFilterExpression: {
      post: { $exists: true, $ne: null },
    },
  }
);

// Same user cannot submit same vehicle twice
submissionSchema.index(
  { user: 1, vehicle: 1 },
  {
    unique: true,
    partialFilterExpression: {
      vehicle: { $exists: true, $ne: null },
    },
  }
);

/* ==========================
   VALIDATION
========================== */
submissionSchema.pre("validate", function (next) {
  const hasPost = !!this.post;
  const hasVehicle = !!this.vehicle;

  if ((hasPost && hasVehicle) || (!hasPost && !hasVehicle)) {
    return next(
      new Error("Submission must belong to either a post or a vehicle, not both")
    );
  }

  this.rewardAmount = Number(Number(this.rewardAmount || 0).toFixed(2));

  if (this.distanceKm !== null && this.distanceKm !== undefined) {
    this.distanceKm = Number(Number(this.distanceKm).toFixed(2));
  }

  next();
});

/* ==========================
   CLEAN JSON OUTPUT
========================== */
submissionSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Submission", submissionSchema);