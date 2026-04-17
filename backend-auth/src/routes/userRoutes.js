const express = require("express");
const userController = require("../controllers/userController");
const { authenticate, requireAdmin } = require("../middleware/authMiddleware");
const { validateCreateUserInput } = require("../middleware/validate");

const router = express.Router();

router.get("/profile", authenticate, userController.getProfile);

router.get("/", authenticate, requireAdmin, userController.listUsers);
router.post("/", authenticate, requireAdmin, validateCreateUserInput, userController.createUser);
router.patch("/:id", authenticate, requireAdmin, userController.updateUser);
router.patch("/:id/status", authenticate, requireAdmin, userController.setUserStatus);
router.patch("/:id/roles", authenticate, requireAdmin, userController.assignUserRoles);
router.delete("/:id", authenticate, requireAdmin, userController.deleteUser);

module.exports = router;
