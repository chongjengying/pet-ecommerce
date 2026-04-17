const bcrypt = require("bcrypt");
const env = require("../config/env");
const userService = require("../services/userService");

function getProfile(req, res) {
  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully.",
    data: {
      user: req.user
    }
  });
}

async function listUsers(_req, res, next) {
  try {
    const users = await userService.listUsers();
    return res.status(200).json({
      success: true,
      message: "Users fetched successfully.",
      data: users
    });
  } catch (err) {
    return next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, password, account_status = "active", roles = ["customer"] } = req.body || {};
    const passwordHash = await bcrypt.hash(String(password), env.auth.bcryptRounds);
    const user = await userService.createUser({
      email,
      passwordHash,
      accountStatus: account_status,
      roles
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: user
    });
  } catch (err) {
    return next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { email, password } = req.body || {};

    const passwordHash =
      typeof password === "string" && password.length > 0
        ? await bcrypt.hash(password, env.auth.bcryptRounds)
        : null;

    const user = await userService.updateUserBasic(id, { email, passwordHash });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: user
    });
  } catch (err) {
    return next(err);
  }
}

async function setUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { account_status } = req.body || {};
    const user = await userService.setAccountStatus(id, account_status);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Account status updated successfully.",
      data: user
    });
  } catch (err) {
    return next(err);
  }
}

async function assignUserRoles(req, res, next) {
  try {
    const { id } = req.params;
    const { roles } = req.body || {};
    const user = await userService.assignRoles(id, roles);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Roles assigned successfully.",
      data: user
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await userService.softDeleteUser(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.status(200).json({
      success: true,
      message: "User soft-deleted successfully.",
      data: user
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getProfile,
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
  assignUserRoles,
  deleteUser
};
