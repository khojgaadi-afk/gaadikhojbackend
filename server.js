

// Import dependencies
const app = require("./src/app");
const connectDB = require("./src/config/db");

// Routes
const earnRoutes = require("./src/routes/earnRoutes");
const referralRoutes = require("./src/routes/referralRoutes");

app.use("/api/referral", referralRoutes);
app.use("/api/earn", earnRoutes);

// PORT
const PORT = process.env.PORT || 5000;

// DEBUG (IMPORTANT 🔥)
console.log("APP_ID:", process.env.APP_ID);
console.log("SECRET_KEY:", process.env.SECRET_KEY);

// DB
connectDB();

// Server start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on port ${PORT}`);
});