const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Admin = require("../models/Admin");

/* =========================
   VERIFY TOKEN HELPER
========================= */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/* =========================
   EXTRACT TOKEN
========================= */
const getTokenFromHeader = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
};

/* =========================
   PROTECT USER
========================= */
const protectUser = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    /* ACCOUNT STATUS */
    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    /* 🔥 TOKEN INVALIDATION (IMPORTANT) */
    if (
      user.passwordChangedAt &&
      decoded.iat * 1000 < user.passwordChangedAt.getTime()
    ) {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again",
      });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/* =========================
   PROTECT ADMIN
========================= */
const protectAdmin = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const decoded = verifyToken(token);

    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({
        message: "Admin not found",
      });
    }

    if (admin.status === "blocked") {
      return res.status(403).json({
        message: "Admin is blocked",
      });
    }

    /* SAME TOKEN INVALIDATION */
    if (
      admin.passwordChangedAt &&
      decoded.iat * 1000 < admin.passwordChangedAt.getTime()
    ) {
      return res.status(401).json({
        message: "Token expired. Login again",
      });
    }

    req.admin = admin;
    next();

  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

module.exports = {
  protectUser,
  protectAdmin,
};