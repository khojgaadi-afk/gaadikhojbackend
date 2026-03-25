const express = require("express");
const router = express.Router();

const {
  protectAdmin,
  protectUser,
} = require("../middleware/authMiddleware");

const { authorizeRoles } = require("../middleware/roleMiddleware");

const User = require("../models/User");

const {
  getAllUsers,
  toggleUserStatus,
  getUserTransactions,
  getLeaderboard,
  getSuspiciousUsers,
  forgotPassword,
  resetPassword,
} = require("../controllers/userController");

/* =========================
   AUTH ROUTES
========================= */
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword); // keep if controller expects body token

/* =========================
   USER ROUTES
========================= */
router.get("/me", protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/leaderboard", getLeaderboard);

/* =========================
   ADMIN ROUTES
========================= */
router.get(
  "/suspicious",
  protectAdmin,
  authorizeRoles("superadmin"),
  getSuspiciousUsers
);

router.get(
  "/",
  protectAdmin,
  authorizeRoles("superadmin"),
  getAllUsers
);

router.put(
  "/:id/toggle",
  protectAdmin,
  authorizeRoles("superadmin"),
  toggleUserStatus
);

router.get(
  "/:id/transactions",
  protectAdmin,
  authorizeRoles("superadmin", "finance"),
  getUserTransactions
);

module.exports = router;