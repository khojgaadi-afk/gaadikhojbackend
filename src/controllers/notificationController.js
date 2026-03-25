const Notification = require("../models/Notification");

/* =========================
   GET NOTIFICATIONS
========================= */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const notifications = await Notification.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json(notifications);
  } catch (err) {
    console.error("❌ Notification error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   MARK AS READ
========================= */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      message: "Notification marked as read",
    });
  } catch (err) {
    console.error("❌ Mark read error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   MARK ALL AS READ
========================= */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user: req.user._id,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.json({
      message: "All notifications marked as read",
    });
  } catch (err) {
    console.error("❌ Mark all read error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};