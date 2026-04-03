const express = require("express");
const userController = require("../controllers/userController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/profile", authenticate, userController.getProfile);
router.get("/admin-only", authenticate, authorizeRoles("admin"), userController.getAdminOnlyResource);

module.exports = router;
