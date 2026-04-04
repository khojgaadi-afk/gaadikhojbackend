const express = require("express");
const router = express.Router();

const {
  createPost,
  getActivePosts,
} = require("../controllers/postController");

const { adminProtect: protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

const upload = require("../utils/upload");

/* =========================
   ADMIN CREATE POST
========================= */
router.post(
  "/",
  protectAdmin,
  authorize("posts.manage"),
  upload.single("photo"),
  createPost
);

/* =========================
   PUBLIC / USER GET ACTIVE POSTS
========================= */
router.get("/", getActivePosts);

module.exports = router;