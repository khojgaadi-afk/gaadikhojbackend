const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

const app = express();

/* =========================
   TRUST PROXY
========================= */
app.set("trust proxy", 1);

/* =========================
   SECURITY
========================= */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

/* =========================
   PERFORMANCE
========================= */
app.use(compression());

/* =========================
   LOGGING
========================= */
app.use(morgan("dev"));

/* =========================
   DEBUG
========================= */
app.use((req, res, next) => {
  console.log("➡️", req.method, req.originalUrl);
  next();
});

/* =========================
   RATE LIMIT
========================= */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
});

app.use("/api", apiLimiter);

/* =========================
   CORS
========================= */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

/* =========================
   BODY PARSER
========================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =========================
   ROUTES IMPORT
========================= */
const authRoutes = require("./routes/authRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");
const postRoutes = require("./routes/postRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const walletRoutes = require("./routes/walletRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const userRoutes = require("./routes/userRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminRoutes = require("./routes/adminRoutes");
const auditRoutes = require("./routes/auditRoutes");
const lostVehicleRoutes = require("./routes/lostVehicleRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const referralRoutes = require("./routes/referralRoutes");
const earnRoutes = require("./routes/earnRoutes");
const taskRoutes = require("./routes/taskRoutes");

/* =========================
   ROOT / HEALTH
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running 🚀",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "🚀 Backend Running",
  });
});

/* =========================
   AUTH ROUTES
========================= */
app.use("/api/admin/auth", authLimiter, authRoutes);
app.use("/api/users/auth", authLimiter, userAuthRoutes);

/* =========================
   CORE ROUTES
========================= */
app.use("/api/posts", postRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admins", adminRoutes);

/* =========================
   EXTRA ROUTES
========================= */
app.use("/api/audit", auditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/lost-vehicles", lostVehicleRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/earn", earnRoutes);
app.use("/api/tasks", taskRoutes);

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("🔥 FULL ERROR STACK:\n", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

module.exports = app;