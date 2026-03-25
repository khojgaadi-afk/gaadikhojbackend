const mongoose = require("mongoose");

const lostVehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    vehicleType: {
      type: String,
      enum: ["car", "bike", "scooter", "truck"],
      required: true,
    },

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

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    brandModel: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    area: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    platformFee: {
      type: Number,
      default: 299,
      min: 0,
    },

    vehiclePhotos: {
      type: [String],
      default: [],
    },

    rcDocument: {
      type: String,
      default: null,
    },

    firDocument: {
      type: String,
      default: null,
    },

    aadharDocument: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "found"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LostVehicle", lostVehicleSchema);
