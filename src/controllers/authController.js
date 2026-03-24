const Admin = require("../models/Admin");
const AdminSession = require("../models/AdminSession");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

// 🔐 Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ===============================
// REGISTER ADMIN
// ===============================
exports.registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const admin = await Admin.create({
      name,
      email,
      password,
      role: role || "moderator",
    });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id),
    });
  } catch (err) {
    next(err); // ✅ FIX
  }
};

// ===============================
// LOGIN ADMIN
// ===============================
exports.loginAdmin = async (req, res, next) => {
  try {
    // ✅ VALIDATION HANDLE
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (admin.status === "blocked") {
      return res.status(403).json({ message: "Admin is blocked" });
    }

    // 🔥 CREATE SESSION
    await AdminSession.create({
      adminId: admin._id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      _id: admin._id,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id),
    });
  } catch (err) {
    next(err); // ✅ FIX (IMPORTANT)
  }
};
