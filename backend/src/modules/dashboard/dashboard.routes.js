/**
 * =============================================================================
 * RUTAS: DASHBOARD ESTRATÉGICO DEL ADMINISTRADOR
 * =============================================================================
 * Ruta registrada en app.js bajo /api/dashboard
 *
 *   GET /api/dashboard/admin  ->  verifyJWT + checkRole('ADMINISTRADOR')
 *
 * Compatibilidad de exportación: verifyJWT y checkRole se importan tanto como
 * función directa como con nombre (mismo patrón que notificaciones.routes.js).
 * =============================================================================
 */

const express = require("express");
const verifyJWTModule = require("../../middlewares/verifyJWT");
const checkRoleModule = require("../../middlewares/checkRole");
const dashboardController = require("./dashboard.controller");

const verifyJWT =
  typeof verifyJWTModule === "function"
    ? verifyJWTModule
    : verifyJWTModule.verifyJWT;
const checkRole =
  typeof checkRoleModule === "function"
    ? checkRoleModule
    : checkRoleModule.checkRole;

const router = express.Router();

/**
 * Panel ejecutivo consolidado (exclusivo del administrador).
 * Accesible en: GET /api/dashboard/admin
 */
router.get(
  "/admin",
  verifyJWT,
  checkRole("ADMINISTRADOR"),
  dashboardController.getAdminDashboard
);

module.exports = router;
