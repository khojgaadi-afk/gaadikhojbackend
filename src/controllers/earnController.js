const User = require("../models/User");
const Wallet = require("../models/Wallet");

exports.watchAd = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const today = new Date().toDateString();

    // Reset daily ads
    if (user.lastAdDate?.toDateString() !== today) {
      user.adsWatchedToday = 0;
      user.lastAdDate = new Date();
    }

    if (user.adsWatchedToday >= 10) {
      return res.status(400).json({ msg: "Daily limit reached" });
    }

    let reward = 2;

    // 🔥 streak logic
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (user.lastActiveDate?.toDateString() === yesterday) {
      user.streakCount += 1;
      reward += user.streakCount;
    } else {
      user.streakCount = 1;
    }

    user.lastActiveDate = new Date();
    user.adsWatchedToday += 1;

    // 💰 add money
    await Wallet.findOneAndUpdate(
      { user: user._id },
      { $inc: { balance: reward } }
    );

    await user.save();

    res.json({
      reward,
      streak: user.streakCount,
      remaining: 10 - user.adsWatchedToday,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};