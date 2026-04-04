const Post = require("../models/Post");
const User = require("../models/User");
const { sendNotification } = require("../utils/sendNotification");

/* =========================
   CREATE NEW POST (ADMIN)
========================= */
exports.createPost = async (req, res) => {
  try {
    const { carNumber, city, area, rewardAmount, lat, lng } = req.body;

    if (!carNumber || !city || !area || !rewardAmount) {
      return res.status(400).json({
        message: "carNumber, city, area and rewardAmount are required",
      });
    }

    const rewardNum = Number(rewardAmount);
    const latNum = lat !== undefined ? Number(lat) : null;
    const lngNum = lng !== undefined ? Number(lng) : null;

    if (isNaN(rewardNum) || rewardNum <= 0) {
      return res.status(400).json({
        message: "Invalid reward amount",
      });
    }

    const post = await Post.create({
      carNumber,
      city,
      area,
      rewardAmount: rewardNum,
      location: {
        lat: isNaN(latNum) ? null : latNum,
        lng: isNaN(lngNum) ? null : lngNum,
      },
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      createdBy: req.admin._id,

      // 🔥 FIX
      status: "approved",
    });

    /* 🔔 SEND NOTIFICATIONS */
    const users = await User.find({
      pushToken: { $ne: null },
      status: "active",
    }).select("pushToken");

    await Promise.allSettled(
      users.map((user) =>
        sendNotification(
          user.pushToken,
          "🚗 New Task Available",
          `Car ${carNumber} spotted in ${city}. Reward ₹${rewardNum}`
        )
      )
    );

    res.status(201).json(post);
  } catch (err) {
    console.error("❌ CREATE POST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET ACTIVE POSTS
========================= */
exports.getActivePosts = async (req, res) => {
  try {
    const posts = await Post.find({ status: "approved" }).sort({
      createdAt: -1,
    });

    res.json(posts);
  } catch (err) {
    console.error("❌ GET POSTS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};