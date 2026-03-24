const express = require("express");
const router = express.Router();

const earnController = require("../controllers/earnController");
const { protectUser } = require("../middleware/authMiddleware");
console.log("watchAd type:", typeof earnController.watchAd); // 👈 debug

router.post("/watch-ad", protectUser, earnController.watchAd);
console.log("protectUser type:", typeof protectUser);
module.exports = router;