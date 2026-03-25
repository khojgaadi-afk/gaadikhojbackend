const Submission = require("../models/Submission");
const Post = require("../models/Post");
const User = require("../models/User");
const { creditReward } = require("../services/rewardService");
const { sendNotification } = require("../utils/sendNotification");

/* ===============================
   USER SUBMITS PROOF
================================ */
const createSubmission = async (req, res) => {
  try {
    const { postId, lat, lng, notes } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.trustScore < 1) {
      return res.status(403).json({
        message: "Your account is restricted due to low trust score",
      });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const recentSubmissions = await Submission.countDocuments({
      user: req.user._id,
      createdAt: { $gte: twoMinutesAgo },
    });

    if (recentSubmissions >= 5) {
      user.suspiciousCount += 1;

      if (user.suspiciousCount >= 3) {
        user.isSuspicious = true;
      }

      await user.save();

      return res.status(429).json({
        message: "Too many submissions. Suspicious activity detected.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Photo required",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        message: "Invalid location coordinates",
      });
    }

    const postLat = post.location?.lat;
    const postLng = post.location?.lng;

    if (postLat == null || postLng == null) {
      return res.status(400).json({
        message: "Target location missing for this post",
      });
    }

    const distance = Math.sqrt(
      Math.pow(postLat - latNum, 2) +
      Math.pow(postLng - lngNum, 2)
    );

    if (distance > 0.01) {
      return res.status(400).json({
        message: "Too far from target location",
      });
    }

    const exist = await Submission.findOne({
      post: postId,
      user: req.user._id,
    });

    if (exist) {
      return res.status(400).json({
        message: "You already submitted this task",
      });
    }

    const photoPath = `/uploads/${req.file.filename}`;

    const duplicatePhoto = await Submission.findOne({
      photoUrl: photoPath,
    });

    if (duplicatePhoto) {
      user.suspiciousCount += 1;

      if (user.suspiciousCount >= 3) {
        user.isSuspicious = true;
      }

      await user.save();

      return res.status(400).json({
        message: "Duplicate photo detected",
      });
    }

    const submission = await Submission.create({
      post: postId,
      user: req.user._id,
      photoUrl: photoPath,
      notes: notes || "",
      lat: latNum,
      lng: lngNum,
      status: "pending",
    });

    res.status(201).json(submission);
  } catch (err) {
    console.error("❌ Create submission error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

/* ===============================
   USER – MY SUBMISSIONS
================================ */
const getUserSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      user: req.user._id,
    })
      .populate("post", "carNumber city area rewardAmount")
      .sort({ createdAt: -1 });

    res.json(submissions);
  } catch (err) {
    console.error("❌ Get user submissions error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

/* ===============================
   ADMIN VERIFY SUBMISSION
================================ */
const verifySubmission = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        message: "Submission not found",
      });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({
        message: "Submission already processed",
      });
    }

    submission.status = status;
    submission.verifiedBy = req.admin._id;
    submission.verifiedAt = new Date();

    const user = await User.findById(submission.user);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (status === "approved") {
      user.approvedSubmissions += 1;
    }

    if (status === "rejected") {
      user.rejectedSubmissions += 1;
    }

    const total = user.approvedSubmissions + user.rejectedSubmissions;

    if (total > 0) {
      user.trustScore = Number(
        ((user.approvedSubmissions / total) * 5).toFixed(2)
      );
    }

    let rewardAmount = 0;

    if (status === "approved") {
      const post = await Post.findById(submission.post);

      if (!post) {
        return res.status(404).json({
          message: "Post not found",
        });
      }

      rewardAmount = post.rewardAmount || 0;
      submission.rewardAmount = rewardAmount;

      await creditReward({
        userId: submission.user,
        amount: rewardAmount,
        refId: submission._id.toString(),
      });

      if (user?.pushToken) {
        await sendNotification(
          user.pushToken,
          "💰 Reward Approved",
          `You earned ₹${rewardAmount} for finding vehicle`
        );
      }
    }

    await submission.save();
    await user.save();

    res.json({
      message: "Submission updated successfully",
      submission,
    });
  } catch (err) {
    console.error("❌ Verify submission error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

/* ===============================
   ADMIN – PENDING
================================ */
const getPendingSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ status: "pending" })
      .populate("post", "carNumber city area rewardAmount")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    res.json(submissions);
  } catch (err) {
    console.error("❌ Pending submissions error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

/* ===============================
   ADMIN – SINGLE
================================ */
const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate("post", "carNumber city area rewardAmount")
      .populate("user", "email name");

    if (!submission) {
      return res.status(404).json({
        message: "Submission not found",
      });
    }

    res.json(submission);
  } catch (err) {
    console.error("❌ Get submission by id error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

/* ===============================
   ADMIN – ALL
================================ */
const getAllSubmissions = async (req, res) => {
  try {
    const { status, from, to } = req.query;

    const query = {};

    if (status) query.status = status;

    if (from || to) {
      query.createdAt = {};

      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const submissions = await Submission.find(query)
      .populate("post", "carNumber city area rewardAmount")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    res.json(submissions);
  } catch (err) {
    console.error("❌ Get all submissions error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

module.exports = {
  createSubmission,
  verifySubmission,
  getPendingSubmissions,
  getAllSubmissions,
  getSubmissionById,
  getUserSubmissions,
};