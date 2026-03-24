const express = require("express");
const router = express.Router();

const AuditLog = require("../models/AuditLog");
const { protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

router.get(
  "/",
  protectAdmin,
  authorize("audit.view"),
  async (req, res) => {
    const logs = await AuditLog.find()
      .populate("adminId", "name email")
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(logs);
  }
);

module.exports = router;
