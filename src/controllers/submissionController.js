const Submission = require("../models/Submission");
const Post = require("../models/Post");
const LostVehicle = require("../models/LostVehicle");
const User = require("../models/User");
const { creditReward } = require("../services/rewardService");
const { sendNotification } = require("../utils/sendNotification");

/* ===============================
   USER SUBMITS PROOF
================================ */
const createSubmission = async (req, res) => {
  try {
    const { postId, vehicleId, lat, lng, notes } = req.body;

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

    if (!postId && !vehicleId) {
      return res.status(400).json({
        message: "Task ID is required",
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        message: "Invalid location coordinates",
      });
    }

    let target = null;
    let taskType = null;

    /* ===============================
       POST TASK
    ================================ */
    if (postId) {
      const post = await Post.findById(postId);

      if (!post) {
        return res.status(404).json({
          message: "Post not found",
        });
      }

      // ✅ agar kisi aur ka approved/pending already hai toh block
      const alreadyTaken = await Submission.findOne({
        post: postId,
        status: { $in: ["pending", "approved"] },
      });

      if (alreadyTaken) {
        return res.status(400).json({
          message: "This task is already submitted by another user",
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

      const postLat = post.location?.lat;
      const postLng = post.location?.lng;

      if (postLat == null || postLng == null) {
        return res.status(400).json({
          message: "Target location missing for this post",
        });
      }

      const distance = Math.sqrt(
        Math.pow(postLat - latNum, 2) + Math.pow(postLng - lngNum, 2)
      );

      if (distance > 0.01) {
        return res.status(400).json({
          message: "Too far from target location",
        });
      }

      target = post;
      taskType = "post";
    }

    /* ===============================
       LOST VEHICLE TASK
    ================================ */
    if (vehicleId) {
      const vehicle = await LostVehicle.findById(vehicleId);

      if (!vehicle) {
        return res.status(404).json({
          message: "Vehicle not found",
        });
      }

      const alreadyTaken = await Submission.findOne({
        vehicle: vehicleId,
        status: { $in: ["pending", "approved"] },
      });

      if (alreadyTaken) {
        return res.status(400).json({
          message: "This vehicle task is already submitted by another user",
        });
      }

      const exist = await Submission.findOne({
        vehicle: vehicleId,
        user: req.user._id,
      });

      if (exist) {
        return res.status(400).json({
          message: "You already submitted this vehicle task",
        });
      }

      target = vehicle;
      taskType = "vehicle";
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

    const submissionData = {
      user: req.user._id,
      photoUrl: photoPath,
      notes: notes || "",
      lat: latNum,
      lng: lngNum,
      status: "pending",
    };

    if (taskType === "post") {
      submissionData.post = postId;
    }

    if (taskType === "vehicle") {
      submissionData.vehicle = vehicleId;
    }

    const submission = await Submission.create(submissionData);

    res.status(201).json(submission);
  } catch (err) {
    console.error("❌ Create submission error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};