const express = require("express");
const router = express.Router();

const { getReferralStats } = require("../controllers/referralController");

// ✅ FIXED
const { protectUser } = require("../middleware/authMiddleware");

router.get("/stats", protectUser, getReferralStats);

module.exports = router;