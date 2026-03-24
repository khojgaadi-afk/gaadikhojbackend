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

// ✅ CORRECT IMPORTS
const { protectAdmin } = require("../middleware/authMiddleware");
const { protectUser } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");

/* USER */
router.post("/", protectUser, upload.single("photo"), createSubmission);
router.get("/user", protectUser, getUserSubmissions);

/* ADMIN */
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