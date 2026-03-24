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
    },

    rejectedSubmissions: {
      type: Number,
      default: 0,
    },

    /* FRAUD DETECTION */
    suspiciousCount: {
      type: Number,
      default: 0,
    },

    isSuspicious: {
      type: Boolean,
      default: false,
    },

    /* LOGIN SECURITY */
    loginAttempts: {
      type: Number,
      default: 0,
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

    /* RESET PASSWORD (SECURE) */
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
    },

    /* DAILY ADS */
    adsWatchedToday: {
      type: Number,
      default: 0,
    },

    lastAdDate: {
      type: Date,
      default: null,
    },

    /* STREAK SYSTEM */
    streakCount: {
      type: Number,
      default: 0,
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
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  this.passwordChangedAt = Date.now();
});

/* ==========================
   GENERATE REFERRAL CODE
========================== */
userSchema.pre("save", async function () {
  if (!this.referralCode) {
    let code;
    let exists = true;

    while (exists) {
      const namePart = this.name
        .substring(0, Math.min(4, this.name.length))
        .toUpperCase();

      code = namePart + Math.floor(1000 + Math.random() * 9000);

      const user = await mongoose.models.User.findOne({
        referralCode: code,
      });

      if (!user) exists = false;
    }

    this.referralCode = code;
  }
});

/* ==========================
   COMPARE PASSWORD
========================== */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/* ==========================
   LOGIN HANDLER (ANTI-BRUTEFORCE)
========================== */
userSchema.methods.handleLogin = async function (isMatch) {
  // Check if locked
  if (this.lockUntil && this.lockUntil > Date.now()) {
    return { success: false, message: "Account locked. Try later." };
  }

  if (isMatch) {
    this.loginAttempts = 0;
    this.lockUntil = null;
    await this.save();
    return { success: true };
  }

  // Wrong password
  this.loginAttempts += 1;

  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000; // 30 min lock
  }

  await this.save();

  return { success: false, message: "Invalid credentials" };
};

/* ==========================
   OTP GENERATION (SECURE)
========================== */
userSchema.methods.setOTP = function (otp) {
  this.resetOTP = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpire = Date.now() + 10 * 60 * 1000; // 10 min
};

/* ==========================
   VERIFY OTP
========================== */
userSchema.methods.verifyOTP = function (enteredOTP) {
  const hashed = crypto
    .createHash("sha256")
    .update(enteredOTP)
    .digest("hex");

  return this.resetOTP === hashed && this.otpExpire > Date.now();
};

/* ==========================
   ACCOUNT LOCK CHECK
========================== */
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model("User", userSchema);