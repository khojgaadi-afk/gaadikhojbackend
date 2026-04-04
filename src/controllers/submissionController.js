const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Submission = require("../models/Submission");
const Post = require("../models/Post");
const LostVehicle = require("../models/LostVehicle");
const User = require("../models/User");
const { creditReward } = require("../services/rewardService");
const { sendNotification } = require("../utils/sendNotification");

/* ===============================
   HELPERS
================================ */
const toRad = (value) => (value * Math.PI) / 180;

const getDistanceInKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const cleanupUploadedFile = (filename) => {
  if (!filename) return;
  try {
    const filePath = path.join(__dirname, "../../uploads", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("❌ File cleanup error:", err.message);
  }
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const safeAbort = async (session) => {
  try {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
  } catch (_) {}
};

const safeEnd = (session) => {
  try {
    session?.endSession();
  } catch (_) {}
};

/* ===============================
   USER SUBMITS PROOF
================================ */
const createSubmission = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { postId, vehicleId, lat, lng, notes } = req.body;
    const userId = req.user._id || req.user.id;

    if (!req.file) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Photo required",
      });
    }

    if ((postId && vehicleId) || (!postId && !vehicleId)) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Provide either postId or vehicleId, not both",
      });
    }

    if (postId && !isValidObjectId(postId)) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid post ID",
      });
    }

    if (vehicleId && !isValidObjectId(vehicleId)) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle ID",
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (
      Number.isNaN(latNum) ||
      Number.isNaN(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid location coordinates",
      });
    }

    const user = await User.findById(userId).session(session);

    if (!user) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isSuspicious) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(403).json({
        success: false,
        message: "Your account is under review",
      });
    }

    if (typeof user.trustScore === "number" && user.trustScore < 1) {
      cleanupUploadedFile(req.file.filename);
      await safeAbort(session);
      safeEnd(session);
      return res.status(403).json({
        success: false,
        message: "Your account is restricted due to low trust score",
      });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const recentSubmissions = await Submission.countDocuments({
      user: user._id,
      createdAt: { $gte: twoMinutesAgo },
    }).session(session);

    if (recentSubmissions >= 5) {
      user.suspiciousCount = (user.suspiciousCount || 0) + 1;
      if (user.suspiciousCount >= 3) {
        user.isSuspicious = true;
      }

      await user.save({ session });

      cleanupUploadedFile(req.file.filename);
      await session.commitTransaction();
      safeEnd(session);

      return res.status(429).json({
        success: false,
        message: "Too many submissions. Suspicious activity detected.",
      });
    }

    const photoPath = `/uploads/${req.file.filename}`;

    const submissionData = {
      user: user._id,
      photoUrl: photoPath,
      notes: typeof notes === "string" ? notes.trim().slice(0, 500) : "",
      lat: latNum,
      lng: lngNum,
      status: "pending",
    };

    /* ===============================
       NORMAL POST TASK
    ================================ */
    if (postId) {
      // IMPORTANT: assuming Post valid statuses are active / pending / expired
      const post = await Post.findOneAndUpdate(
        { _id: postId, status: "active" },
        { $set: { status: "pending" } },
        { new: true, session }
      );

      if (!post) {
        cleanupUploadedFile(req.file.filename);
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: "This task is no longer available",
        });
      }

      const existingUserSubmission = await Submission.findOne({
        post: postId,
        user: user._id,
      }).session(session);

      if (existingUserSubmission) {
        post.status = "active";
        await post.save({ session });

        cleanupUploadedFile(req.file.filename);
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: "You already submitted this task",
        });
      }

      const postLat = Number(post.location?.lat);
      const postLng = Number(post.location?.lng);

      const hasTargetLocation =
        post.location?.lat !== undefined &&
        post.location?.lat !== null &&
        post.location?.lng !== undefined &&
        post.location?.lng !== null &&
        !Number.isNaN(postLat) &&
        !Number.isNaN(postLng);

      if (hasTargetLocation) {
        const distanceKm = getDistanceInKm(postLat, postLng, latNum, lngNum);

        if (distanceKm > 10) {
          post.status = "active";
          await post.save({ session });

          cleanupUploadedFile(req.file.filename);
          await safeAbort(session);
          safeEnd(session);
          return res.status(400).json({
            success: false,
            message: `Too far from target location (${distanceKm.toFixed(2)} km away)`,
          });
        }

        submissionData.distanceKm = distanceKm;
      }

      submissionData.post = postId;
    }

    /* ===============================
       LOST VEHICLE TASK
    ================================ */
    if (vehicleId) {
      const vehicle = await LostVehicle.findById(vehicleId).session(session);

      if (!vehicle) {
        cleanupUploadedFile(req.file.filename);
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      const existingUserSubmission = await Submission.findOne({
        vehicle: vehicleId,
        user: user._id,
      }).session(session);

      if (existingUserSubmission) {
        cleanupUploadedFile(req.file.filename);
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: "You already submitted this vehicle task",
        });
      }

      const alreadyTaken = await Submission.findOne({
        vehicle: vehicleId,
        status: { $in: ["pending", "approved"] },
      }).session(session);

      if (alreadyTaken) {
        cleanupUploadedFile(req.file.filename);
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: "This vehicle task is already submitted by another user",
        });
      }

      submissionData.vehicle = vehicleId;
    }

    const [submission] = await Submission.create([submissionData], { session });

    await session.commitTransaction();
    safeEnd(session);

    return res.status(201).json({
      success: true,
      message: "Submission created successfully",
      submission,
    });
  } catch (err) {
    cleanupUploadedFile(req.file?.filename);
    await safeAbort(session);
    safeEnd(session);

    console.error("❌ Create submission error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

/* ===============================
   USER – MY SUBMISSIONS
================================ */
const getUserSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      user: req.user._id || req.user.id,
    })
      .populate("post", "carNumber city area rewardAmount photoUrl status location")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos location vehicleType")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      submissions,
    });
  } catch (err) {
    console.error("❌ Get user submissions error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ===============================
   ADMIN VERIFY SUBMISSION
================================ */
const verifySubmission = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { status } = req.body;
    const adminId = req.admin?._id || req.user?._id || req.user?.id || null;

    if (!isValidObjectId(req.params.id)) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const submission = await Submission.findOne({
      _id: req.params.id,
      status: "pending",
    }).session(session);

    if (!submission) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(400).json({
        success: false,
        message: "Submission already processed or not found",
      });
    }

    submission.status = status;
    submission.verifiedBy = adminId;
    submission.verifiedAt = new Date();

    const user = await User.findById(submission.user).session(session);

    if (!user) {
      await safeAbort(session);
      safeEnd(session);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.approvedSubmissions = user.approvedSubmissions || 0;
    user.rejectedSubmissions = user.rejectedSubmissions || 0;

    if (status === "approved") user.approvedSubmissions += 1;
    if (status === "rejected") user.rejectedSubmissions += 1;

    const total = user.approvedSubmissions + user.rejectedSubmissions;

    if (total >= 10) {
      user.trustScore = Number(
        ((user.approvedSubmissions / total) * 5).toFixed(2)
      );
    }

    let rewardAmount = 0;

    /* ===============================
       APPROVED - POST TASK
    ================================ */
    if (status === "approved" && submission.post) {
      const post = await Post.findById(submission.post).session(session);

      if (!post) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      rewardAmount = Number(Number(post.rewardAmount || 0).toFixed(2));
      submission.rewardAmount = rewardAmount;

      // IMPORTANT: final approved task should become expired
      post.status = "expired";

      await post.save({ session });
      await submission.save({ session });
      await user.save({ session });

      await session.commitTransaction();
      safeEnd(session);

      try {
        if (rewardAmount > 0) {
          await creditReward({
            userId: submission.user,
            amount: rewardAmount,
            refId: submission._id,
            source: "submission",
          });
        }
      } catch (rewardErr) {
        console.error("❌ Reward credit failed after approval:", rewardErr.message);
      }

      try {
        if (user?.pushToken) {
          await sendNotification(
            user.pushToken,
            "💰 Reward Approved",
            `You earned ₹${rewardAmount} for completing the task`
          );
        }
      } catch (notifyErr) {
        console.error("❌ Notification failed:", notifyErr.message);
      }

      return res.json({
        success: true,
        message: "Submission approved successfully",
        submission,
      });
    }

    /* ===============================
       APPROVED - LOST VEHICLE TASK
    ================================ */
    if (status === "approved" && submission.vehicle) {
      await user.save({ session });
      await submission.save({ session });

      await session.commitTransaction();
      safeEnd(session);

      try {
        if (user?.pushToken) {
          await sendNotification(
            user.pushToken,
            "✅ Submission Approved",
            "Your lost vehicle proof has been approved"
          );
        }
      } catch (notifyErr) {
        console.error("❌ Notification failed:", notifyErr.message);
      }

      return res.json({
        success: true,
        message: "Submission approved successfully",
        submission,
      });
    }

    /* ===============================
       REJECTED
    ================================ */
    if (status === "rejected") {
      if (submission.post) {
        const post = await Post.findById(submission.post).session(session);

        if (post) {
          // IMPORTANT: rejected proof means task becomes available again
          post.status = "active";
          await post.save({ session });
        }
      }

      await user.save({ session });
      await submission.save({ session });

      await session.commitTransaction();
      safeEnd(session);

      try {
        if (user?.pushToken) {
          await sendNotification(
            user.pushToken,
            "❌ Submission Rejected",
            "Your submission was rejected by admin"
          );
        }
      } catch (notifyErr) {
        console.error("❌ Notification failed:", notifyErr.message);
      }

      return res.json({
        success: true,
        message: "Submission rejected successfully",
        submission,
      });
    }

    await safeAbort(session);
    safeEnd(session);

    return res.status(400).json({
      success: false,
      message: "Invalid request",
    });
  } catch (err) {
    await safeAbort(session);
    safeEnd(session);

    console.error("❌ Verify submission error:", err);

    return res.status(500).json({
      success: false,
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
      .populate("post", "carNumber city area rewardAmount photoUrl status location")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos location vehicleType")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      submissions,
    });
  } catch (err) {
    console.error("❌ Pending submissions error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ===============================
   ADMIN – SINGLE
================================ */
const getSubmissionById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID",
      });
    }

    const submission = await Submission.findById(req.params.id)
      .populate("post", "carNumber city area rewardAmount photoUrl status location")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos location vehicleType")
      .populate("user", "email name");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    return res.json({
      success: true,
      submission,
    });
  } catch (err) {
    console.error("❌ Get submission by id error:", err);
    return res.status(500).json({
      success: false,
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
      .populate("post", "carNumber city area rewardAmount photoUrl status location")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos location vehicleType")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      submissions,
    });
  } catch (err) {
    console.error("❌ Get all submissions error:", err);
    return res.status(500).json({
      success: false,
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