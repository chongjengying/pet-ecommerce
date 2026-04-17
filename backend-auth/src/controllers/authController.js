const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.register({ email, password });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: result
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result
    });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { email, current_password, new_password } = req.body;
    const result = await authService.resetPassword({
      email,
      currentPassword: current_password,
      newPassword: new_password,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successful.",
      data: result
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  resetPassword
};
