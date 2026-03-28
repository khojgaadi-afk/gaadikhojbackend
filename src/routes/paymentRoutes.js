const express = require("express");
const router = express.Router();

const { protectUser } = require("../middleware/authMiddleware");

const {
  createLostVehiclePayment,
  verifyLostVehiclePayment,
} = require("../controllers/paymentController");

router.post(
  "/lost-vehicle/create-order",
  protectUser,
  createLostVehiclePayment
);

router.get(
  "/lost-vehicle/verify/:orderId",
  protectUser,
  verifyLostVehiclePayment
);

module.exports = router;