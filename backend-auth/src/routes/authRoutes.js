const express = require("express");
const authController = require("../controllers/authController");
const {
  validateRegisterInput,
  validateLoginInput,
  validateResetPasswordInput,
} = require("../middleware/validate");

const router = express.Router();

router.post("/register", validateRegisterInput, authController.register);
router.post("/login", validateLoginInput, authController.login);
router.post("/reset-password", validateResetPasswordInput, authController.resetPassword);

module.exports = router;
