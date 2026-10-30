/**
 * =============================================================================
 * MIDDLEWARE: AUTENTICACIÓN Y AUTORIZACIÓN (RBAC)
 * =============================================================================
 */

const jwt = require("jsonwebtoken");

/**
 * Valida la autenticidad del JWT almacenado en cookies o cabeceras.
 */
function verifyToken(req, res, next) {
  let token = req.cookies ? (req.cookies.token || req.cookies.jwt || req.cookies.token_acceso) : null;

  if (!token && req.headers) {
    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers["x-access-token"];
    if (authHeader) {
      token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    }
  }

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({
      success: false,
      code: "TOKEN_MISSING",
      message: "Acceso no autorizado. Debe iniciar sesión para continuar.",
    });
  }

  try {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      return res.status(503).json({
        success: false,
        code: "SERVER_CONFIG_ERROR",
        message: "JWT_SECRET no está configurado en el backend.",
      });
    }
    const decoded = jwt.verify(token, secretKey);

    req.user = decoded;
    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      message: isExpired
        ? "Su sesión ha expirado. Por favor, ingrese de nuevo."
        : "Token de seguridad no válido o corrupto.",
    });
  }
}

/**
 * Middleware genérico para verificar el rol del usuario (soporta arreglo o parámetros rest).
 */
function checkRole(...allowedRoles) {
  const rolesFlat = allowedRoles.flat().map((r) => String(r).toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Usuario no autenticado.",
      });
    }

    // Normalizar propiedad del rol (rol vs role)
    const userRoleRaw = req.user.rol || req.user.role || "";
    const userRole = String(userRoleRaw).toUpperCase();

    if (!userRole) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_ROLE",
        message: "No posee un rol configurado para acceder a este recurso.",
      });
    }

    const hasPermission = rolesFlat.includes(userRole);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        code: "ACCESS_DENIED",
        message: `Acceso denegado. Tu rol (${userRole}) no posee permisos. Se requiere uno de los siguientes: [${rolesFlat.join(", ")}].`,
      });
    }

    next();
  };
}

// Alias para mantener compatibilidad con requireRole
const requireRole = checkRole;

module.exports = {
  verifyToken,
  checkRole,
  requireRole,
};