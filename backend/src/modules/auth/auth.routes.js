const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");

// Rutas Públicas
router.post("/login", authController.login);
router.post("/logout", authController.logout);

// Rutas Protegidas por JWT
router.get("/me", verifyToken, authController.getMe);

module.exports = router;