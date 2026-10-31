const { Router } = require("express");
const verifyJWTModule = require("../../middlewares/verifyJWT");
const checkRoleModule = require("../../middlewares/checkRole");
const notificacionesController = require("./notificaciones.controller");

// Compatibilidad de exportación (función directa o propiedad con nombre).
const verifyJWT =
  typeof verifyJWTModule === "function"
    ? verifyJWTModule
    : verifyJWTModule.verifyJWT;
const checkRole =
  typeof checkRoleModule === "function"
    ? checkRoleModule
    : checkRoleModule.checkRole;

const router = Router();

// Todas las rutas requieren un token de sesión válido.
router.use(verifyJWT);

/**
 * Catálogo de usuarios para el selector "destinatario específico".
 * Acceso: cualquier usuario autenticado.
 */
router.get("/usuarios", notificacionesController.obtenerUsuariosDestino);

/**
 * 1. OBTENER COMUNICADOS Y NOTIFICACIONES
 * Acceso: ADMINISTRADOR, GARITA, CONDOMINO/RESIDENTE
 * El servicio filtra por rol, casa y destinatario.
 */
router.get("/", notificacionesController.obtenerComunicados);

/**
 * 2. CREAR COMUNICADO MULTICANAL (APP, EMAIL, WHATSAPP)
 * Acceso: exclusivo ADMINISTRADOR (se acepta el alias ADMIN).
 */
router.post(
  "/",
  checkRole(["ADMINISTRADOR", "ADMIN"]),
  notificacionesController.crearComunicado
);

/**
 * 3. DESACTIVAR O INACTIVAR COMUNICADO
 * Acceso: exclusivo ADMINISTRADOR (se acepta el alias ADMIN).
 */
router.patch(
  "/:idComunicado/desactivar",
  checkRole(["ADMINISTRADOR", "ADMIN"]),
  notificacionesController.desactivarComunicado
);

module.exports = router;
