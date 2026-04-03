const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const Reward = require("../models/Reward");

/* ============================
   HELPERS
============================ */
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

/* ============================
   CREDIT REWARD (SAFE + IDEMPOTENT)
============================ */
exports.creditReward = async ({
  userId,
  amount,
  refId,
  source = "submission",
  session = null,
}) => {
  let localSession = session;
  let startedHere = false;

  try {
    if (!userId) {
      throw new Error("Invalid userId");
    }

    if (!refId) {
      throw new Error("Invalid refId");
    }

    const amountNum = Number(Number(amount).toFixed(2));

    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Invalid amount");
    }

    if (!localSession) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
      startedHere = true;
    }

    /* =========================================
       STEP 1: CREATE REWARD RECORD FIRST
       (acts as idempotency lock)
    ========================================= */
    let reward;

    try {
      [reward] = await Reward.create(
        [
          {
            user: userId,
            amount: amountNum,
            refId,
            type: "credit",
            source,
            description:
              source === "submission"
                ? "Reward for approved submission"
                : `${source} reward`,
            status: "completed",
          },
        ],
        { session: localSession }
      );
    } catch (err) {
      // Duplicate reward already exists
      if (err.code === 11000) {
        const existingReward = await Reward.findOne({
          user: userId,
          refId,
          type: "credit",
          source,
        }).session(localSession);

        if (startedHere) {
          await safeAbort(localSession);
          safeEnd(localSession);
        }

        console.log("⚠️ Reward already credited for this refId");
        return existingReward;
      }

      throw err;
    }

    /* =========================================
       STEP 2: ATOMIC WALLET CREDIT
    ========================================= */
    await Wallet.findOneAndUpdate(
      { user: userId },
      {
        $setOnInsert: {
          user: userId,
          balance: 0,
          totalCredited: 0,
          totalDebited: 0,
        },
        $inc: {
          balance: amountNum,
          totalCredited: amountNum,
        },
        $push: {
          transactions: {
            amount: amountNum,
            type: "credit",
            source,
            status: "completed",
            refId,
            description:
              source === "submission"
                ? "Task reward credited"
                : `${source} reward credited`,
            createdAt: new Date(),
          },
        },
      },
      {
        upsert: true,
        new: true,
        session: localSession,
      }
    );

    if (startedHere) {
      await localSession.commitTransaction();
      safeEnd(localSession);
    }

    return reward;
  } catch (err) {
    if (startedHere && localSession) {
      await safeAbort(localSession);
      safeEnd(localSession);
    }

    console.error("❌ Reward credit error:", err);
    throw err;
  }
};

/* ============================
   DEBIT REWARD / WALLET (SAFE)
   Use for admin penalties / manual adjustments if needed later
============================ */
exports.debitReward = async ({
  userId,
  amount,
  refId,
  source = "manual_adjustment",
  description = "Wallet debited",
  session = null,
}) => {
  let localSession = session;
  let startedHere = false;

  try {
    if (!userId) {
      throw new Error("Invalid userId");
    }

    if (!refId) {
      throw new Error("Invalid refId");
    }

    const amountNum = Number(Number(amount).toFixed(2));

    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Invalid amount");
    }

    if (!localSession) {
      localSession = await mongoose.startSession();
      localSession.startTransaction();
      startedHere = true;
    }

    /* Prevent duplicate debit */
    let reward;

    try {
      [reward] = await Reward.create(
        [
          {
            user: userId,
            amount: amountNum,
            refId,
            type: "debit",
            source,
            description,
            status: "completed",
          },
        ],
        { session: localSession }
      );
    } catch (err) {
      if (err.code === 11000) {
        const existingReward = await Reward.findOne({
          user: userId,
          refId,
          type: "debit",
          source,
        }).session(localSession);

        if (startedHere) {
          await safeAbort(localSession);
          safeEnd(localSession);
        }

        console.log("⚠️ Debit already processed for this refId");
        return existingReward;
      }

      throw err;
    }

    /* Atomic debit with balance check */
    const wallet = await Wallet.findOneAndUpdate(
      {
        user: userId,
        balance: { $gte: amountNum },
      },
      {
        $inc: {
          balance: -amountNum,
          totalDebited: amountNum,
        },
        $push: {
          transactions: {
            amount: amountNum,
            type: "debit",
            source,
            status: "completed",
            refId,
            description,
            createdAt: new Date(),
          },
        },
      },
      {
        new: true,
        session: localSession,
      }
    );

    if (!wallet) {
      throw new Error("Insufficient wallet balance");
    }

    if (startedHere) {
      await localSession.commitTransaction();
      safeEnd(localSession);
    }

    return reward;
  } catch (err) {
    if (startedHere && localSession) {
      await safeAbort(localSession);
      safeEnd(localSession);
    }

    console.error("❌ Reward debit error:", err);
    throw err;
  }
};