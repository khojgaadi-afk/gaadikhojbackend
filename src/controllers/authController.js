const Admin = require("../models/Admin");
const AdminSession = require("../models/AdminSession");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

/* =========================
   GENERATE TOKEN
========================= */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

/* =========================
   REGISTER ADMIN
========================= */
exports.registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const adminExists = await Admin.findOne({ email: cleanEmail });

    if (adminExists) {
      return res.status(400).json({
        message: "Admin already exists",
      });
    }

    const allowedRoles = ["superadmin", "moderator", "finance"];
    const safeRole = allowedRoles.includes(role) ? role : "moderator";

    const admin = await Admin.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: safeRole,
    });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id),
    });
  } catch (err) {
    next(err);
  }
};

/* =========================
   LOGIN ADMIN
========================= */
exports.loginAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const admin = await Admin.findOne({
      email: cleanEmail,
    }).select("+password");

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    if (admin.status === "blocked") {
      return res.status(403).json({
        message: "Admin is blocked",
      });
    }

    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    await AdminSession.create({
      adminId: admin._id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id),
    });
  } catch (err) {
    next(err);
  }
};