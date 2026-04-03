const express = require("express");
const router = express.Router();

/* =========================
   MIDDLEWARES
========================= */
const upload = require("../middleware/uploadMiddleware"); // ✅ NEW (Cloudinary memory upload)

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

// 🔥 CREATE SUBMISSION (PHOTO UPLOAD)
router.post(
  "/",
  protectUser,
  upload.single("photo"), // ⚠️ IMPORTANT: field name MUST be "photo"
  createSubmission
);

// 🔥 GET USER SUBMISSIONS
router.get("/user", protectUser, getUserSubmissions);

/* =========================
   ADMIN ROUTES
========================= */

// ⚠️ IMPORTANT: Specific routes FIRST

// 🔥 GET PENDING SUBMISSIONS
router.get(
  "/pending",
  protectAdmin,
  authorize("submissions.verify"),
  getPendingSubmissions
);

// 🔥 GET ALL SUBMISSIONS
router.get(
  "/",
  protectAdmin,
  authorize("submissions.verify"),
  getAllSubmissions
);

// 🔥 VERIFY (APPROVE / REJECT)
router.put(
  "/:id/verify",
  protectAdmin,
  authorize("submissions.verify"),
  verifySubmission
);

// 🔥 GET SINGLE SUBMISSION
router.get(
  "/:id",
  protectAdmin,
  authorize("submissions.verify"),
  getSubmissionById
);

module.exports = router;