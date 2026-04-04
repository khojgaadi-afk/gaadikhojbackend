const express = require("express");
const router = express.Router();

const {
  createLostVehicle,
  getMyLostVehicles,
  getApprovedLostVehicles,
  adminGetLostVehicles,
  approveLostVehicle,
  rejectLostVehicle,
  markVehicleFound,
} = require("../controllers/lostVehicleController");

const {
  protect,
  protectAdmin,
} = require("../middleware/authMiddleware");

const upload = require("../utils/upload");
const { authorize } = require("../middleware/permissionMiddleware");

/* =========================================================
   USER ROUTES
========================================================= */

// Public approved vehicles
router.get("/", getApprovedLostVehicles);

// Logged-in user's own vehicles
router.get("/my", protect, getMyLostVehicles);

// User create lost vehicle report
router.post(
  "/",
  protect,
  upload.fields([
    { name: "vehiclePhotos", maxCount: 5 },
    { name: "rcDocument", maxCount: 1 },
    { name: "firDocument", maxCount: 1 },
    { name: "aadharDocument", maxCount: 1 },
  ]),
  createLostVehicle
);

/* =========================================================
   ADMIN ROUTES
========================================================= */

// Get all lost vehicles
router.get(
  "/admin/all",
  protectAdmin,
  authorize("reports"),
  adminGetLostVehicles
);

// Approve
router.patch(
  "/admin/:id/approve",
  protectAdmin,
  authorize("reports"),
  approveLostVehicle
);

// Reject
router.patch(
  "/admin/:id/reject",
  protectAdmin,
  authorize("reports"),
  rejectLostVehicle
);

// Mark found / deactivate
router.patch(
  "/admin/:id/deactivate",
  protectAdmin,
  authorize("reports"),
  markVehicleFound
);

module.exports = router;