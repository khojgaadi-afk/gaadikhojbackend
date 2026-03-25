const User = require("../models/User");
const Referral = require("../models/Referral");

/* ============================
   GET REFERRAL STATS
============================ */
exports.getReferralStats = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("referralCode");

    if (!me) {
      return res.status(404).json({ msg: "User not found" });
    }

    const pending = await Referral.countDocuments({
      referrer: req.user._id,
      status: "pending",
    });

    const completed = await Referral.countDocuments({
      referrer: req.user._id,
      status: "completed",
    });

    const totalEarnings = await Referral.aggregate([
      {
        $match: {
          referrer: me._id,
          rewardGiven: true,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$rewardAmount" },
        },
      },
    ]);

    res.json({
      referralCode: me.referralCode,
      pending,
      completed,
      totalEarnings: totalEarnings[0]?.total || 0,
    });
  } catch (err) {
    console.error("❌ Referral stats error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ============================
   GET MY REFERRALS LIST
============================ */
exports.getMyReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find({
      referrer: req.user._id,
    })
      .populate("referredUser", "name email createdAt")
      .sort({ createdAt: -1 });

    res.json(referrals);
  } catch (err) {
    console.error("❌ Referral list error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};