const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Referral = require("../models/Referral");

/* =========================
   CONFIG
========================= */
const FIRST_BATCH_LIMIT = 10;
const SECOND_BATCH_LIMIT = 10;
const TOTAL_DAILY_LIMIT = 20;
const SECOND_BATCH_DELAY_HOURS = 2;
const REFERRAL_REWARD_AMOUNT = 10;
const REFERRAL_AD_TARGET = 10;

/* =========================
   HELPER: RESET DAILY
========================= */
const resetDailyIfNeeded = (user) => {
  const today = new Date().toDateString();

  if (!user.lastAdDate || new Date(user.lastAdDate).toDateString() !== today) {
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
const getAdStatusData = (user) => {
  const now = new Date();

  const secondBatchUnlocked =
    user.secondBatchUnlockAt && now >= new Date(user.secondBatchUnlockAt);

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
    secondBatchUnlockAt: user.secondBatchUnlockAt || null,
  };
};

/* =========================
   HELPER: CREDIT REFERRAL IF ELIGIBLE
========================= */
const creditReferralIfEligible = async (user) => {
  try {
    // Find referral record where this user was referred by someone
    const referral = await Referral.findOne({
      referredUser: user._id,
      rewardGiven: false,
      status: "pending",
    });

    if (!referral) return;

    // Check if referred user has completed required ads
    const totalAdsWatched = Number(user.adsWatchedToday || 0);

    // IMPORTANT:
    // If you want lifetime ad count later, create a separate field like user.totalAdsWatched
    // For now this uses adsWatchedToday as per your current structure.
    if (totalAdsWatched < REFERRAL_AD_TARGET) return;

    // Find or create referrer's wallet
    let referrerWallet = await Wallet.findOne({ user: referral.referrer });

    if (!referrerWallet) {
      referrerWallet = await Wallet.create({
        user: referral.referrer,
        balance: 0,
        totalCredited: 0,
        totalDebited: 0,
        transactions: [],
      });
    }

    // Credit referral reward
    referrerWallet.balance += REFERRAL_REWARD_AMOUNT;
    referrerWallet.totalCredited += REFERRAL_REWARD_AMOUNT;

    referrerWallet.transactions.push({
      amount: REFERRAL_REWARD_AMOUNT,
      type: "credit",
      source: "referral",
      description: "Referral reward credited",
      status: "completed",
      refId: referral._id,
    });

    await referrerWallet.save();

    // Mark referral as completed
    referral.rewardGiven = true;
    referral.rewardAmount = REFERRAL_REWARD_AMOUNT;
    referral.status = "completed";
    await referral.save();

    console.log("✅ Referral reward credited successfully");
  } catch (err) {
    console.error("❌ Referral reward credit error:", err);
  }
};

/* =========================
   GET EGG / AD STATUS
========================= */
exports.getAdStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Safe defaults
    if (typeof user.adsWatchedToday !== "number") user.adsWatchedToday = 0;
    if (typeof user.firstBatchWatched !== "number") user.firstBatchWatched = 0;
    if (typeof user.secondBatchWatched !== "number") user.secondBatchWatched = 0;
    if (typeof user.streakCount !== "number") user.streakCount = 0;

    resetDailyIfNeeded(user);
    await user.save();

    const wallet = await Wallet.findOne({ user: user._id });
    const status = getAdStatusData(user);

    return res.status(200).json({
      success: true,
      adsWatchedToday: user.adsWatchedToday,
      firstBatchWatched: user.firstBatchWatched,
      secondBatchWatched: user.secondBatchWatched,
      streak: user.streakCount || 0,
      balance: wallet?.balance || 0,
      ...status,
    });
  } catch (err) {
    console.error("❌ getAdStatus error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
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
    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
        message: "Daily limit reached",
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
          message: "First 10 ads completed. Next 10 will unlock after 2 hours.",
          unlockAt: user.secondBatchUnlockAt,
        });
      }

      // TIMER RUNNING
      if (now < new Date(user.secondBatchUnlockAt)) {
        return res.status(400).json({
          success: false,
          message: "Next 10 ads are still locked",
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
        message: "No ads available right now",
      });
    }

    /* =========================
       REWARD LOGIC
    ========================= */
    let reward = 2;

    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (
      user.lastActiveDate &&
      new Date(user.lastActiveDate).toDateString() === yesterday
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
        totalCredited: 0,
        totalDebited: 0,
        transactions: [],
      });
    }

    /* =========================
       ADD WALLET BALANCE
    ========================= */
    wallet.balance += reward;
    wallet.totalCredited += reward;

    wallet.transactions.push({
      amount: reward,
      type: "credit",
      source: "ad",
      description:
        currentBatch === 1
          ? "Ad reward earned (Batch 1)"
          : "Ad reward earned (Batch 2)",
      status: "completed",
      refId: null,
    });

    await wallet.save();
    await user.save();

    /* =========================
       CHECK REFERRAL CONDITION
       If referred user completed 10 ads → reward referrer
    ========================= */
    await creditReferralIfEligible(user);

    const status = getAdStatusData(user);

    /* =========================
       RESPONSE
    ========================= */
    return res.status(200).json({
      success: true,
      message: "Reward credited successfully",
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
      message: "Server error",
      error: err.message,
    });
  }
};