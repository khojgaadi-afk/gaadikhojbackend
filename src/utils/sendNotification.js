const axios = require("axios");

exports.sendNotification = async (token, title, body) => {
  try {
    if (!token) return;

    await axios.post("https://exp.host/--/api/v2/push/send", {
      to: token,
      sound: "default",
      title,
      body,
    });
  } catch (err) {
    console.error("❌ Notification Error:", err.response?.data || err.message);
  }
};