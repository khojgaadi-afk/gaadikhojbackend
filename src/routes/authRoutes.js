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

const { protectAdmin } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/permissionMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");

/* =========================
   VALIDATION
========================= */
const loginValidation = [
  body("email").isEmail(),
  body("password").notEmpty(),
];

const passwordValidation = [
  body("password").isLength({ min: 6 }),
];

/* =========================
   REGISTER (Superadmin only)
========================= */
router.post(
  "/register",
  protectAdmin,
  authorizeRoles("superadmin"),
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
    await AdminSession.findOneAndUpdate(
      { adminId: req.admin._id, isActive: true },
      {
        logoutTime: Date.now(),
        isActive: false,
      }
    );

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

      res.json(sessions);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

/* =========================
   CURRENT ADMIN
========================= */
router.get("/me", protectAdmin, (req, res) => {
  res.json(req.admin);
});

/* =========================
   FORGOT PASSWORD
========================= */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const cleanEmail = email.toLowerCase().trim();

    const admin = await Admin.findOne({ email: cleanEmail });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    admin.resetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    admin.resetTokenExpire = Date.now() + 15 * 60 * 1000;

    await admin.save();

    console.log(`Reset: /reset-password/${resetToken}`);

    res.json({
      message: "Reset link generated",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
          message: "Invalid or expired token",
        });
      }

      admin.password = req.body.password;
      admin.resetToken = undefined;
      admin.resetTokenExpire = undefined;

      await admin.save();

      res.json({ message: "Password reset successful" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;