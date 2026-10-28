const { Router } = require("express");
const verifyJWTModule = require("../../middlewares/verifyJWT");
const checkRoleModule = require("../../middlewares/checkRole");
const notificacionesController = require("./notificaciones.controller");

// Compatibilidad de exportación (función directa o propiedad con nombre)
const verifyJWT = typeof verifyJWTModule === "function" ? verifyJWTModule : verifyJWTModule.verifyJWT;
const checkRole = typeof checkRoleModule === "function" ? checkRoleModule : checkRoleModule.checkRole;

const router = Router();

// Todas las rutas requieren un token de sesión válido
router.use(verifyJWT);

/**
 * 1. OBTENER COMUNICADOS Y NOTIFICACIONES
 * Acceso: ADMIN, GARITA, RESIDENTE (Se filtra por rol/casa en el servicio)
 */
router.get("/", notificacionesController.obtenerComunicados);

/**
 * 2. CREAR COMUNICADO MULTICANAL (APP, EMAIL, WHATSAPP)
 * Acceso: Exclusivo ADMIN
 */
router.post(
  "/",
  checkRole(["ADMIN"]),
  notificacionesController.crearComunicado
);

/**
 * 3. DESACTIVAR O INACTIVAR COMUNICADO
 * Acceso: Exclusivo ADMIN
 */
router.patch(
  "/:idComunicado/desactivar",
  checkRole(["ADMIN"]),
  notificacionesController.desactivarComunicado
);

module.exports = router;