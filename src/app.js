const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");

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
app.use(morgan("dev")); // 👈 simple logs

/* =========================
   DEBUG (VERY IMPORTANT)
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
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
   BODY
========================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =========================
   STATIC
========================= */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);

/* =========================
   ROUTES
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

/* AUTH */
app.use("/api/admin/auth", authLimiter, authRoutes);
app.use("/api/users/auth", authLimiter, userAuthRoutes);

/* CORE */
app.use("/api/posts", postRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admins", adminRoutes);

/* EXTRA */
app.use("/api/audit", auditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/lost-vehicles", lostVehicleRoutes);
app.use("/api/referral", referralRoutes);

/* =========================
   HEALTH
========================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "🚀 Backend Running",
  });
});

/* =========================
   🔥 ERROR HANDLER (FIRST)
========================= */
app.use((err, req, res, next) => {
  console.error("🔥 FULL ERROR STACK:\n", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    stack: err.stack, // 👈 अब exact line दिखेगी
  });
});

/* =========================
   404 (LAST)
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;