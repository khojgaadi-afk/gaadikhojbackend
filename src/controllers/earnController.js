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

    /* =========================
       SAFE DEFAULTS (🔥 IMPORTANT)
    ========================= */
    if (typeof user.adsWatchedToday !== "number") {
      user.adsWatchedToday = 0;
    }

    if (typeof user.streakCount !== "number") {
      user.streakCount = 0;
    }

    const today = new Date().toDateString();

    /* =========================
       RESET DAILY LIMIT
    ========================= */
    if (!user.lastAdDate || user.lastAdDate.toDateString() !== today) {
      user.adsWatchedToday = 0;
      user.lastAdDate = new Date();
    }

    /* =========================
       DAILY LIMIT
    ========================= */
    if (user.adsWatchedToday >= 10) {
      return res.status(400).json({
        msg: "Daily limit reached",
      });
    }

    let reward = 2;

    /* =========================
       STREAK LOGIC
    ========================= */
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (
      user.lastActiveDate &&
      user.lastActiveDate.toDateString() === yesterday
    ) {
      user.streakCount += 1;
      reward += user.streakCount;
    } else {
      user.streakCount = 1;
    }

    user.lastActiveDate = new Date();
    user.adsWatchedToday += 1;

    /* =========================
       WALLET SAFE UPDATE
    ========================= */
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
      status: "success",
      createdAt: new Date(),
    });

    await wallet.save();

    /* =========================
       REWARD ENTRY (SAFE)
    ========================= */
    if (Reward) {
      await Reward.create({
        user: user._id,
        amount: reward,
        type: "credit",
        source: "ad",
        description: "Ad watch reward",
      });
    }

    await user.save();

    /* =========================
       RESPONSE
    ========================= */
    res.json({
      reward,
      streak: user.streakCount,
      remaining: 10 - user.adsWatchedToday,
      balance: wallet.balance, // 🔥 added
    });

  } catch (err) {
    console.error("❌ Watch ad error FULL:", err);

    res.status(500).json({
      msg: "Server error",
      error: err.message, // 🔥 debug helpful
    });
  }
};