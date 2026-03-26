const Submission = require("../models/Submission");
const Post = require("../models/Post");
const LostVehicle = require("../models/LostVehicle");

/* ===============================
   GET AVAILABLE TASKS FOR USER
================================ */
const getAvailableTasks = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    /* ===============================
       FETCH ALL
    ================================ */
    const [posts, vehicles, submissions] = await Promise.all([
      Post.find({ status: "active" }).lean(),
      LostVehicle.find({ status: "approved" }).lean(),
      Submission.find({}).lean(), // ✅ ALL submissions
    ]);

    /* ===============================
       BLOCKED IDS
    ================================ */
    const blockedPostIds = new Set();
    const blockedVehicleIds = new Set();

    submissions.forEach((s) => {
      const isMine = String(s.user) === userId;

      // =========================
      // POST TASK RULES
      // =========================
      if (s.post) {
        const postId = String(s.post);

        // 🔥 If I already submitted (any status) => hide forever
        if (isMine) {
          blockedPostIds.add(postId);
        }

        // 🔥 If someone else already has pending/approved => hide
        if (!isMine && ["pending", "approved"].includes(s.status)) {
          blockedPostIds.add(postId);
        }
      }

      // =========================
      // VEHICLE TASK RULES
      // =========================
      if (s.vehicle) {
        const vehicleId = String(s.vehicle);

        // 🔥 If I already submitted (any status) => hide forever
        if (isMine) {
          blockedVehicleIds.add(vehicleId);
        }

        // 🔥 If someone else already has pending/approved => hide
        if (!isMine && ["pending", "approved"].includes(s.status)) {
          blockedVehicleIds.add(vehicleId);
        }
      }
    });

    /* ===============================
       FILTER POSTS
    ================================ */
    const filteredPosts = posts
      .filter((p) => !blockedPostIds.has(String(p._id)))
      .map((p) => ({
        ...p,
        type: "post",
      }));

    /* ===============================
       FILTER VEHICLES
    ================================ */
    const filteredVehicles = vehicles
      .filter((v) => !blockedVehicleIds.has(String(v._id)))
      .map((v) => ({
        ...v,
        type: "lostVehicle",
      }));

    /* ===============================
       MERGE + SORT
    ================================ */
    const tasks = [...filteredPosts, ...filteredVehicles].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json(tasks);
  } catch (err) {
    console.error("❌ Get available tasks error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

module.exports = {
  getAvailableTasks,
};