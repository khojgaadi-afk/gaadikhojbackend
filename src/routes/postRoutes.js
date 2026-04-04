const express = require("express");
const router = express.Router();

const {
  createPost,
  getActivePosts,
  updatePost,
  deletePost,
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

/* =========================
   ADMIN UPDATE POST
========================= */
router.put(
  "/:id",
  protectAdmin,
  authorize("posts.manage"),
  upload.single("photo"),
  updatePost
);

/* =========================
   ADMIN DELETE POST
========================= */
router.delete(
  "/:id",
  protectAdmin,
  authorize("posts.manage"),
  deletePost
);

module.exports = router;