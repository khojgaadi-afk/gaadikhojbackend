const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

/* ✅ CORRECT IMPORT */
const validate = require("../middleware/validateMiddleware");

const {
  registerUser,
  loginUser,
} = require("../controllers/userAuthController");

const registerValidation = [
  body("name").trim().isLength({ min: 2 }),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
];

const loginValidation = [
  body("email").isEmail(),
  body("password").notEmpty(),
];

/* LOGIN */
router.post(
  "/login",
  ...loginValidation,   // 🔥 better
  validate,
  loginUser
);

/* REGISTER */
router.post(
  "/register",
  ...registerValidation,
  validate,
  registerUser
);

module.exports = router;