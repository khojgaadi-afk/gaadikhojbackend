const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    carNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    area: {
      type: String,
      required: true,
      trim: true,
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
      },
      lng: {
        type: Number,
        default: null,
      },
    },

    photoUrl: {
      type: String,
      default: null,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "active", "expired"],
      default: "pending",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin", // ✅ FIXED
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);