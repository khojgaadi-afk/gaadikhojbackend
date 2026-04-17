const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use valid email"],
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
    },

    /* ROLE SYSTEM */
    role: {
      type: String,
      enum: ["user", "admin", "superadmin", "finance"],
      default: "user",
    },

    /* ACCOUNT STATUS */
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    /* TRUST SYSTEM */
    trustScore: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },

    approvedSubmissions: {
      type: Number,
      default: 0,
      min: 0,
    },

    rejectedSubmissions: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* FRAUD DETECTION */
    suspiciousCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isSuspicious: {
      type: Boolean,
      default: false,
    },

    /* ==========================
       WITHDRAWAL SECURITY
    ========================== */

    phone: {
      type: String,
      default: null,
    },

    isPhoneAdded: {
      type: Boolean,
      default: false,
    },

    withdrawalPin: {
      type: String,
      select: false,
    },

    pinAttempts: {
      type: Number,
      default: 0,
    },

    pinLockUntil: {
      type: Date,
      default: null,
    },

    /* LOGIN SECURITY */
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    /* DEVICE TRACKING */
    lastLoginIP: {
      type: String,
      default: null,
    },

    lastDevice: {
      type: String,
      default: null,
    },

    /* NOTIFICATIONS */
    pushToken: {
      type: String,
      default: null,
    },

    /* EMAIL VERIFICATION */
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    /* EMAIL OTP */
    emailOTP: {
      type: String,
      default: null,
      select: false,
    },

    emailOTPExpire: {
      type: Date,
      default: null,
      select: false,
    },

    /* RESET PASSWORD */
    resetOTP: {
      type: String,
      default: null,
      select: false,
    },

    otpExpire: {
      type: Date,
      default: null,
    },

    /* REFERRAL SYSTEM */
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    referredBy: {
      type: String,
      default: null,
    },

    hasGivenReferralReward: {
      type: Boolean,
      default: false,
    },

    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* DAILY ADS */
    adsWatchedToday: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastAdDate: {
      type: Date,
      default: null,
    },

    /* STREAK SYSTEM */
    streakCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastActiveDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ==========================
   HASH PASSWORD
========================== */
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now() - 1000;
  }

  next();
});

/* ==========================
   HASH WITHDRAWAL PIN
========================== */
userSchema.pre("save", async function (next) {
  if (!this.isModified("withdrawalPin")) return next();

  const salt = await bcrypt.genSalt(10);
  this.withdrawalPin = await bcrypt.hash(this.withdrawalPin, salt);

  next();
});

/* ==========================
   MATCH PASSWORD
========================== */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/* ==========================
   MATCH PIN
========================== */
userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.withdrawalPin);
};

/* ==========================
   HANDLE PIN ATTEMPTS
========================== */
userSchema.methods.handlePinAttempt = async function (isMatch) {
  if (this.pinLockUntil && this.pinLockUntil > Date.now()) {
    return { success: false, message: "Too many attempts. Try after 30 mins" };
  }

  if (isMatch) {
    this.pinAttempts = 0;
    this.pinLockUntil = null;
    await this.save();
    return { success: true };
  }

  this.pinAttempts += 1;

  if (this.pinAttempts >= 3) {
    this.pinLockUntil = Date.now() + 30 * 60 * 1000;
  }

  await this.save();

  return { success: false, message: "Invalid PIN" };
};

/* ==========================
   GENERATE REFERRAL CODE
========================== */
userSchema.pre("save", async function (next) {
  if (this.referralCode) return next();

  let code;
  let exists = true;

  while (exists) {
    const namePart = this.name
      .substring(0, Math.min(4, this.name.length))
      .toUpperCase();

    code = namePart + Math.floor(1000 + Math.random() * 9000);

    const user = await mongoose.models.User.findOne({ referralCode: code });

    if (!user) exists = false;
  }

  this.referralCode = code;
  next();
});

/* ==========================
   LOGIN HANDLER
========================== */
userSchema.methods.handleLogin = async function (isMatch) {
  if (this.lockUntil && this.lockUntil > Date.now()) {
    return { success: false, message: "Account locked. Try later." };
  }

  if (isMatch) {
    this.loginAttempts = 0;
    this.lockUntil = null;
    await this.save();
    return { success: true };
  }

  this.loginAttempts += 1;

  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000;
  }

  await this.save();

  return { success: false, message: "Invalid credentials" };
};

/* ==========================
   ACCOUNT LOCK CHECK
========================== */
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model("User", userSchema);