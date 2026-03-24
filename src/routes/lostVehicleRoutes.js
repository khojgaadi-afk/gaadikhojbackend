const express = require("express");
const router = express.Router();

const upload = require("../utils/upload");

const {
createLostVehicle,
getLostVehicles,
getPendingLostVehicles,
verifyLostVehicle
} = require("../controllers/lostVehicleController");

const { protectAdmin } = require("../middleware/authMiddleware");
const { protectUser } = require("../middleware/authMiddleware");


/* USER CREATE REPORT */

router.post(
"/",
protectUser,
upload.fields([
{ name:"photos", maxCount:5 },
{ name:"rc", maxCount:1 },
{ name:"fir", maxCount:1 },
{ name:"aadhar", maxCount:1 }
]),
createLostVehicle
);


/* PUBLIC TASKS */

router.get("/",getLostVehicles);


/* ADMIN PENDING */

router.get(
"/pending",
protectAdmin,
getPendingLostVehicles
);


/* ADMIN VERIFY */

router.put(
"/:id/verify",
protectAdmin,
verifyLostVehicle
);

module.exports = router;