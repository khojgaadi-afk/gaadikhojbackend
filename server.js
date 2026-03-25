require("dotenv").config();

// Import dependencies
const app = require("./src/app");
const connectDB = require("./src/config/db");

// Routes
const earnRoutes = require("./src/routes/earnRoutes");
const referralRoutes = require("./src/routes/referralRoutes");
const withdrawalRoutes = require("./src/routes/withdrawalRoutes");

// Register Routes
app.use("/api/referral", referralRoutes);
app.use("/api/earn", earnRoutes);
app.use("/api/withdrawals", withdrawalRoutes);

// PORT
const PORT = process.env.PORT || 5000;

// DB connect
connectDB();

// Server start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});