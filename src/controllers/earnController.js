const User = require("../models/User");
const Wallet = require("../models/Wallet");

/* =========================
   CONFIG
========================= */
const FIRST_BATCH_LIMIT = 10;
const SECOND_BATCH_LIMIT = 10;
const TOTAL_DAILY_LIMIT = 20;
const SECOND_BATCH_DELAY_HOURS = 2;

/* =========================
   HELPER: RESET DAILY
========================= */
const resetDailyIfNeeded = (user) => {
  const today = new Date().toDateString();

  if (!user.lastAdDate || user.lastAdDate.toDateString() !== today) {
    user.adsWatchedToday = 0;
    user.firstBatchWatched = 0;
    user.secondBatchWatched = 0;
    user.secondBatchUnlockAt = null;
    user.lastAdDate = new Date();
  }
};

/* =========================
   HELPER: GET STATUS
========================= */
const getAdStatus = (user) => {
  const now = new Date();

  const secondBatchUnlocked =
    user.secondBatchUnlockAt && now >= user.secondBatchUnlockAt;

  const firstBatchRemaining = Math.max(
    0,
    FIRST_BATCH_LIMIT - (user.firstBatchWatched || 0)
  );

  const secondBatchRemaining = secondBatchUnlocked
    ? Math.max(0, SECOND_BATCH_LIMIT - (user.secondBatchWatched || 0))
    : 0;

  const totalRemaining = Math.max(
    0,
    TOTAL_DAILY_LIMIT - (user.adsWatchedToday || 0)
  );

  return {
    firstBatchRemaining,
    secondBatchRemaining,
    totalRemaining,
    secondBatchUnlocked,
    secondBatchUnlockAt: user.secondBatchUnlockAt,
  };
};

/* =========================
   GET EGG / AD STATUS
========================= */
exports.getAdStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    resetDailyIfNeeded(user);
    await user.save();

    const status = getAdStatus(user);

    return res.json({
      success: true,
      adsWatchedToday: user.adsWatchedToday,
      firstBatchWatched: user.firstBatchWatched,
      secondBatchWatched: user.secondBatchWatched,
      ...status,
    });
  } catch (err) {
    console.error("❌ getAdStatus error:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
};

/* =========================
   WATCH AD REWARD
========================= */
exports.watchAd = async (req, res) => {
  try {
    /* =========================
       FIND USER
    ========================= */
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    /* =========================
       SAFE DEFAULTS
    ========================= */
    if (typeof user.adsWatchedToday !== "number") user.adsWatchedToday = 0;
    if (typeof user.streakCount !== "number") user.streakCount = 0;
    if (typeof user.firstBatchWatched !== "number") user.firstBatchWatched = 0;
    if (typeof user.secondBatchWatched !== "number") user.secondBatchWatched = 0;

    /* =========================
       RESET DAILY IF NEW DAY
    ========================= */
    resetDailyIfNeeded(user);

    /* =========================
       DAILY LIMIT CHECK
    ========================= */
    if (user.adsWatchedToday >= TOTAL_DAILY_LIMIT) {
      return res.status(400).json({
        success: false,
        msg: "Daily limit reached",
      });
    }

    const now = new Date();

    /* =========================
       BATCH ACCESS LOGIC
    ========================= */
    let currentBatch = null;

    // FIRST 10 ADS
    if (user.firstBatchWatched < FIRST_BATCH_LIMIT) {
      currentBatch = 1;
    }

    // FIRST BATCH COMPLETE → START 2H TIMER
    else if (user.firstBatchWatched >= FIRST_BATCH_LIMIT) {
      if (!user.secondBatchUnlockAt) {
        user.secondBatchUnlockAt = new Date(
          now.getTime() + SECOND_BATCH_DELAY_HOURS * 60 * 60 * 1000
        );

        await user.save();

        return res.status(400).json({
          success: false,
          msg: "First 10 ads completed. Next 10 will unlock after 2 hours.",
          unlockAt: user.secondBatchUnlockAt,
        });
      }

      // TIMER RUNNING
      if (now < user.secondBatchUnlockAt) {
        return res.status(400).json({
          success: false,
          msg: "Next 10 ads are still locked",
          unlockAt: user.secondBatchUnlockAt,
        });
      }

      // SECOND BATCH OPEN
      if (user.secondBatchWatched < SECOND_BATCH_LIMIT) {
        currentBatch = 2;
      }
    }

    if (!currentBatch) {
      return res.status(400).json({
        success: false,
        msg: "No ads available right now",
      });
    }

    /* =========================
       REWARD LOGIC
    ========================= */
    let reward = 2;

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

    /* =========================
       UPDATE USER COUNTS
    ========================= */
    user.lastActiveDate = new Date();
    user.adsWatchedToday += 1;

    if (currentBatch === 1) {
      user.firstBatchWatched += 1;

      // If first batch just completed, start unlock timer
      if (
        user.firstBatchWatched === FIRST_BATCH_LIMIT &&
        !user.secondBatchUnlockAt
      ) {
        user.secondBatchUnlockAt = new Date(
          now.getTime() + SECOND_BATCH_DELAY_HOURS * 60 * 60 * 1000
        );
      }
    }

    if (currentBatch === 2) {
      user.secondBatchWatched += 1;
    }

    /* =========================
       FIND OR CREATE WALLET
    ========================= */
    let wallet = await Wallet.findOne({ user: user._id });

    if (!wallet) {
      wallet = await Wallet.create({
        user: user._id,
        balance: 0,
        transactions: [],
      });
    }

    /* =========================
       ADD WALLET BALANCE
    ========================= */
    wallet.balance += reward;

    wallet.transactions.push({
      amount: reward,
      type: "credit",
      source: "ad",
      description:
        currentBatch === 1
          ? "Ad reward earned (Batch 1)"
          : "Ad reward earned (Batch 2)",
      refId: null,
    });

    await wallet.save();
    await user.save();

    const status = getAdStatus(user);

    /* =========================
       RESPONSE
    ========================= */
    return res.json({
      success: true,
      msg: "Reward credited successfully",
      reward,
      batch: currentBatch,
      streak: user.streakCount,
      balance: wallet.balance,
      adsWatchedToday: user.adsWatchedToday,
      firstBatchWatched: user.firstBatchWatched,
      secondBatchWatched: user.secondBatchWatched,
      ...status,
    });
  } catch (err) {
    console.error("❌ Watch ad error FULL:", err);

    return res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
};