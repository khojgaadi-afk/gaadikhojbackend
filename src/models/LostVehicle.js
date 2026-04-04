const mongoose = require("mongoose");

const lostVehicleSchema = new mongoose.Schema(
  {
    /* =========================
       USER RELATION
    ========================= */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* =========================
       VEHICLE BASIC INFO
    ========================= */
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

    brandModel: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    /* =========================
       LOCATION
    ========================= */
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

    phone: {
      type: String,
      required: true,
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

    paidAt: {
      type: Date,
      default: null,
    },

    /* =========================
       DOCUMENTS / PHOTOS
    ========================= */
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

    /* =========================
       ADMIN REVIEW FLOW
    ========================= */
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "found"],
      default: "pending",
      index: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    /* =========================
       PUBLIC VISIBILITY / SAFETY
    ========================= */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    foundAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/* =========================
   INDEXES
========================= */
lostVehicleSchema.index({ createdAt: -1 });
lostVehicleSchema.index({ user: 1, status: 1 });
lostVehicleSchema.index({ city: 1, area: 1, status: 1 });
lostVehicleSchema.index({ paymentStatus: 1, status: 1 });

/* =========================
   OPTIONAL SAFETY:
   prevent duplicate active same vehicle per user
========================= */
lostVehicleSchema.index(
  { user: 1, vehicleNumber: 1, isActive: 1 },
  { unique: false }
);

module.exports = mongoose.model("LostVehicle", lostVehicleSchema);