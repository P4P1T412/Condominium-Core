/**
 * =============================================================================
 * CONTROLADOR: DASHBOARD ESTRATÉGICO DEL ADMINISTRADOR
 * =============================================================================
 * Descripción:
 *   Expone las métricas agregadas del dashboard ejecutivo. Todas las
 *   operaciones son de solo lectura y sus errores se derivan al middleware
 *   centralizado errorHandler.
 * =============================================================================
 */

const dashboardService = require("./dashboard.service");

/**
 * GET /api/dashboard/admin
 * Devuelve en un único JSON las métricas de viviendas, finanzas del mes,
 * operación/garita en tiempo real y la bandeja de pendientes accionables.
 */
async function getAdminDashboard(req, res, next) {
  try {
    const data = await dashboardService.getAdminDashboard();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAdminDashboard,
};
