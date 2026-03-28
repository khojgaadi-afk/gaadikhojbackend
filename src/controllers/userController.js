const mongoose = require("mongoose");
const User = require("../models/User");
const Submission = require("../models/Submission");
const Wallet = require("../models/Wallet");
const Reward = require("../models/Reward");

/* ============================
   GET ALL USERS
============================ */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();

    const submissionCounts = await Submission.aggregate([
      {
        $group: {
          _id: "$user",
          count: { $sum: 1 },
        },
      },
    ]);

    const walletBalances = await Wallet.aggregate([
      {
        $group: {
          _id: "$user",
          balance: { $sum: "$balance" },
        },
      },
    ]);

    const submissionMap = {};
    submissionCounts.forEach((s) => {
      if (s._id) submissionMap[s._id.toString()] = s.count;
    });

    const walletMap = {};
    walletBalances.forEach((w) => {
      if (w._id) walletMap[w._id.toString()] = w.balance;
    });

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

    user.status = user.status === "active" ? "blocked" : "active";
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
      user: req.params.id,
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
      email: email.toLowerCase().trim(),
    }).select("+resetOTP +otpExpire");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Use model method
    user.setOTP(otp);
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
      email: email.toLowerCase().trim(),
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

    const isValidOTP = user.verifyOTP(otp);

    if (!isValidOTP) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // IMPORTANT: plain password set करो, model pre-save hash karega
    user.password = password;
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

/* =========================
   UPDATE PROFILE
========================= */
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Optional: email duplicate check
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({
          message: "Email already in use",
        });
      }
    }

    user.name = name || user.name;
    user.email = email || user.email;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Update profile error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
};