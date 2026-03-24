const axios = require("axios");

const cashfree = axios.create({
  baseURL: "https://payout-api.cashfree.com",
  headers: {
    "Content-Type": "application/json",
    "x-client-id": process.env.CASHFREE_CLIENT_ID,
    "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
  },
});

module.exports = cashfree;