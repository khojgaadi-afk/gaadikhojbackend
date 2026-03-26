const Submission = require("../models/Submission");
const Post = require("../models/Post");
const LostVehicle = require("../models/LostVehicle");

/* ===============================
   GET AVAILABLE TASKS FOR USER
================================ */
const getAvailableTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    /* ===============================
       ALL POSTS + LOST VEHICLES
    ================================ */
    const [posts, vehicles, submissions] = await Promise.all([
      Post.find({ status: "active" }).lean(),
      LostVehicle.find({ status: "approved" }).lean(),
      Submission.find({
        status: { $in: ["pending", "approved"] },
      }).lean(),
    ]);

    /* ===============================
       TAKEN IDS
    ================================ */
    const takenPostIds = new Set();
    const takenVehicleIds = new Set();
    const myPostIds = new Set();
    const myVehicleIds = new Set();

    submissions.forEach((s) => {
      if (s.post) {
        takenPostIds.add(String(s.post));
        if (String(s.user) === String(userId)) {
          myPostIds.add(String(s.post));
        }
      }

      if (s.vehicle) {
        takenVehicleIds.add(String(s.vehicle));
        if (String(s.user) === String(userId)) {
          myVehicleIds.add(String(s.vehicle));
        }
      }
    });

    /* ===============================
       FILTER POSTS
    ================================ */
    const filteredPosts = posts
      .filter(
        (p) =>
          !takenPostIds.has(String(p._id)) &&
          !myPostIds.has(String(p._id))
      )
      .map((p) => ({
        ...p,
        type: "post",
      }));

    /* ===============================
       FILTER VEHICLES
    ================================ */
    const filteredVehicles = vehicles
      .filter(
        (v) =>
          !takenVehicleIds.has(String(v._id)) &&
          !myVehicleIds.has(String(v._id))
      )
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