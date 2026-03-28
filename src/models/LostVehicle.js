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
      index: true,
    },

    vehicleType: {
      type: String,
      enum: ["car", "bike", "scooter", "truck", "commercial"],
      required: true,
      lowercase: true,
      trim: true,
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
      required: true,
      trim: true,
      index: true,
    },

    area: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    /* =========================
       PAYMENT FIELDS
    ========================= */
    recoveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
      index: true,
    },

    vehiclePhotos: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "At least one vehicle photo is required",
      },
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
  { timestamps: true }
);

module.exports = mongoose.model("LostVehicle", lostVehicleSchema);