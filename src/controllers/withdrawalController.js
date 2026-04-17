const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const logAudit = require("../utils/auditLogger");
const { sendPayout } = require("../services/payoutService");


/* ==============================
   HELPERS
============================== */
const safeAbort = async (session) => {
  try {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
  } catch (_) {}
};

const safeEnd = (session) => {
  try {
    session?.endSession();
  } catch (_) {}
};

const normalizeAmount = (amount) => Number(Number(amount).toFixed(2));

const isValidUpi = (upi) => {
  if (!upi) return false;
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
};

const isValidIfsc = (ifsc) => {
  if (!ifsc) return false;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());
};

const isValidAccountNumber = (acc) => {
  if (!acc) return false;
  return /^[0-9]{9,18}$/.test(String(acc).trim());
};

/* ==============================
   USER CREATE WITHDRAWAL
============================== */
const createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
   

    if (!req.user || !req.user._id) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(401).json({
        success: false,
        message: "User not logged in",
      });
    }

/* 🔐 PHONE + PIN CHECK */
const user = await User.findById(req.user._id).select("+withdrawalPin");

if (!user.phone || !user.withdrawalPin) {
  await safeAbort(session);
  safeEnd(session);
  return res.status(400).json({
    success: false,
    message: "Please complete profile setup (phone + PIN)",
  });
}

/* 🔐 PIN VERIFY */
const { pin } = req.body;

if (!pin) {
  await safeAbort(session);
  safeEnd(session);
  return res.status(400).json({
    success: false,
    message: "Withdrawal PIN required",
  });
}

const isMatch = await user.matchPin(pin);
const result = await user.handlePinAttempt(isMatch);

if (!result.success) {
  await safeAbort(session);
  safeEnd(session);
  return res.status(400).json({
    success: false,
    message: result.message,
  });
}

    const { amount, upiId, accountNumber, ifsc, name } = req.body;
    const amountNum = normalizeAmount(amount);

    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    if (amountNum < 100) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Minimum withdrawal is ₹100",
      });
    }

    const hasUpi = !!upiId;
    const hasBank = !!accountNumber || !!ifsc || !!name;

    if (!hasUpi && !hasBank) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Provide UPI or bank details",
      });
    }

    if (hasUpi && !isValidUpi(upiId)) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid UPI ID",
      });
    }

    if (!hasUpi) {
      if (
        !isValidAccountNumber(accountNumber) ||
        !isValidIfsc(ifsc) ||
        !name ||
        String(name).trim().length < 2
      ) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: "Invalid bank details",
        });
      }
    }

    /* Prevent multiple pending withdrawals */
    const existingPending = await Withdrawal.findOne({
      user: req.user._id,
      status: "pending",
    }).session(session);

    if (existingPending) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal",
      });
    }

    /* Atomic wallet debit */
    const wallet = await Wallet.findOneAndUpdate(
      {
        user: req.user._id,
        balance: { $gte: amountNum },
      },
      {
        $inc: {
          balance: -amountNum,
          totalDebited: amountNum,
        },
      },
      {
        new: true,
        session,
      },
    );

    if (!wallet) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    const [withdrawal] = await Withdrawal.create(
      [
        {
          user: req.user._id,
          amount: amountNum,
          upiId: upiId ? String(upiId).trim() : null,
          accountNumber: accountNumber ? String(accountNumber).trim() : null,
          ifsc: ifsc ? String(ifsc).trim().toUpperCase() : null,
          name: name ? String(name).trim() : null,
          status: "pending",
        },
      ],
      { session },
    );

    /* Push wallet transaction */
    await Wallet.findOneAndUpdate(
      { user: req.user._id },
      {
        $push: {
          transactions: {
            amount: amountNum,
            type: "debit",
            source: "withdrawal",
            status: "completed",
            description: "Withdrawal request created",
            refId: withdrawal._id,
            createdAt: new Date(),
          },
        },
      },
      { session },
    );

    await session.commitTransaction();
    safeEnd(session);

    return res.status(201).json({
      success: true,
      message: "Withdrawal request created successfully",
      withdrawal,
    });
  } catch (err) {
    await safeAbort(session);
    safeEnd(session);

    console.error("❌ Create Withdrawal Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create withdrawal",
    });
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

    return res.json({
      success: true,
      withdrawals,
    });
  } catch (err) {
    console.error("❌ Get Withdrawals Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
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

    return res.json({
      success: true,
      withdrawals,
    });
  } catch (err) {
    console.error("❌ Get My Withdrawals Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ==============================
   ADMIN PROCESS WITHDRAWAL
============================== */
const processWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { status, adminNote } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    /* Atomic lock: only process pending once */
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: "processing",
          processedBy: req.admin?._id || null,
          processedAt: new Date(),
          adminNote: adminNote || null,
        },
      },
      { new: true, session },
    );

    if (!withdrawal) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Withdrawal already processed or not found",
      });
    }

    await session.commitTransaction();
    safeEnd(session);

    /* ======================================
       REJECT FLOW → REFUND
    ====================================== */
    if (status === "rejected") {
      const refundSession = await mongoose.startSession();

      try {
        refundSession.startTransaction();

        const refundWallet = await Wallet.findOneAndUpdate(
          { user: withdrawal.user },
          {
            $inc: {
              balance: withdrawal.amount,
              totalDebited: -withdrawal.amount,
            },
            $push: {
              transactions: {
                amount: withdrawal.amount,
                type: "credit",
                source: "withdrawal",
                status: "completed",
                description: "Withdrawal rejected (refund)",
                refId: withdrawal._id,
                createdAt: new Date(),
              },
            },
          },
          {
            new: true,
            session: refundSession,
          },
        );

        if (!refundWallet) {
          throw new Error("Wallet not found for refund");
        }

        await Withdrawal.findByIdAndUpdate(
          withdrawal._id,
          {
            $set: {
              status: "rejected",
              adminNote: adminNote || "Withdrawal rejected & refunded",
              processedBy: req.admin?._id || null,
              processedAt: new Date(),
            },
          },
          { session: refundSession },
        );

        if (req.admin?._id) {
          await logAudit({
            adminId: req.admin._id,
            action: "withdrawal_rejected",
            resource: "Withdrawal",
            resourceId: withdrawal._id,
            metadata: {
              amount: withdrawal.amount,
              user: withdrawal.user,
              processedBy: req.admin.email,
            },
          });
        }

        await refundSession.commitTransaction();
        safeEnd(refundSession);

        return res.json({
          success: true,
          message: "Withdrawal rejected and refunded successfully",
        });
      } catch (refundErr) {
        await safeAbort(refundSession);
        safeEnd(refundSession);

        console.error("❌ Refund failed:", refundErr);

        await Withdrawal.findByIdAndUpdate(withdrawal._id, {
          $set: {
            status: "pending",
            adminNote: "Refund failed. Reset to pending for manual review.",
          },
        });

        return res.status(500).json({
          success: false,
          message:
            "Refund failed. Withdrawal reset to pending for manual review.",
        });
      }
    }

    /* ======================================
       APPROVE FLOW → PAYOUT (OUTSIDE TXN)
    ====================================== */
    let transferId = null;

    try {
      const payout = await sendPayout({
        amount: withdrawal.amount,
        withdrawalId: withdrawal._id.toString(),
        upiId: withdrawal.upiId || null,
        accountNumber: withdrawal.accountNumber || null,
        ifsc: withdrawal.ifsc || null,
        name: withdrawal.name || null,
      });

      transferId =
        payout?.transferId ||
        payout?.data?.transferId ||
        payout?.referenceId ||
        null;

      await Withdrawal.findByIdAndUpdate(withdrawal._id, {
        $set: {
          status: "approved",
          cashfreeTransferId: transferId,
          adminNote: adminNote || "Withdrawal approved successfully",
          processedBy: req.admin?._id || null,
          processedAt: new Date(),
        },
      });

      if (req.admin?._id) {
        await logAudit({
          adminId: req.admin._id,
          action: "withdrawal_approved",
          resource: "Withdrawal",
          resourceId: withdrawal._id,
          metadata: {
            amount: withdrawal.amount,
            user: withdrawal.user,
            transferId,
            processedBy: req.admin.email,
          },
        });
      }

      return res.json({
        success: true,
        message: "Withdrawal approved successfully",
        transferId,
      });
    } catch (payoutErr) {
      console.error("❌ Payout failed:", payoutErr.message);

      /* Refund on payout failure */
      const refundSession = await mongoose.startSession();

      try {
        refundSession.startTransaction();

        const refundWallet = await Wallet.findOneAndUpdate(
          { user: withdrawal.user },
          {
            $inc: {
              balance: withdrawal.amount,
              totalDebited: -withdrawal.amount,
            },
            $push: {
              transactions: {
                amount: withdrawal.amount,
                type: "credit",
                source: "withdrawal",
                status: "completed",
                description: "Payout failed (refund)",
                refId: withdrawal._id,
                createdAt: new Date(),
              },
            },
          },
          {
            new: true,
            session: refundSession,
          },
        );

        if (!refundWallet) {
          throw new Error("Wallet not found for payout refund");
        }

        await Withdrawal.findByIdAndUpdate(
          withdrawal._id,
          {
            $set: {
              status: "rejected",
              adminNote: "Payout failed automatically refunded",
              processedBy: req.admin?._id || null,
              processedAt: new Date(),
            },
          },
          { session: refundSession },
        );

        if (req.admin?._id) {
          await logAudit({
            adminId: req.admin._id,
            action: "withdrawal_payout_failed_refunded",
            resource: "Withdrawal",
            resourceId: withdrawal._id,
            metadata: {
              amount: withdrawal.amount,
              user: withdrawal.user,
              processedBy: req.admin.email,
            },
          });
        }

        await refundSession.commitTransaction();
        safeEnd(refundSession);

        return res.status(500).json({
          success: false,
          message: "Payout failed and amount refunded successfully",
        });
      } catch (refundErr) {
        await safeAbort(refundSession);
        safeEnd(refundSession);

        console.error("❌ Refund after payout failure failed:", refundErr);

        await Withdrawal.findByIdAndUpdate(withdrawal._id, {
          $set: {
            status: "pending",
            adminNote:
              "Payout/refund failed. Reset to pending for manual review.",
          },
        });

        return res.status(500).json({
          success: false,
          message:
            "Payout failed and refund also failed. Withdrawal reset to pending for manual review.",
        });
      }
    }
  } catch (err) {
    await safeAbort(session);
    safeEnd(session);

    console.error("❌ Process Withdrawal Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to process withdrawal",
    });
  }
};

module.exports = {
  createWithdrawal,
  getAllWithdrawals,
  getMyWithdrawals,
  processWithdrawal,
};
