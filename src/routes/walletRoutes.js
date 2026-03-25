const express = require("express");
const router = express.Router();

const Wallet = require("../models/Wallet");
const logAudit = require("../utils/auditLogger");

const { protectUser, protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

/* =========================
   GET MY WALLET
========================= */
router.get("/me", protectUser, async (req, res) => {
  try {
    let wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
        balance: 0,
        transactions: [],
      });
    }

    res.json(wallet);
  } catch (err) {
    console.error("🔥 ME WALLET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================
   GET MY TRANSACTIONS
========================= */
router.get("/me/transactions", protectUser, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) return res.json([]);

    const transactions = wallet.transactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(transactions);
  } catch (err) {
    console.error("🔥 MY TX ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   ADMIN GET USER TRANSACTIONS
========================= */
router.get(
  "/:userId/transactions",
  protectAdmin,
  authorize("wallet.manage"),
  async (req, res) => {
    try {
      const wallet = await Wallet.findOne({
        user: req.params.userId,
      });

      if (!wallet) return res.json([]);

      const transactions = wallet.transactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      res.json(transactions);
    } catch (err) {
      console.error("🔥 ADMIN TX ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

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
      const amountNum = Number(amount);

      if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      let wallet = await Wallet.findOne({
        user: req.params.userId,
      });

      if (!wallet) {
        wallet = await Wallet.create({
          user: req.params.userId,
          balance: 0,
          transactions: [],
        });
      }

      wallet.balance += amountNum;

      wallet.transactions.push({
        amount: amountNum,
        type: "credit",
        source: "bonus",
        description: "Admin balance added",
      });

      await wallet.save();

      await logAudit({
        adminId: req.admin._id,
        action: "wallet_balance_added",
        resource: "Wallet",
        resourceId: wallet._id,
        metadata: {
          userId: req.params.userId,
          amountAdded: amountNum,
          processedBy: req.admin.email,
        },
      });

      res.json({
        message: "Balance added successfully",
        balance: wallet.balance,
      });
    } catch (err) {
      console.error("🔥 ADMIN WALLET ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;