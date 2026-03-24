const mongoose = require("mongoose");

const adminSessionSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    ipAddress: String,

    userAgent: String,

    loginTime: {
      type: Date,
      default: Date.now,
    },

    logoutTime: Date,

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminSession", adminSessionSchema);
