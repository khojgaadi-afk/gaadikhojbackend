const axios = require("axios");

/* ============================
   CASHFREE PAYOUT SERVICE
============================ */

exports.sendPayout = async ({ amount }) => {
  try {

    const BASE_URL = "https://sandbox.cashfree.com/payout";

    const transferId = "tx_" + Date.now();

    const response = await axios.post(
      `${BASE_URL}/v1/requestTransfer`,
      {
        beneId: "Test", // 🔥 SAME EXACT ID as Cashfree dashboard
        amount: Number(amount),
        transferId: transferId,
        transferMode: "upi",
        remarks: "Withdraw payout"
      },
      {
        headers: {
          "X-Client-Id": process.env.APP_ID?.trim(),
          "X-Client-Secret": process.env.SECRET_KEY?.trim(),
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ CASHFREE SUCCESS:", response.data);

    return {
      transferId: response.data.transferId || transferId,
      data: response.data
    };

  } catch (err) {

    console.error(
      "❌ CASHFREE ERROR FULL:",
      err.response?.data || err.message
    );

    /* 🔥 CLEAN ERROR THROW */
    throw new Error(
      err.response?.data?.message ||
      JSON.stringify(err.response?.data) ||
      err.message
    );
  }
};