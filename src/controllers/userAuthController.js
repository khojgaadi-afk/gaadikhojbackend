const User = require("../models/User");
const Wallet = require("../models/Wallet");
const jwt = require("jsonwebtoken");

/* =========================
   GENERATE TOKEN
========================= */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* =========================
   REGISTER USER
========================= */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, referralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      isEmailVerified: true,
    });

    /* =========================
       CREATE WALLET (SAFE)
    ========================= */
    await Wallet.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: {
          user: user._id,
          balance: 0,
          transactions: [],
        },
      },
      { upsert: true, new: true }
    );

    /* =========================
       REFERRAL LOGIC (IMPROVED)
    ========================= */
    if (referralCode) {
      const refUser = await User.findOne({ referralCode });

      if (refUser && refUser._id.toString() !== user._id.toString()) {
        user.referredBy = referralCode;

        refUser.referralCount = (refUser.referralCount || 0) + 1;

        // 🔥 referral reward (optional)
        await Wallet.findOneAndUpdate(
          { user: refUser._id },
          {
            $inc: { balance: 10 },
            $push: {
              transactions: {
                amount: 10,
                type: "credit",
                source: "referral",
                description: "Referral bonus",
              },
            },
          }
        );

        await refUser.save();
      }
    }

    await user.save();

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      referralCode: user.referralCode,
      token: generateToken(user._id),
    });

  } catch (err) {
    console.error("🔥 REGISTER ERROR:", err);
    next(err);
  }
};

/* =========================
   LOGIN USER (FINAL FIXED)
========================= */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    const isMatch = await user.matchPassword(password);

    const loginResult = await user.handleLogin(isMatch);

    if (!loginResult.success) {
      return res.status(401).json({
        success: false,
        message: loginResult.message,
      });
    }

    // ⚠️ NO SAVE (important)
    user.lastLoginIP = req.ip;
    user.lastDevice = req.headers["user-agent"];

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      referralCode: user.referralCode,
      token: generateToken(user._id),
    });

  } catch (err) {
    console.error("🔥 LOGIN ERROR:", err);
    next(err);
  }
};

module.exports = {
  registerUser,
  loginUser,
};