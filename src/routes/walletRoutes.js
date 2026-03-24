const express = require("express");
const router = express.Router();

const Wallet = require("../models/Wallet");
const logAudit = require("../utils/auditLogger");

const { protectUser, protectAdmin } = require("../middleware/authMiddleware"); // ✅ FIXED
const { authorize } = require("../middleware/permissionMiddleware");

/* =========================
   GET MY WALLET
========================= */
router.get("/me", protectUser, async (req, res) => {
  try {

    let wallet = await Wallet.findOne({
      user: req.user._id
    });

    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
        balance: 0,
        transactions: []
      });
    }

    res.json(wallet);

  } catch (err) {
    console.error("🔥 ME WALLET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   GET TRANSACTIONS
========================= */
router.get("/:userId/transactions", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({
      user: req.params.userId   // ✅ FIXED
    });

    if (!wallet) return res.json([]);

    const transactions = wallet.transactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(transactions);

  } catch (err) {
    console.error("🔥 TX ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   ADMIN ADD BALANCE
========================= */
router.put(
  "/:userId/add-balance",
  protectAdmin,
  authorize("wallet.manage"),
  async (req, res) => {
    try {
      const { amount } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      let wallet = await Wallet.findOne({
        user: req.params.userId   // ✅ FIXED
      });

      if (!wallet) {
        wallet = await Wallet.create({
          user: req.params.userId,   // ✅ FIXED
          balance: 0,
          transactions: []
        });
      }

      wallet.balance += Number(amount);

      wallet.transactions.push({
        amount: Number(amount),
        type: "credit",
        source: "bonus", // optional
        description: "Admin balance added"
      });

      await wallet.save();

      await logAudit({
        adminId: req.admin._id,
        action: "wallet_balance_added",
        resource: "Wallet",
        resourceId: wallet._id,
        metadata: {
          userId: req.params.userId,
          amountAdded: amount,
          processedBy: req.admin.email
        }
      });

      res.json({
        message: "Balance added successfully",
        balance: wallet.balance
      });

    } catch (err) {
      console.error("🔥 ADMIN WALLET ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;