const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Referral = require("../models/Referral");
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

    const cleanEmail = email.toLowerCase().trim();
    const cleanReferralCode = referralCode
      ? referralCode.toUpperCase().trim()
      : null;

    const existingUser = await User.findOne({
      email: cleanEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      isEmailVerified: true,
    });

    /* =========================
       CREATE WALLET
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
       REFERRAL LOGIC
    ========================= */
    if (cleanReferralCode) {
      const refUser = await User.findOne({
        referralCode: cleanReferralCode,
      });

      if (
        refUser &&
        refUser._id.toString() !== user._id.toString()
      ) {
        user.referredBy = cleanReferralCode;

        refUser.referralCount = (refUser.referralCount || 0) + 1;

        // Referral wallet reward
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
          },
          { new: true }
        );

        // Referral record create
        await Referral.create({
          referrer: refUser._id,
          referredUser: user._id,
          referralCode: cleanReferralCode,
          rewardGiven: true,
          rewardAmount: 10,
          status: "completed",
        });

        refUser.hasGivenReferralReward = true;
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
   LOGIN USER
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

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: cleanEmail,
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

    user.lastLoginIP = req.ip || null;
    user.lastDevice = req.headers["user-agent"] || null;
    await user.save();

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