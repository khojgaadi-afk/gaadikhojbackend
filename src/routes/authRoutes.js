const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { body } = require("express-validator");

const {
  registerAdmin,
  loginAdmin,
} = require("../controllers/authController");

const Admin = require("../models/Admin");
const AdminSession = require("../models/AdminSession");

// ✅ IMPORTANT: apne actual folder structure ke hisaab se yahi use karo
const { adminProtect: protectAdmin } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");

console.log("protectAdmin:", protectAdmin);
console.log("authorizeRoles:", authorizeRoles);
console.log("validate:", validate);
console.log("registerAdmin:", registerAdmin);
console.log("loginAdmin:", loginAdmin);

/* =========================
   VALIDATION
========================= */
const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

const passwordValidation = [
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const registerValidation = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("role")
    .optional()
    .isIn(["admin", "superadmin"])
    .withMessage("Role must be admin or superadmin"),
];

/* =========================
   REGISTER (Superadmin only)
========================= */
router.post(
  "/register",
  protectAdmin,
  authorizeRoles("superadmin"),
  ...registerValidation,
  validate,
  registerAdmin
);

/* =========================
   LOGIN
========================= */
router.post(
  "/login",
  ...loginValidation,
  validate,
  loginAdmin
);

/* =========================
   LOGOUT
========================= */
router.post("/logout", protectAdmin, async (req, res) => {
  try {
    // ✅ safer: close all active sessions for this admin
    await AdminSession.updateMany(
      { adminId: req.admin._id, isActive: true },
      {
        $set: {
          logoutTime: new Date(),
          isActive: false,
        },
      }
    );

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Admin logout error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Logout failed",
    });
  }
});

/* =========================
   SESSIONS (Superadmin only)
========================= */
router.get(
  "/sessions",
  protectAdmin,
  authorizeRoles("superadmin"),
  async (req, res) => {
    try {
      const sessions = await AdminSession.find()
        .populate("adminId", "name email role")
        .sort({ loginTime: -1 });

      return res.json({
        success: true,
        count: sessions.length,
        data: sessions,
      });
    } catch (err) {
      console.error("Admin sessions error:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to fetch sessions",
      });
    }
  }
);

/* =========================
   CURRENT ADMIN
========================= */
router.get("/me", protectAdmin, (req, res) => {
  return res.json({
    success: true,
    data: req.admin,
  });
});

/* =========================
   FORGOT PASSWORD
========================= */
router.post(
  "/forgot-password",
  body("email").isEmail().withMessage("Valid email is required"),
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const cleanEmail = email.toLowerCase().trim();

      const admin = await Admin.findOne({ email: cleanEmail });

      // 🔐 security-friendly response
      if (!admin) {
        return res.json({
          success: true,
          message: "If the email exists, a reset link has been generated",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");

      admin.resetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      admin.resetTokenExpire = Date.now() + 15 * 60 * 1000;

      await admin.save();

      console.log(`🔐 Admin Reset Link: /reset-password/${resetToken}`);

      return res.json({
        success: true,
        message: "If the email exists, a reset link has been generated",
      });
    } catch (err) {
      console.error("Forgot password error:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to generate reset link",
      });
    }
  }
);

/* =========================
   RESET PASSWORD
========================= */
router.post(
  "/reset-password/:token",
  ...passwordValidation,
  validate,
  async (req, res) => {
    try {
      const hashedToken = crypto
        .createHash("sha256")
        .update(req.params.token)
        .digest("hex");

      const admin = await Admin.findOne({
        resetToken: hashedToken,
        resetTokenExpire: { $gt: Date.now() },
      });

      if (!admin) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      admin.password = req.body.password;
      admin.resetToken = undefined;
      admin.resetTokenExpire = undefined;
      admin.passwordChangedAt = new Date();

      await admin.save();

      return res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (err) {
      console.error("Reset password error:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message || "Password reset failed",
      });
    }
  }
);

module.exports = router;