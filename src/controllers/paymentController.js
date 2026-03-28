const axios = require("axios");

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || "SANDBOX";

const BASE_URL =
  CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

/* =========================
   PRICE BY VEHICLE TYPE
========================= */
const getRecoveryCharge = (vehicleType) => {
  switch (vehicleType) {
    case "bike":
    case "scooter":
      return 500;
    case "car":
      return 2500;
    case "truck":
    case "commercial":
      return 5500;
    default:
      return 2500;
  }
};

/* =========================
   CREATE CASHFREE ORDER
========================= */
const createLostVehiclePayment = async (req, res) => {
  try {
    const { vehicleType, phone } = req.body;

    if (!vehicleType || !phone) {
      return res.status(400).json({
        message: "Vehicle type and phone are required",
      });
    }

    const amount = getRecoveryCharge(vehicleType);
    const orderId = `LV_${Date.now()}`;

    const payload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: req.user?.id?.toString() || `guest_${Date.now()}`,
        customer_phone: phone,
      },
      order_meta: {
        return_url: "https://example.com/payment-return",
      },
      order_note: `Lost vehicle report payment for ${vehicleType}`,
    };

    const response = await axios.post(`${BASE_URL}/orders`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
    });

    return res.status(200).json({
      success: true,
      orderId: response.data.order_id,
      paymentSessionId: response.data.payment_session_id,
      amount,
      env: CASHFREE_ENV,
    });
  } catch (err) {
    console.log(
      "❌ Cashfree order create error:",
      err?.response?.data || err.message
    );

    return res.status(500).json({
      message:
        err?.response?.data?.message || "Unable to create payment order",
    });
  }
};

/* =========================
   VERIFY CASHFREE PAYMENT
========================= */
const verifyLostVehiclePayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const response = await axios.get(`${BASE_URL}/orders/${orderId}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
    });

    const order = response.data;

    return res.status(200).json({
      success: true,
      paid: order.order_status === "PAID",
      order,
    });
  } catch (err) {
    console.log(
      "❌ Cashfree verify error:",
      err?.response?.data || err.message
    );

    return res.status(500).json({
      message:
        err?.response?.data?.message || "Unable to verify payment",
    });
  }
};

/* =========================
   EXPORT
========================= */
module.exports = {
  createLostVehiclePayment,
  verifyLostVehiclePayment,
};