const express = require("express");
const router = express.Router();

const AuditLog = require("../models/AuditLog");
const { protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

/* =========================
   GET AUDIT LOGS
========================= */
router.get(
  "/",
  protectAdmin,
  authorize("audit.view"),
  async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;

      const logs = await AuditLog.find()
        .populate("adminId", "name email")
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      res.json(logs);

    } catch (err) {
      console.error("❌ Audit logs error:", err);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

module.exports = router;