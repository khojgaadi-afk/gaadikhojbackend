const Post = require("../models/Post");
const User = require("../models/User");
const { sendNotification } = require("../utils/sendNotification");
const { uploadToCloudinary } = require("../utils/upload"); // ✅ Cloudinary

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

    // ✅ Cloudinary upload
    let photoUrl = null;
    if (req.file?.buffer) {
      photoUrl = await uploadToCloudinary(req.file.buffer, "gaadikhoj/posts");
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
      photoUrl,
      createdBy: req.admin?._id || req.user?._id || null,
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

/* =========================
   UPDATE POST
========================= */
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { carNumber, city, area, rewardAmount, status } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (carNumber !== undefined) post.carNumber = carNumber.trim().toUpperCase();
    if (city !== undefined) post.city = city.trim();
    if (area !== undefined) post.area = area.trim();

    if (rewardAmount !== undefined) {
      const rewardNum = Number(rewardAmount);
      if (isNaN(rewardNum) || rewardNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid reward amount",
        });
      }
      post.rewardAmount = rewardNum;
    }

    if (status !== undefined) post.status = status;

    // ✅ Update pe bhi Cloudinary upload
    if (req.file?.buffer) {
      post.photoUrl = await uploadToCloudinary(req.file.buffer, "gaadikhoj/posts");
    }

    await post.save();

    return res.json({
      success: true,
      message: "Post updated successfully",
      post,
    });
  } catch (err) {
    console.error("❌ UPDATE POST ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update post",
    });
  }
};

/* =========================
   DELETE POST
========================= */
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByIdAndDelete(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    return res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (err) {
    console.error("❌ DELETE POST ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete post",
    });
  }
};