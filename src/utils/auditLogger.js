const AuditLog = require("../models/AuditLog");

const logAudit = async ({
  adminId,
  action,
  resource,
  resourceId,
  metadata = {},
}) => {
  console.log("🔥 logAudit ENTERED");

  try {
    if (!adminId) {
      console.log("❌ adminId missing");
      return;
    }

    const log = await AuditLog.create({
      adminId,
      action,
      resource,
      resourceId,
      metadata,
    });

    console.log("✅ Audit Saved:", log._id);
  } catch (err) {
    console.error("❌ FULL AUDIT ERROR:", err);
  }
};

module.exports = logAudit;
