require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const paymentRoutes = require("./src/routes/paymentRoutes");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // ✅ Routes FIRST register karo
    app.use("/api/payments", paymentRoutes);

    // ✅ Phir server start karo
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();