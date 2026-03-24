const axios = require("axios");

exports.sendPayout = async ({ amount }) => {
  try {
    const BASE_URL = "https://sandbox.cashfree.com/payout";

    const transferId = "tx_" + Date.now();

    const response = await axios.post(
      `${BASE_URL}/v1/requestTransfer`,
      {
        beneId: "test_bene_001", // ✅ your created beneficiary
        amount: Number(amount),
        transferId,
        transferMode: "banktransfer", // ya "upi"
        remarks: "Withdraw payout",
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

    // ✅ CLEAN ERROR THROW (INSIDE catch only)
    throw new Error(
      err.response?.data?.message ||
      JSON.stringify(err.response?.data) ||
      err.message
    );
  }
};