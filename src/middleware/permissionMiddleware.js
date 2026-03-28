const permissions = require("../config/permissions");

const authorize = (requiredPermission) => {
  return (req, res, next) => {
    const admin = req.admin;

    if (!admin || !admin.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    /* =========================
       1) CUSTOM ADMIN PERMISSIONS
       If present, use DB-based permission object
    ========================= */
    if (admin.permissions && typeof admin.permissions === "object") {
      const [moduleName] = requiredPermission.split(".");

      // Example:
      // requiredPermission = "admins.manage"
      // moduleName = "admins"
      if (moduleName && admin.permissions[moduleName] === true) {
        return next();
      }

      return res.status(403).json({ message: "Permission denied" });
    }

    /* =========================
       2) ROLE-BASED FALLBACK
    ========================= */
    const rolePermissions = permissions[admin.role] || [];

    if (!rolePermissions.includes(requiredPermission)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    next();
  };
};

module.exports = { authorize };