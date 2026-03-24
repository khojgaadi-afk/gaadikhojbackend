const Admin = require("../models/Admin");

// Create Admin (Superadmin only)
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await Admin.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Admin already exists" });

    const admin = await Admin.create({
      name,
      email,
      password,
      role,
    });

    res.status(201).json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get All Admins
exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select("-password");
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Toggle Status
exports.toggleAdminStatus = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin)
      return res.status(404).json({ message: "Admin not found" });

    admin.status =
      admin.status === "active" ? "blocked" : "active";

    await admin.save();

    res.json({ status: admin.status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
