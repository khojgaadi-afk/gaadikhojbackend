const Wallet = require("../models/Wallet");
const Reward = require("../models/Reward");

/* ============================
   CREDIT REWARD (SAFE)
============================ */
exports.creditReward = async ({ userId, amount, refId, source = "submission" }) => {
  try {
    if (!userId) {
      throw new Error("Invalid userId");
    }

    const amountNum = Number(amount);

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Invalid amount");
    }

    /* DUPLICATE REWARD CHECK */
    const existingReward = await Reward.findOne({
      user: userId,
      refId,
      type: "credit",
      source,
    });

    if (existingReward) {
      console.log("⚠️ Reward already credited for this refId");
      return existingReward;
    }

    /* FIND OR CREATE WALLET */
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        transactions: [],
      });
    }

    /* CREDIT BALANCE */
    wallet.balance += amountNum;

    wallet.transactions.push({
      amount: amountNum,
      type: "credit",
      source: source === "submission" ? "bonus" : source,
      refId,
      description:
        source === "submission"
          ? "Task reward credited"
          : `${source} reward credited`,
    });

    await wallet.save();

    /* CREATE REWARD RECORD */
    const reward = await Reward.create({
      user: userId,
      amount: amountNum,
      refId,
      type: "credit",
      source,
      description:
        source === "submission"
          ? "Reward for approved submission"
          : `${source} reward`,
    });

    return reward;
  } catch (err) {
    console.error("❌ Reward credit error:", err);
    throw err;
  }
};