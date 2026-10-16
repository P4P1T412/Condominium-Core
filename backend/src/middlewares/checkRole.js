// Uso: checkRole(['administrador']) o checkRole(['administrador', 'garita'])
function checkRole(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ message: "No tienes permiso para acceder a este recurso" });
    }
    next();
  };
}

module.exports = checkRole;
