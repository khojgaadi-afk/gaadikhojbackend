const Submission = require("../models/Submission");
const Post = require("../models/Post");
const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/Withdrawal");

exports.getDashboardStats = async (req, res) => {
  try {
    /* =============================
       SUBMISSIONS
    ============================== */
    const [pending, approved, rejected] = await Promise.all([
      Submission.countDocuments({ status: "pending" }),
      Submission.countDocuments({ status: "approved" }),
      Submission.countDocuments({ status: "rejected" }),
    ]);

    /* =============================
       ACTIVE CARS
    ============================== */
    const activeCars = await Post.countDocuments({ status: "active" });

    /* =============================
       TOTAL PAID
    ============================== */
    const wallets = await Wallet.find();

    const totalPaid = wallets.reduce((s, w) => s + (w.balance || 0), 0);

    /* =============================
       WITHDRAWAL STATS
    ============================== */
    const [wPending, wApproved, wRejected] = await Promise.all([
      Withdrawal.countDocuments({ status: "pending" }),
      Withdrawal.countDocuments({ status: "approved" }),
      Withdrawal.countDocuments({ status: "rejected" }),
    ]);

    /* =============================
       RECENT WITHDRAWALS (FIXED 🔥)
    ============================== */
    const recentWithdrawals = await Withdrawal.find()
      .populate("user", "name email") // ✅ FIX
      .sort({ createdAt: -1 })
      .limit(5);

    /* =============================
       RESPONSE
    ============================== */
    res.json({
      activeCars,

      submissions: {
        pending,
        approved,
        rejected,
      },

      totalPaid,

      withdrawals: {
        pending: wPending,
        approved: wApproved,
        rejected: wRejected,
      },

      recentWithdrawals,
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getWeeklyEarnings = async (req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const data = await Wallet.aggregate([
      {
        $match: {
          updatedAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$updatedAt",
            },
          },
          total: { $sum: "$balance" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    console.error("Weekly earnings error:", err);
    res.status(500).json({ message: err.message });
  }
};
