const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    action: {
      type: String,
      required: true,
    },

    resource: {
      type: String,
      required: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    metadata: {
      type: Object,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditSchema);
