const Notification = require("../models/Notification");

const getNotifications = async (req, res) => {
  try {

    const notifications = await Notification.find({
      user: req.user._id
    }).sort({ createdAt: -1 });

    res.json(notifications);

  } catch (err) {
    console.error("❌ Notification error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getNotifications
};