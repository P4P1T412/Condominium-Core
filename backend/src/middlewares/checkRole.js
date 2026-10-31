// Uso: checkRole(['ADMINISTRADOR']) o checkRole(['ADMINISTRADOR', 'GARITA'])
const ALIAS_ROLES = {
  ADMIN: "ADMINISTRADOR",
  ADMINISTRADOR: "ADMINISTRADOR",
  RESIDENTE: "CONDOMINO",
  CONDOMINO: "CONDOMINO",
  GARITA: "GARITA",
  PENDIENTE: "PENDIENTE",
};

function normalizarRol(valor) {
  const rol = String(valor || "").trim().toUpperCase();
  return ALIAS_ROLES[rol] || rol;
}

function checkRole(rolesPermitidos) {
  const permitidos = new Set(
    (Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos]).map(
      normalizarRol
    )
  );

  return (req, res, next) => {
    const rolUsuario = normalizarRol(req.user?.rol || req.user?.role);

    if (!rolUsuario || !permitidos.has(rolUsuario)) {
      return res
        .status(403)
        .json({ success: false, message: "No tienes permiso para acceder a este recurso" });
    }

    next();
  };
}

module.exports = checkRole;
module.exports.checkRole = checkRole;
