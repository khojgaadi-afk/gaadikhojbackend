const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

exports.protectAdmin = async (req, res, next) => {
  try {
    let token;

    // 🔥 Proper header check
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "No admin token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 DB verify (IMPORTANT)
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({
        message: "Admin not found",
      });
    }

    req.admin = admin;

    next();

  } catch (err) {
    console.error("❌ Admin Auth Error:", err.message);

    res.status(401).json({
      message: "Not authorized as admin",
    });
  }
};