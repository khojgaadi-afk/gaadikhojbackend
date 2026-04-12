const express = require("express");
const router = express.Router();

/* =========================
   MIDDLEWARE
========================= */
const { upload } = require("../utils/upload");

const {
  createSubmission,
  verifySubmission,
  getPendingSubmissions,
  getAllSubmissions,
  getSubmissionById,
  getUserSubmissions,
} = require("../controllers/submissionController");

const {
  protect,
  protectAdmin,
} = require("../middleware/authMiddleware");

const { authorize } = require("../middleware/permissionMiddleware");

/* =========================
   USER ROUTES
========================= */

// CREATE SUBMISSION
router.post(
  "/",
  protect,
  (req, res, next) => {
    upload.single("photo")(req, res, function (err) {
      if (err) {
        console.error("❌ Multer upload error:", err);

        return res.status(400).json({
          success: false,
          message: err.message || "Image upload failed",
        });
      }

      next();
    });
  },
  createSubmission
);

// GET USER SUBMISSIONS
router.get("/user", protect, getUserSubmissions);

/* =========================
   ADMIN ROUTES
========================= */

// GET PENDING SUBMISSIONS
router.get(
  "/pending",
  protectAdmin,
  authorize("submissions.verify"),
  getPendingSubmissions
);

// GET ALL SUBMISSIONS
router.get(
  "/",
  protectAdmin,
  authorize("submissions.verify"),
  getAllSubmissions
);

// VERIFY (APPROVE / REJECT)
router.put(
  "/:id/verify",
  protectAdmin,
  authorize("submissions.verify"),
  verifySubmission
);

// GET SINGLE SUBMISSION
router.get(
  "/:id",
  protectAdmin,
  authorize("submissions.verify"),
  getSubmissionById
);

module.exports = router;