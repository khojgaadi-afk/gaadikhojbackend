const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();

/* =========================
   BASIC HARDENING
========================= */
app.disable("x-powered-by");
app.set("trust proxy", true);

/* =========================
   REQUEST ID
========================= */
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

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
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));

  app.use((req, res, next) => {
    console.log(`➡️ [${req.requestId}] ${req.method} ${req.originalUrl}`);
    next();
  });
} else {
  app.use(morgan("combined"));
}

/* =========================
   RATE LIMIT
========================= */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
});

const readLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many read requests. Please try again later.",
  },
});

const actionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests for this action. Please try again later.",
  },
});

app.use("/api", apiLimiter);

/* =========================
   CORS
========================= */
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8081",
  "exp://127.0.0.1:8081",
  "exp://192.168.0.100:8081",
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =========================
   BODY
========================= */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* =========================
   INVALID JSON HANDLER
========================= */
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }
  next(err);
});

/* =========================
   STATIC
========================= */
app.use(
  "/uploads/public",
  express.static(path.join(__dirname, "../uploads/public"))
);

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
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    environment: process.env.NODE_ENV || "development",
  });
});

/* =========================
   AUTH
========================= */
app.use("/api/admin/auth", authLimiter, authRoutes);
app.use("/api/users/auth", authLimiter, userAuthRoutes);

/* =========================
   CORE
========================= */
app.use("/api/posts", postRoutes);
app.use("/api/submissions", readLimiter, submissionRoutes);
app.use("/api/wallet", readLimiter, walletRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", readLimiter, userRoutes);
app.use("/api/withdrawals", actionLimiter, withdrawalRoutes);
app.use("/api/admins", adminRoutes);

/* =========================
   EXTRA
========================= */
app.use("/api/audit", auditRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/lost-vehicles", lostVehicleRoutes);
app.use("/api/referrals", readLimiter, referralRoutes);
app.use("/api/earn", actionLimiter, earnRoutes);
app.use("/api/tasks", readLimiter, taskRoutes);

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
  console.error(`🔥 [${req.requestId}] FULL ERROR STACK:\n`, err);

  let statusCode = err.status || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value entered";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  if (err.message === "Not allowed by CORS") {
    statusCode = 403;
    message = "CORS blocked this request";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

module.exports = app;