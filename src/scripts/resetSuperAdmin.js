const dotenv = require("dotenv");
const Admin = require("../src/models/Admin");
const connectDB = require("../src/config/db");

dotenv.config();

/* =========================
   RESET SUPERADMIN PASSWORD
========================= */
const resetSuperAdmin = async () => {
  try {
    await connectDB();

    const email = process.env.SUPERADMIN_EMAIL;
    const newPassword = process.env.SUPERADMIN_PASSWORD;

    if (!email || !newPassword) {
      console.log("❌ SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD missing in .env");
      process.exit(1);
    }

    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!admin) {
      console.log("❌ Superadmin not found with this email");
      process.exit(1);
    }

    // IMPORTANT: pre('save') hook hash kar dega
    admin.password = newPassword;
    admin.resetToken = undefined;
    admin.resetTokenExpire = undefined;

    await admin.save();

    console.log("✅ Superadmin password updated successfully");
    console.log("📧 Email:", admin.email);

    process.exit();
  } catch (err) {
    console.error("❌ Error resetting superadmin:", err.message);
    process.exit(1);
  }
};

resetSuperAdmin();