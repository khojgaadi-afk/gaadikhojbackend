const permissions = require("../config/permissions");

const authorize = (requiredPermission) => {
  return (req, res, next) => {
    const role = req.admin?.role;

    if (!role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rolePermissions = permissions[role] || [];

    if (!rolePermissions.includes(requiredPermission)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    next();
  };
};

module.exports = { authorize }; // ✅ correct