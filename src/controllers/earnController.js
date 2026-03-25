const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Reward = require("../models/Reward");

/* =========================
   WATCH AD
========================= */
exports.watchAd = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const today = new Date().toDateString();

    /* RESET DAILY LIMIT */
    if (user.lastAdDate?.toDateString() !== today) {
      user.adsWatchedToday = 0;
      user.lastAdDate = new Date();
    }

    if (user.adsWatchedToday >= 10) {
      return res.status(400).json({
        msg: "Daily limit reached",
      });
    }

    let reward = 2;

    /* STREAK LOGIC */
    const yesterday = new Date(
      Date.now() - 86400000
    ).toDateString();

    if (user.lastActiveDate?.toDateString() === yesterday) {
      user.streakCount += 1;
      reward += user.streakCount;
    } else {
      user.streakCount = 1;
    }

    user.lastActiveDate = new Date();
    user.adsWatchedToday += 1;

    /* WALLET UPDATE (SAFE) */
    let wallet = await Wallet.findOne({ user: user._id });

    if (!wallet) {
      wallet = await Wallet.create({
        user: user._id,
        balance: 0,
        transactions: [],
      });
    }

    wallet.balance += reward;

    wallet.transactions.push({
      amount: reward,
      type: "credit",
      source: "ad",
      description: "Ad reward earned",
    });

    await wallet.save();

    /* REWARD ENTRY (IMPORTANT) */
    await Reward.create({
      user: user._id,
      amount: reward,
      type: "credit",
      source: "ad",
      description: "Ad watch reward",
    });

    await user.save();

    res.json({
      reward,
      streak: user.streakCount,
      remaining: 10 - user.adsWatchedToday,
    });
  } catch (err) {
    console.error("❌ Watch ad error:", err);

    res.status(500).json({
      msg: "Server error",
    });
  }
};