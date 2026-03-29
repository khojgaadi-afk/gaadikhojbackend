const permissions = require("../config/permissions");

const authorize = (requiredPermission) => {
  return (req, res, next) => {
    const admin = req.admin;

    if (!admin || !admin.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // =========================
    // SUPER ADMIN BYPASS
    // =========================
    if (
      admin.role === "superadmin" ||
      admin.role === "super_admin" ||
      admin.isSuperAdmin === true
    ) {
      return next();
    }

    // =========================
    // 1) CUSTOM ADMIN PERMISSIONS
    // Supports BOTH:
    // - Array format: ["submissions.verify", "users.view"]
    // - Object format: { submissions: true, users: true }
    // =========================

    if (admin.permissions) {
      // CASE A: permissions as ARRAY
      if (Array.isArray(admin.permissions)) {
        if (admin.permissions.includes(requiredPermission)) {
          return next();
        }

        return res.status(403).json({ message: "Permission denied" });
      }

      // CASE B: permissions as OBJECT
      if (
        typeof admin.permissions === "object" &&
        !Array.isArray(admin.permissions)
      ) {
        const [moduleName] = requiredPermission.split(".");

        if (moduleName && admin.permissions[moduleName] === true) {
          return next();
        }

        // Optional: exact permission support in object
        if (admin.permissions[requiredPermission] === true) {
          return next();
        }

        return res.status(403).json({ message: "Permission denied" });
      }
    }

    // =========================
    // 2) ROLE-BASED FALLBACK
    // =========================
    const rolePermissions = permissions[admin.role] || [];

    if (!rolePermissions.includes(requiredPermission)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    next();
  };
};

module.exports = { authorize };