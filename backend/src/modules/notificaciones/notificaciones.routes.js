const express = require("express");
const router = express.Router();
const notificacionesController = require("./notificaciones.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

// Extraer verifyToken o authMiddleware según cómo esté exportado
const verifyToken = authMiddleware.verifyToken || authMiddleware.authenticate || authMiddleware;

// Middleware de verificación de rol flexible para evitar fallos por funciones no exportadas
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Usuario no autenticado." });
  }

  const rolUpper = String(req.user.rol || req.user.role || "").toUpperCase().trim();
  const rolesPermitidos = ["ADMIN", "ADMINISTRADOR", "ADMINISTRADOR SISTEMA", "ADMINISTRACION"];

  if (rolesPermitidos.some(r => rolUpper.includes(r))) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "No tienes permiso para acceder a este recurso.",
  });
};

// GET /api/notificaciones - Obtener comunicados (Todos los usuarios autenticados)
router.get("/", verifyToken, notificacionesController.obtenerComunicados);

// POST /api/notificaciones - Publicar comunicado (Solo administradores)
router.post("/", verifyToken, requireAdmin, notificacionesController.crearComunicado);

// PUT /api/notificaciones/:id/desactivar - Inactivar comunicado
router.put("/:id/desactivar", verifyToken, requireAdmin, notificacionesController.desactivarComunicado);

module.exports = router;