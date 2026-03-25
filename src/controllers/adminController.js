const mongoose = require("mongoose");
const Admin = require("../models/Admin");

/* =========================
   CREATE ADMIN
========================= */
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const exists = await Admin.findOne({ email: cleanEmail });

    if (exists) {
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
      status: admin.status,
      createdAt: admin.createdAt,
    });
  } catch (err) {
    console.error("❌ Create admin error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET ALL ADMINS
========================= */
exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find()
      .select("-password -resetToken")
      .sort({ createdAt: -1 });

    res.json(admins);
  } catch (err) {
    console.error("❌ Get admins error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   TOGGLE ADMIN STATUS
========================= */
exports.toggleAdminStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Invalid admin ID",
      });
    }

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    // Prevent self block
    if (req.admin && admin._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({
        message: "You cannot block yourself",
      });
    }

    admin.status = admin.status === "active" ? "blocked" : "active";

    await admin.save();

    res.json({
      message: "Admin status updated",
      status: admin.status,
    });
  } catch (err) {
    console.error("❌ Toggle admin error:", err);
    res.status(500).json({ message: err.message });
  }
};