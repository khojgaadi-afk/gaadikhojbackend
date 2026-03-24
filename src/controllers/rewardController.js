const Wallet = require("../models/Wallet");

/* ============================
   CREDIT REWARD (SAFE)
============================ */

exports.creditReward = async ({ userId, amount, refId }) => {
  try {
    if (!userId) {
      throw new Error("Invalid userId");
    }

    const amountNum = Number(amount);

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Invalid amount");
    }

    /* 🔥 ATOMIC UPDATE + DUPLICATE PREVENT */
    const wallet = await Wallet.findOneAndUpdate(
      {
        user: userId,
        "transactions.refId": { $ne: refId }
      },
      {
        $inc: { balance: amountNum },
        $push: {
          transactions: {
            amount: amountNum,
            type: "credit",
            source: "ad", // reward source
            refId,
            description: "Task reward",

            /* 🔥 ADD THESE (FUTURE SAFE) */
            status: "success",
            orderId: null
          }
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return wallet;

  } catch (err) {
    console.error("❌ Reward credit error:", err);
    throw err;
  }
};