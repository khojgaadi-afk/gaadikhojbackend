const Withdrawal = require("../models/Withdrawal");
const Wallet = require("../models/Wallet");
const logAudit = require("../utils/auditLogger");
const { sendPayout } = require("../services/payoutService");

/* ==============================
   USER CREATE WITHDRAWAL
============================== */

const createWithdrawal = async (req, res) => {
  try {
    const { amount, upiId, accountNumber, ifsc, name } = req.body;

    const amountNum = Number(amount);

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (amountNum < 100) {
      return res.status(400).json({
        message: "Minimum withdrawal is ₹100",
      });
    }

    if (!upiId && (!accountNumber || !ifsc || !name)) {
      return res.status(400).json({
        message: "Provide UPI or bank details",
      });
    }

    const pending = await Withdrawal.findOne({
      user: req.user._id,
      status: "pending",
    });

    if (pending) {
      return res.status(400).json({
        message: "You already have a pending withdrawal",
      });
    }

    const wallet = await Wallet.findOneAndUpdate(
      {
        user: req.user._id,
        balance: { $gte: amountNum },
      },
      {
        $inc: { balance: -amountNum },
      },
      { new: true }
    );

    if (!wallet) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    const withdrawal = await Withdrawal.create({
      user: req.user._id,
      amount: amountNum,
      upiId,
      accountNumber,
      ifsc,
      name,
      status: "pending",
    });

    wallet.transactions.push({
      amount: amountNum,
      type: "debit",
      source: "withdraw",
      description: "Withdraw request (locked)",
      refId: withdrawal._id,
    });

    await wallet.save();

    res.status(201).json(withdrawal);

  } catch (err) {
    console.error("❌ Create Withdrawal Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ==============================
   ADMIN GET ALL WITHDRAWALS
============================== */

const getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(withdrawals);

  } catch (err) {
    console.error("❌ Get Withdrawals Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ==============================
   ADMIN PROCESS WITHDRAWAL (FIXED)
============================== */

const processWithdrawal = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const withdrawal = await Withdrawal.findById(req.params.id).populate("user");

    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Already processed" });
    }

    withdrawal.status = status;
    withdrawal.adminNote = adminNote;

    /* ======================
       PAYOUT
    ====================== */

    if (status === "approved") {
      try {
        const payout = await sendPayout({
          amount: withdrawal.amount,
          upiId: withdrawal.upiId,
          name: withdrawal.name || "User",
          phone: "9999999999",
        });

        withdrawal.cashfreeTransferId =
          payout?.transferId ||
          payout?.data?.transferId ||
          null;

      } catch (payoutErr) {
        console.error("❌ Payout failed:", payoutErr.message);

        const wallet = await Wallet.findOne({ user: withdrawal.user });

        if (wallet) {
          wallet.balance += withdrawal.amount;

          wallet.transactions.push({
            amount: withdrawal.amount,
            type: "credit",
            source: "withdraw",
            description: "Payout failed (refund)",
            refId: withdrawal._id,
          });

          await wallet.save();
        }

        return res.status(500).json({
          message: "Payout failed & refunded",
        });
      }
    }

    await withdrawal.save();

    /* ======================
       REJECT REFUND
    ====================== */

    if (status === "rejected") {
      const wallet = await Wallet.findOne({ user: withdrawal.user });

      if (wallet) {
        wallet.balance += withdrawal.amount;

        wallet.transactions.push({
          amount: withdrawal.amount,
          type: "credit",
          source: "withdraw",
          description: "Withdrawal rejected (refund)",
          refId: withdrawal._id,
        });

        await wallet.save();
      }
    }

    /* ======================
       SAFE AUDIT LOG
    ====================== */

    const adminId = req.admin?._id;

    if (adminId) {
      await logAudit({
        adminId,
        action:
          status === "approved"
            ? "withdrawal_approved"
            : "withdrawal_rejected",
        resource: "Withdrawal",
        resourceId: withdrawal._id,
        metadata: {
          amount: withdrawal.amount,
          user: withdrawal.user,
          processedBy: req.admin.email,
        },
      });
    }

    res.json({
      message: `Withdrawal ${status} successfully`,
      transferId: withdrawal.cashfreeTransferId || null,
    });

  } catch (err) {
    console.error("❌ Process Withdrawal Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createWithdrawal,
  getAllWithdrawals,
  processWithdrawal,
};