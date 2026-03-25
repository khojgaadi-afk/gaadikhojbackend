const express = require("express");
const router = express.Router();

const withdrawalController = require("../controllers/withdrawalController");
const Withdrawal = require("../models/Withdrawal");

const {
  protectUser,
  protectAdmin,
} = require("../middleware/authMiddleware");

const { authorize } = require("../middleware/permissionMiddleware");

/* =========================
   USER ROUTES
========================= */

// Create withdrawal
router.post(
  "/",
  protectUser,
  withdrawalController.createWithdrawal
);

// User withdrawal history
router.get("/my", protectUser, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    console.error("❌ My withdrawals error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   ADMIN ROUTES
========================= */

// Get all withdrawals
router.get(
  "/",
  protectAdmin,
  authorize("withdrawals.process"),
  withdrawalController.getAllWithdrawals
);

// Get single withdrawal
router.get(
  "/:id",
  protectAdmin,
  authorize("withdrawals.process"),
  async (req, res) => {
    try {
      const withdrawal = await Withdrawal.findById(req.params.id)
        .populate("user", "name email");

      if (!withdrawal) {
        return res.status(404).json({
          message: "Withdrawal not found",
        });
      }

      res.json(withdrawal);
    } catch (err) {
      console.error("❌ Get withdrawal error:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

// Approve / Reject
router.put(
  "/:id/process",
  protectAdmin,
  authorize("withdrawals.process"),
  withdrawalController.processWithdrawal
);

module.exports = router;