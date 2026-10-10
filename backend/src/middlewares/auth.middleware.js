/**
 * =============================================================================
 * MIDDLEWARE: AUTENTICACIÓN Y AUTORIZACIÓN (RBAC)
 * =============================================================================
 * Descripción:
 *   1. verifyToken: Valida la autenticidad del JWT almacenado en cookies (o cabecera).
 *   2. requireRole: Restringe el acceso en base a una lista blanca de roles permitidos.
 * =============================================================================
 */

const jwt = require("jsonwebtoken");

/**
 * Intercepta la petición y valida la existencia y validez del token JWT.
 */
function verifyToken(req, res, next) {
  // Se busca prioritariamente en la cookie httpOnly; opcionalmente en el header Authorization
  let token = req.cookies ? req.cookies.token : null;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      code: "TOKEN_MISSING",
      message: "Acceso no autorizado. Debe iniciar sesión para continuar.",
    });
  }

  try {
    const secretKey = process.env.JWT_SECRET || "fallback_secret_condominio_dev";
    const decoded = jwt.verify(token, secretKey);

    // Se asocia el payload decodificado a la petición para los controladores subsecuentes
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
 * Generador de middleware para control de acceso basado en roles (RBAC).
 * 
 * @param {...string} allowedRoles - Lista de roles autorizados (ej: 'ADMINISTRADOR', 'GARITA')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_ROLE",
        message: "No posee permisos configurados para acceder a este recurso.",
      });
    }

    const hasPermission = allowedRoles.includes(req.user.role);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        code: "ACCESS_DENIED",
        message: `Acceso denegado. Se requiere uno de los siguientes roles: [${allowedRoles.join(", ")}].`,
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
};