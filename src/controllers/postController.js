const Post = require("../models/Post");
const User = require("../models/User");
const { sendNotification } = require("../utils/sendNotification");


// ✅ Create new car post (Admin only)
exports.createPost = async (req, res) => {
  try {
    const { carNumber, city, area, rewardAmount } = req.body;

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    if (!carNumber || !city || !area || !rewardAmount) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create post
    const post = await Post.create({
      carNumber,
      city,
      area,
      rewardAmount,
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      createdBy: req.admin._id,
    });

    // 🔔 Get users with push token
    const users = await User.find({ pushToken: { $ne: null } });

    // 🔔 Send notification
    for (const user of users) {
      await sendNotification(
        user.pushToken,
        "🚗 New Task Available",
        `Car ${carNumber} spotted in ${city}. Reward ₹${rewardAmount}`
      );
    }

    res.status(201).json(post);

  } catch (err) {
    console.log("CREATE POST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// ✅ Get all active posts (for admin / users)
exports.getActivePosts = async (req, res) => {
  try {
    const posts = await Post.find({ status: "active" }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};