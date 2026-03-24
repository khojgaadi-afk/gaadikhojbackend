const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Admin = require("../models/Admin");
const connectDB = require("../config/db");

dotenv.config();

const createSuperAdmin = async () => {
  try {
    await connectDB();

    const exists = await Admin.findOne({
      email: "superadmin@test.com",
    });

    if (exists) {
      console.log("Superadmin already exists");
      process.exit();
    }

    const admin = await Admin.create({
      name: "Super Admin",
      email: "superadmin@test.com",
      password: "123456",
      role: "superadmin",
      status: "active",
    });

    console.log("Superadmin created:");
    console.log(admin.email);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createSuperAdmin();
