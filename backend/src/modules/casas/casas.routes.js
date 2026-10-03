const express = require("express");
const router = express.Router();
const casasController = require("./casas.controller");
const { verifyToken, requireRole } = require("../../middlewares/auth.middleware");

// Todas las rutas requieren sesión activa
router.use(verifyToken);

// Catálogo de Personas para dropdowns de propietarios y residentes
// Accesible en: GET /api/casas/personas
router.get("/personas", requireRole("ADMINISTRADOR"), casasController.getPersonas);
router.post("/personas", requireRole("ADMINISTRADOR"), casasController.createPersona);

// Consultas (Administrador, Garita o Condómino para autogestión)
router.get("/", requireRole("ADMINISTRADOR", "GARITA", "CONDOMINO"), casasController.getCasas);
router.get("/:id", requireRole("ADMINISTRADOR", "GARITA", "CONDOMINO"), casasController.getCasa);

// Modificaciones exclusivas del Administrador
router.post("/", requireRole("ADMINISTRADOR"), casasController.createCasa);
router.put("/:id", requireRole("ADMINISTRADOR"), casasController.updateCasa);
router.post("/:id/residentes", requireRole("ADMINISTRADOR"), casasController.addResidente);

module.exports = router;