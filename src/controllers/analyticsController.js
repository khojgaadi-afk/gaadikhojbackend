const Submission = require("../models/Submission");
const Post = require("../models/Post");
const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/Withdrawal");
const Reward = require("../models/Reward");

/* =========================
   DASHBOARD STATS
========================= */
exports.getDashboardStats = async (req, res) => {
  try {
    /* SUBMISSIONS */
    const [pending, approved, rejected] = await Promise.all([
      Submission.countDocuments({ status: "pending" }),
      Submission.countDocuments({ status: "approved" }),
      Submission.countDocuments({ status: "rejected" }),
    ]);

    /* ACTIVE CARS */
    const activeCars = await Post.countDocuments({
      status: "active",
    });

    /* TOTAL REWARDS CREDITED */
    const rewardAgg = await Reward.aggregate([
      {
        $match: {
          type: "credit",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalRewardsCredited = rewardAgg[0]?.total || 0;

    /* TOTAL WITHDRAW APPROVED */
    const withdrawalAgg = await Withdrawal.aggregate([
      {
        $match: {
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalWithdrawn = withdrawalAgg[0]?.total || 0;

    /* CURRENT WALLET FLOAT */
    const walletAgg = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$balance" },
        },
      },
    ]);

    const currentWalletBalance = walletAgg[0]?.total || 0;

    /* WITHDRAWAL STATS */
    const [wPending, wApproved, wRejected] = await Promise.all([
      Withdrawal.countDocuments({ status: "pending" }),
      Withdrawal.countDocuments({ status: "approved" }),
      Withdrawal.countDocuments({ status: "rejected" }),
    ]);

    /* RECENT WITHDRAWALS */
    const recentWithdrawals = await Withdrawal.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      activeCars,

      submissions: {
        pending,
        approved,
        rejected,
      },

      rewards: {
        totalCredited: totalRewardsCredited,
      },

      wallets: {
        currentBalance: currentWalletBalance,
      },

      withdrawals: {
        pending: wPending,
        approved: wApproved,
        rejected: wRejected,
        totalWithdrawn,
      },

      recentWithdrawals,
    });
  } catch (err) {
    console.error("❌ Dashboard Stats Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   WEEKLY EARNINGS
========================= */
exports.getWeeklyEarnings = async (req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const data = await Reward.aggregate([
      {
        $match: {
          type: "credit",
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    console.error("❌ Weekly earnings error:", err);
    res.status(500).json({ message: err.message });
  }
};