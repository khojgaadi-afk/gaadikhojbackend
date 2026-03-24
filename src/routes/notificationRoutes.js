const express = require("express");
const router = express.Router();

const { getNotifications } = require("../controllers/notificationController");

const { protectUser } = require("../middleware/authMiddleware");

router.get("/",protectUser,getNotifications);

module.exports = router;