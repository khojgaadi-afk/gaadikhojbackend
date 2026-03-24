const Submission = require("../models/Submission");
const Post = require("../models/Post");
const { creditReward } = require("../services/payoutService");
const { sendNotification } = require("../utils/sendNotification");
const User = require("../models/User");

/* ===============================
   USER SUBMITS PROOF
================================ */

const createSubmission = async (req, res) => {
  try {
    const { postId, lat, lng } = req.body;

    const user = await User.findById(req.user._id);

    if (user.trustScore < 1) {
      return res.status(403).json({
        message: "Your account is restricted due to low trust score"
      });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const recentSubmissions = await Submission.countDocuments({
      userId: req.user._id,
      createdAt: { $gte: twoMinutesAgo }
    });

    if (recentSubmissions >= 5) {
      user.suspiciousCount += 1;

      if (user.suspiciousCount >= 3) {
        user.isSuspicious = true;
      }

      await user.save();

      return res.status(429).json({
        message: "Too many submissions. Suspicious activity detected."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Photo required"
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not found"
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    const distance = Math.sqrt(
      Math.pow(post.lat - latNum, 2) +
      Math.pow(post.lng - lngNum, 2)
    );

    if (distance > 0.01) {
      return res.status(400).json({
        message: "Too far from target location"
      });
    }

    const exist = await Submission.findOne({
      postId,
      userId: req.user._id
    });

    if (exist) {
      return res.status(400).json({
        message: "You already submitted this task"
      });
    }

    const photoPath = `/uploads/${req.file.filename}`;

    const duplicatePhoto = await Submission.findOne({
      photoUrl: photoPath
    });

    if (duplicatePhoto) {
      user.suspiciousCount += 1;

      if (user.suspiciousCount >= 3) {
        user.isSuspicious = true;
      }

      await user.save();

      return res.status(400).json({
        message: "Duplicate photo detected"
      });
    }

    const submission = await Submission.create({
      postId,
      userId: req.user._id,
      photoUrl: photoPath,
      lat: latNum,
      lng: lngNum,
      status: "pending"
    });

    res.status(201).json(submission);

  } catch (err) {
    console.error("Create submission error:", err);

    res.status(500).json({
      message: err.message
    });
  }
};

/* ===============================
   USER – MY SUBMISSIONS
================================ */

const getUserSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      userId: req.user._id
    })
      .populate("postId", "carNumber city area rewardAmount")
      .sort({ createdAt: -1 });

    res.json(submissions);

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

/* ===============================
   ADMIN VERIFY SUBMISSION
================================ */

const verifySubmission = async (req, res) => {
  try {
    const { status } = req.body;

    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        message: "Submission not found"
      });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({
        message: "Submission already processed"
      });
    }

    submission.status = status;
    submission.verifiedBy = req.admin._id;

    await submission.save();

    const user = await User.findById(submission.userId);

    if (status === "approved") {
      user.approvedSubmissions += 1;
    }

    if (status === "rejected") {
      user.rejectedSubmissions += 1;
    }

    const total = user.approvedSubmissions + user.rejectedSubmissions;

    if (total > 0) {
      user.trustScore = (user.approvedSubmissions / total) * 5;
    }

    await user.save();

    if (status === "approved") {
      const post = await Post.findById(submission.postId);

      if (!post) {
        return res.status(404).json({
          message: "Post not found"
        });
      }

      await creditReward({
        userId: submission.userId,
        amount: post.rewardAmount,
        refId: submission._id.toString()
      });

      if (user?.pushToken) {
        await sendNotification(
          user.pushToken,
          "💰 Reward Approved",
          `You earned ₹${post.rewardAmount} for finding vehicle`
        );
      }
    }

    res.json({
      message: "Submission updated successfully",
      submission
    });

  } catch (err) {
    console.error("Verify submission error:", err);

    res.status(500).json({
      message: err.message
    });
  }
};

/* ===============================
   ADMIN – PENDING
================================ */

const getPendingSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ status: "pending" })
      .populate("postId", "carNumber city area rewardAmount")
      .populate("userId", "email name")
      .sort({ createdAt: -1 });

    res.json(submissions);

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

/* ===============================
   ADMIN – SINGLE
================================ */

const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate("postId", "carNumber city area rewardAmount")
      .populate("userId", "email name");

    if (!submission) {
      return res.status(404).json({
        message: "Submission not found"
      });
    }

    res.json(submission);

  } catch (err) {
    res.status(500).json({
      message: err.message
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
      .populate("postId", "carNumber city area rewardAmount")
      .populate("userId", "email name")
      .sort({ createdAt: -1 });

    res.json(submissions);

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

/* ===============================
   EXPORT (MOST IMPORTANT)
================================ */

module.exports = {
  createSubmission,
  verifySubmission,
  getPendingSubmissions,
  getAllSubmissions,
  getSubmissionById,
  getUserSubmissions
};