const express = require("express");
const router = express.Router();

const earnController = require("../controllers/earnController");
const { protectUser } = require("../middleware/authMiddleware");

/* =========================
   GET EGG / AD STATUS
========================= */
router.get("/status", protectUser, earnController.getAdStatus);

/* =========================
   WATCH AD
========================= */
router.post("/watch-ad", protectUser, earnController.watchAd);

module.exports = router;