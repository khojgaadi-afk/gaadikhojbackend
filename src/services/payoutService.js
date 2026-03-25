const axios = require("axios");

/* ==============================
   CASHFREE PAYOUT
============================== */
exports.sendPayout = async ({
  amount,
  beneId = "test_bene_001",
  transferMode = "banktransfer",
  remarks = "Withdraw payout",
}) => {
  try {
    const BASE_URL = "https://sandbox.cashfree.com/payout";
    const transferId = "tx_" + Date.now();

    const response = await axios.post(
      `${BASE_URL}/v1/requestTransfer`,
      {
        beneId,
        amount: Number(amount),
        transferId,
        transferMode,
        remarks,
      },
      {
        headers: {
          "X-Client-Id": process.env.APP_ID,
          "X-Client-Secret": process.env.SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ CASHFREE SUCCESS:", response.data);

    return {
      transferId,
      data: response.data,
    };
  } catch (err) {
    console.error(
      "❌ CASHFREE ERROR:",
      err.response?.data || err.message
    );

    throw new Error(
      err.response?.data?.message ||
      JSON.stringify(err.response?.data) ||
      err.message
    );
  }
};