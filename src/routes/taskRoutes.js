const express = require("express");
const router = express.Router();

const { protectUser } = require("../middleware/authMiddleware");
const { getAvailableTasks } = require("../controllers/taskController");

router.get("/available", protectUser, getAvailableTasks);

module.exports = router;