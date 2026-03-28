const express = require("express");
const router = express.Router();

const {
  createPost,
  getActivePosts,
} = require("../controllers/postController");

const { protectUser } = require("../middleware/authMiddleware");
const upload = require("../utils/upload");

/* =========================
   USER CREATE POST
========================= */
router.post(
  "/",
  protectUser,
  upload.single("photo"),
  createPost
);

/* =========================
   PUBLIC / USER GET ACTIVE POSTS
========================= */
router.get("/", getActivePosts);

module.exports = router;