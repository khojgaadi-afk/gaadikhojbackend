// Load environment variables
require("dotenv").config();

// Import dependencies
const app = require("./src/app");
const connectDB = require("./src/config/db");

// ✅ FIXED PATH
const earnRoutes = require("./src/routes/earnRoutes");
const referralRoutes = require("./src/routes/referralRoutes");

// Routes
app.use("/api/referral", referralRoutes);
app.use("/api/earn", earnRoutes);

// PORT
const PORT = process.env.PORT || 5000;

// DB
connectDB();

// Server start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on port ${PORT}`);
});