const express = require("express");
const router = express.Router();
const usuariosController = require("./usuarios.controller");
const { verifyToken, requireRole } = require("../../middlewares/auth.middleware");

// Toda la gestión de usuarios y roles es exclusiva del ADMINISTRADOR
router.use(verifyToken);
router.use(requireRole("ADMINISTRADOR"));

router.get("/", usuariosController.getUsuarios);
router.get("/roles", usuariosController.getRoles);
router.post("/", usuariosController.createUsuario);
router.put("/:id/estado", usuariosController.updateEstado);
router.put("/:id/rol", usuariosController.updateRol);

module.exports = router;