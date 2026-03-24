const User = require("../models/User");

exports.getReferralStats = async (req, res) => {
  try {
    const me = await User.findById(req.user._id); // ✅ FIXED

    if (!me) {
      return res.status(404).json({ msg: "User not found" });
    }

    const pending = await User.countDocuments({
      referredBy: me.referralCode,
      hasGivenReferralReward: false,
    });

    const completed = await User.countDocuments({
      referredBy: me.referralCode,
      hasGivenReferralReward: true,
    });

    res.json({ pending, completed });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
};