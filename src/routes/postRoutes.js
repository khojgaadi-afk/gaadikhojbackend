const express = require("express");
const router = express.Router();

const {
  createPost,
  getActivePosts,
} = require("../controllers/postController");

// ✅ FIXED
const { protectAdmin } = require("../middleware/authMiddleware");

const upload = require("../utils/upload");

// 🔐 Admin creates car post
router.post(
  "/",
  protectAdmin,
  upload.single("photo"),
  createPost
);

// 🌍 Public / user: get all active posts
router.get("/", getActivePosts);

module.exports = router;