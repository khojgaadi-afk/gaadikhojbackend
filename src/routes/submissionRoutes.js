const express = require("express");
const router = express.Router();

const upload = require("../utils/upload");

const {
  createSubmission,
  verifySubmission,
  getPendingSubmissions,
  getAllSubmissions,
  getSubmissionById,
  getUserSubmissions,
} = require("../controllers/submissionController");

const {
  protectAdmin,
  protectUser,
} = require("../middleware/authMiddleware");

const { authorize } = require("../middleware/permissionMiddleware");

/* =========================
   USER ROUTES
========================= */
router.post(
  "/",
  protectUser,
  upload.single("photo"),
  createSubmission
);

router.get("/user", protectUser, getUserSubmissions);

/* =========================
   ADMIN ROUTES
========================= */

// 🔥 IMPORTANT: specific routes first
router.get(
  "/pending",
  protectAdmin,
  authorize("submissions.verify"),
  getPendingSubmissions
);

router.get(
  "/",
  protectAdmin,
  authorize("submissions.verify"),
  getAllSubmissions
);

router.put(
  "/:id/verify",
  protectAdmin,
  authorize("submissions.verify"),
  verifySubmission
);

router.get(
  "/:id",
  protectAdmin,
  authorize("submissions.verify"),
  getSubmissionById
);

module.exports = router;