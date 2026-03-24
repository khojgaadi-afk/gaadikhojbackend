const express = require("express");
const router = express.Router();

// ✅ FIXED
const { protectAdmin } = require("../middleware/authMiddleware");

const {
  getDashboardStats,
  getWeeklyEarnings,
} = require("../controllers/analyticsController");

router.get("/dashboard", protectAdmin, getDashboardStats);
router.get("/weekly-earnings", protectAdmin, getWeeklyEarnings);

module.exports = router;