const express = require("express");
const router = express.Router();

const { protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

const {
  createAdmin,
  getAdmins,
  toggleAdminStatus,
  updateAdminPermissions, // 🔥 NEW
} = require("../controllers/adminController");

/* =========================
   CREATE ADMIN
========================= */
router.post(
  "/",
  protectAdmin,
  authorize("admins.manage"),
  createAdmin
);

/* =========================
   GET ALL ADMINS
========================= */
router.get(
  "/",
  protectAdmin,
  authorize("admins.manage"),
  getAdmins
);

/* =========================
   TOGGLE STATUS
========================= */
router.put(
  "/:id/toggle",
  protectAdmin,
  authorize("admins.manage"),
  toggleAdminStatus
);

/* =========================
   UPDATE PERMISSIONS 🔥
========================= */
router.put(
  "/:id/permissions",
  protectAdmin,
  authorize("admins.manage"), // ya sirf superadmin agar strict chahiye
  updateAdminPermissions
);

module.exports = router;