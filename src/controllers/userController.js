const User = require("../models/User");
const Submission = require("../models/Submission");
const Wallet = require("../models/Wallet");
const Reward = require("../models/Reward");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/* ============================
   GET ALL USERS
============================ */

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .lean();

    /* submission count */
    const submissionCounts = await Submission.aggregate([
      {
        $group: {
          _id: "$user", // ✅ FIXED
          count: { $sum: 1 },
        },
      },
    ]);

    /* wallet balance */
    const walletBalances = await Wallet.aggregate([
      {
        $group: {
          _id: "$user", // ✅ FIXED
          balance: { $sum: "$balance" },
        },
      },
    ]);

    /* maps */
    const submissionMap = {};
    submissionCounts.forEach((s) => {
      submissionMap[s._id?.toString()] = s.count;
    });

    const walletMap = {};
    walletBalances.forEach((w) => {
      walletMap[w._id?.toString()] = w.balance;
    });

    /* merge */
    const enrichedUsers = users.map((u) => ({
      ...u,
      submissions: submissionMap[u._id.toString()] || 0,
      balance: walletMap[u._id.toString()] || 0,
    }));

    res.json(enrichedUsers);

  } catch (err) {
    console.error("❌ Get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================
   TOGGLE USER STATUS
============================ */

exports.toggleUserStatus = async (req, res) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status =
      user.status === "active"
        ? "blocked"
        : "active";

    await user.save();

    res.json({
      message: "User status updated",
      status: user.status,
    });

  } catch (err) {
    console.error("❌ Toggle status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================
   GET USER TRANSACTIONS
============================ */

exports.getUserTransactions = async (req, res) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const transactions = await Reward.find({
      user: req.params.id, // ✅ FIXED
    }).sort({ createdAt: -1 });

    res.json(transactions);

  } catch (err) {
    console.error("❌ Transaction error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================
   SUSPICIOUS USERS
============================ */

exports.getSuspiciousUsers = async (req, res) => {
  try {
    const users = await User.find({
      isSuspicious: true,
    }).select("-password");

    res.json(users);

  } catch (err) {
    console.error("❌ Suspicious users error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================
   FORGOT PASSWORD (SEND OTP)
============================ */

exports.forgotPassword = async (req, res) => {
  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(), // ✅ FIXED
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /* OTP generate */
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    /* store hashed OTP */
    user.resetOTP = await bcrypt.hash(otp, 10);
    user.otpExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    console.log("🔐 OTP (dev only):", otp);

    res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* ============================
   RESET PASSWORD
============================ */

exports.resetPassword = async (req, res) => {
  try {

    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password +resetOTP +otpExpire");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.resetOTP || !user.otpExpire) {
      return res.status(400).json({
        message: "OTP not requested",
      });
    }

    if (user.otpExpire < Date.now()) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOTP);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    /* update password */
    user.password = await bcrypt.hash(password, 10);

    user.resetOTP = null;
    user.otpExpire = null;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });

  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* ============================
   LEADERBOARD
============================ */

exports.getLeaderboard = async (req, res) => {
  try {

    const users = await User.find()
      .select("name approvedSubmissions trustScore")
      .sort({
        approvedSubmissions: -1,
        trustScore: -1,
      })
      .limit(10);

    res.json(users);

  } catch (err) {
    console.error("❌ Leaderboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
};