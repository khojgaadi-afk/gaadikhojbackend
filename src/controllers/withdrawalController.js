const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const Wallet = require("../models/Wallet");
const logAudit = require("../utils/auditLogger");
const { sendPayout } = require("../services/payoutService");

/* ==============================
   USER CREATE WITHDRAWAL
============================== */
const createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user || !req.user._id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ message: "User not logged in" });
    }

    const { amount, upiId, accountNumber, ifsc, name } = req.body;
    const amountNum = Number(amount);

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (amountNum < 100) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Minimum withdrawal is ₹100",
      });
    }

    if (!upiId && (!accountNumber || !ifsc || !name)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Provide UPI or bank details",
      });
    }

    const pending = await Withdrawal.findOne({
      user: req.user._id,
      status: "pending",
    }).session(session);

    if (pending) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "You already have a pending withdrawal",
      });
    }

    const wallet = await Wallet.findOne({
      user: req.user._id,
    }).session(session);

    if (!wallet || wallet.balance < amountNum) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    wallet.balance -= amountNum;

    const withdrawal = await Withdrawal.create(
      [
        {
          user: req.user._id,
          amount: amountNum,
          upiId: upiId || null,
          accountNumber: accountNumber || null,
          ifsc: ifsc || null,
          name: name || null,
          status: "pending",
        },
      ],
      { session }
    );

    wallet.transactions.push({
      amount: amountNum,
      type: "debit",
      source: "withdraw",
      description: "Withdraw request created",
      refId: withdrawal[0]._id,
    });

    await wallet.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(withdrawal[0]);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

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
   USER GET MY WITHDRAWALS
============================== */
const getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (err) {
    console.error("❌ Get My Withdrawals Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ==============================
   ADMIN PROCESS WITHDRAWAL
============================== */
const processWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status, adminNote } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid status" });
    }

    const withdrawal = await Withdrawal.findById(req.params.id).session(session);

    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    if (withdrawal.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Already processed" });
    }

    let transferId = null;

    /* ======================
       PAYOUT
    ====================== */
    if (status === "approved") {
      try {
        const payout = await sendPayout({
          amount: withdrawal.amount,
        });

        transferId =
          payout?.transferId ||
          payout?.data?.transferId ||
          null;
      } catch (payoutErr) {
        console.error("❌ Payout failed:", payoutErr.message);

        const wallet = await Wallet.findOne({ user: withdrawal.user }).session(session);

        if (wallet) {
          wallet.balance += withdrawal.amount;

          wallet.transactions.push({
            amount: withdrawal.amount,
            type: "credit",
            source: "withdraw",
            description: "Payout failed (refund)",
            refId: withdrawal._id,
          });

          await wallet.save({ session });
        }

        withdrawal.status = "rejected";
        withdrawal.adminNote = "Payout failed automatically refunded";
        withdrawal.processedBy = req.admin?._id || null;
        withdrawal.processedAt = new Date();
        await withdrawal.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(500).json({
          message: "Payout failed & refunded",
        });
      }
    }

    /* ======================
       REJECT REFUND
    ====================== */
    if (status === "rejected") {
      const wallet = await Wallet.findOne({ user: withdrawal.user }).session(session);

      if (wallet) {
        wallet.balance += withdrawal.amount;

        wallet.transactions.push({
          amount: withdrawal.amount,
          type: "credit",
          source: "withdraw",
          description: "Withdrawal rejected (refund)",
          refId: withdrawal._id,
        });

        await wallet.save({ session });
      }
    }

    /* ======================
       UPDATE WITHDRAWAL
    ====================== */
    withdrawal.status = status;
    withdrawal.adminNote = adminNote || null;
    withdrawal.cashfreeTransferId = transferId;
    withdrawal.processedBy = req.admin?._id || null;
    withdrawal.processedAt = new Date();

    await withdrawal.save({ session });

    /* ======================
       AUDIT LOG
    ====================== */
    if (req.admin?._id) {
      await logAudit({
        adminId: req.admin._id,
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

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: `Withdrawal ${status} successfully`,
      transferId,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Process Withdrawal Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createWithdrawal,
  getAllWithdrawals,
  getMyWithdrawals,
  processWithdrawal,
};