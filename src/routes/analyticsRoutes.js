const express = require("express");
const router = express.Router();

const { protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

const {
  getDashboardStats,
  getWeeklyEarnings,
} = require("../controllers/analyticsController");

/* =========================
   ANALYTICS
========================= */
router.get(
  "/dashboard",
  protectAdmin,
  authorize("analytics.view"),
  getDashboardStats
);

router.get(
  "/weekly-earnings",
  protectAdmin,
  authorize("analytics.view"),
  getWeeklyEarnings
);

module.exports = router;