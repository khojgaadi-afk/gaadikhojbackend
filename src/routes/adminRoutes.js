const express = require("express");
const router = express.Router();

// ✅ FIXED IMPORT
const { protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

const {
  createAdmin,
  getAdmins,
  toggleAdminStatus,
} = require("../controllers/adminController");

// Create admin
router.post(
  "/",
  protectAdmin,
  authorize("admins.manage"),
  createAdmin
);

// Get all admins
router.get(
  "/",
  protectAdmin,
  authorize("admins.manage"),
  getAdmins
);

// Toggle admin status
router.put(
  "/:id/toggle",
  protectAdmin,
  authorize("admins.manage"),
  toggleAdminStatus
);

module.exports = router;