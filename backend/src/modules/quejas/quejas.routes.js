const { Router } = require("express");
const verifyJWTModule = require("../../middlewares/verifyJWT");
const quejasController = require("./quejas.controller");

const verifyJWT =
  typeof verifyJWTModule === "function"
    ? verifyJWTModule
    : verifyJWTModule.verifyJWT;

const router = Router();

// Todas las rutas requieren una sesión válida.
router.use(verifyJWT);

/**
 * Catálogo de usuarios para el selector "destinatario específico".
 * Debe declararse antes de cualquier ruta con parámetros dinámicos.
 */
router.get("/usuarios", quejasController.obtenerUsuariosDestino);

// Consulta: el servicio decide qué ve cada rol.
router.get("/", quejasController.listarQuejas);

// Creación: cualquier usuario autenticado, sin restricción de rol.
router.post("/", quejasController.crearQueja);

module.exports = router;
