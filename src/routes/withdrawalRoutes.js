const express = require("express");
const router = express.Router();

const withdrawalController = require("../controllers/withdrawalController");
const Withdrawal = require("../models/Withdrawal");

/* =========================
   USER ROUTES
========================= */

// Create withdrawal
router.post("/", withdrawalController.createWithdrawal);

// User withdrawal history
router.get("/my", async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      user: req.user?._id, // safe optional
    }).sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    console.error("❌ My withdrawals error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   ADMIN ROUTES (NO AUTH - TEST MODE)
========================= */

// Get all withdrawals
router.get("/", withdrawalController.getAllWithdrawals);

// Get single withdrawal
router.get("/:id", async (req, res) => {
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
});

// Approve / Reject
router.put("/:id/process", withdrawalController.processWithdrawal);

module.exports = router;