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
        success: false,
        message: "carNumber, city, area and rewardAmount are required",
      });
    }

    const rewardNum = Number(rewardAmount);
    const latNum = lat !== undefined ? Number(lat) : null;
    const lngNum = lng !== undefined ? Number(lng) : null;

    if (isNaN(rewardNum) || rewardNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward amount",
      });
    }

    const post = await Post.create({
      carNumber: carNumber.trim().toUpperCase(),
      city: city.trim(),
      area: area.trim(),
      rewardAmount: rewardNum,
      location: {
        lat: isNaN(latNum) ? null : latNum,
        lng: isNaN(lngNum) ? null : lngNum,
      },
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      createdBy: req.admin?._id || req.user?._id || null,

      // ✅ CORRECT STATUS
      status: "active",
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
          `Car ${post.carNumber} spotted in ${post.city}. Reward ₹${rewardNum}`
        )
      )
    );

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post,
    });
  } catch (err) {
    console.error("❌ CREATE POST ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create post",
    });
  }
};

/* =========================
   GET ACTIVE POSTS
========================= */
exports.getActivePosts = async (req, res) => {
  try {
    const posts = await Post.find({ status: "active" }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      posts,
    });
  } catch (err) {
    console.error("❌ GET POSTS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch posts",
    });
  }
};