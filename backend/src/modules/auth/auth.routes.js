const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");

// Rutas Públicas
router.post("/login", authController.login);
router.post("/registro", authController.registro);
router.post("/verificar-email", authController.verifyEmail);
router.post("/reenviar-codigo", authController.resendCode);
router.post("/olvide-contrasena", authController.forgotPassword);
router.post("/restablecer-contrasena", authController.resetPassword);
router.post("/logout", authController.logout);

// Rutas Protegidas por JWT
router.get("/me", verifyToken, authController.getMe);

module.exports = router;