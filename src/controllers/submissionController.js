const Submission = require("../models/Submission");
const Post = require("../models/Post");
const LostVehicle = require("../models/LostVehicle");
const User = require("../models/User");
const { creditReward } = require("../services/rewardService");
const { sendNotification } = require("../utils/sendNotification");

const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

/* ===============================
   HELPERS
================================ */
const toRad = (value) => (value * Math.PI) / 180;

const getDistanceInKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // km
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

const uploadBufferToCloudinary = (
  fileBuffer,
  folder = "gaadikhoj/submissions"
) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

/* ===============================
   USER SUBMITS PROOF
================================ */
const createSubmission = async (req, res) => {
  try {
    const { postId, vehicleId, lat, lng, notes } = req.body;

    const user = await User.findById(req.user._id || req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (typeof user.trustScore === "number" && user.trustScore < 1) {
      return res.status(403).json({
        success: false,
        message: "Your account is restricted due to low trust score",
      });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const recentSubmissions = await Submission.countDocuments({
      user: user._id,
      createdAt: { $gte: twoMinutesAgo },
    });

    if (recentSubmissions >= 5) {
      user.suspiciousCount = (user.suspiciousCount || 0) + 1;

      if (user.suspiciousCount >= 3) {
        user.isSuspicious = true;
      }

      await user.save();

      return res.status(429).json({
        success: false,
        message: "Too many submissions. Suspicious activity detected.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo required",
      });
    }

    if (!postId && !vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Task ID is required",
      });
    }

    if (postId && vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Provide either postId or vehicleId, not both",
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid location coordinates",
      });
    }

    let submissionData = {
      user: user._id,
      notes: notes || "",
      lat: latNum,
      lng: lngNum,
      status: "pending",
    };

    /* ===============================
       NORMAL POST TASK
    ================================ */
    if (postId) {
      const post = await Post.findById(postId);

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      if (post.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "This task is no longer active",
        });
      }

      const alreadyTaken = await Submission.findOne({
        post: postId,
        status: { $in: ["pending", "approved"] },
      });

      if (alreadyTaken) {
        return res.status(400).json({
          success: false,
          message: "This task is already submitted by another user",
        });
      }

      const exist = await Submission.findOne({
        post: postId,
        user: user._id,
      });

      if (exist) {
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
        !isNaN(postLat) &&
        !isNaN(postLng);

      if (hasTargetLocation) {
        const distanceKm = getDistanceInKm(postLat, postLng, latNum, lngNum);

        if (distanceKm > 10) {
          return res.status(400).json({
            success: false,
            message: `Too far from target location (${distanceKm.toFixed(
              2
            )} km away)`,
          });
        }

        submissionData.distanceKm = distanceKm;
      }

      submissionData.post = postId;

      // 🔥 lock task until admin verifies
      post.status = "pending";
      await post.save();
    }

    /* ===============================
       LOST VEHICLE TASK
    ================================ */
    if (vehicleId) {
      const vehicle = await LostVehicle.findById(vehicleId);

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      const alreadyTaken = await Submission.findOne({
        vehicle: vehicleId,
        status: { $in: ["pending", "approved"] },
      });

      if (alreadyTaken) {
        return res.status(400).json({
          success: false,
          message: "This vehicle task is already submitted by another user",
        });
      }

      const exist = await Submission.findOne({
        vehicle: vehicleId,
        user: user._id,
      });

      if (exist) {
        return res.status(400).json({
          success: false,
          message: "You already submitted this vehicle task",
        });
      }

      submissionData.vehicle = vehicleId;
    }

    /* ===============================
       UPLOAD TO CLOUDINARY (LAST STEP)
    ================================ */
    let uploadedImage;
    try {
      uploadedImage = await uploadBufferToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error("❌ Cloudinary upload failed:", uploadErr);
      return res.status(500).json({
        success: false,
        message: "Image upload failed. Please try again.",
      });
    }

    submissionData.photoUrl = uploadedImage.secure_url;

    const submission = await Submission.create(submissionData);

    return res.status(201).json({
      success: true,
      message: "Submission created successfully",
      submission,
    });
  } catch (err) {
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
      .populate("post", "carNumber city area rewardAmount photoUrl status")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos")
      .sort({ createdAt: -1 });

    return res.json(submissions);
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
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Submission already processed",
      });
    }

    submission.status = status;
    submission.verifiedBy = req.admin._id;
    submission.verifiedAt = new Date();

    const user = await User.findById(submission.user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.approvedSubmissions = user.approvedSubmissions || 0;
    user.rejectedSubmissions = user.rejectedSubmissions || 0;

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
      if (submission.post) {
        const post = await Post.findById(submission.post);

        if (!post) {
          return res.status(404).json({
            success: false,
            message: "Post not found",
          });
        }

        rewardAmount = Number(post.rewardAmount || 0);
        submission.rewardAmount = rewardAmount;

        if (rewardAmount > 0) {
          await creditReward({
            userId: submission.user,
            amount: rewardAmount,
            refId: submission._id.toString(),
          });
        }

        post.status = "expired";
        await post.save();

        if (user?.pushToken) {
          await sendNotification(
            user.pushToken,
            "💰 Reward Approved",
            `You earned ₹${rewardAmount} for finding vehicle`
          );
        }
      }

      if (submission.vehicle) {
        if (user?.pushToken) {
          await sendNotification(
            user.pushToken,
            "✅ Submission Approved",
            "Your lost vehicle proof has been approved"
          );
        }
      }
    }

    if (status === "rejected") {
      if (submission.post) {
        const post = await Post.findById(submission.post);
        if (post) {
          post.status = "active";
          await post.save();
        }
      }

      if (user?.pushToken) {
        await sendNotification(
          user.pushToken,
          "❌ Submission Rejected",
          "Your submission was rejected by admin"
        );
      }
    }

    await submission.save();
    await user.save();

    return res.json({
      success: true,
      message: "Submission updated successfully",
      submission,
    });
  } catch (err) {
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
      .populate("post", "carNumber city area rewardAmount photoUrl status")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    return res.json(submissions);
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
    const submission = await Submission.findById(req.params.id)
      .populate("post", "carNumber city area rewardAmount photoUrl status")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos")
      .populate("user", "email name");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    return res.json(submission);
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
      .populate("post", "carNumber city area rewardAmount photoUrl status")
      .populate("vehicle", "vehicleNumber city area vehiclePhotos")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    return res.json(submissions);
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