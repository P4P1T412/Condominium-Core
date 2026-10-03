/**
 * =============================================================================
 * CONTROLADOR: AUTENTICACIÓN
 * =============================================================================
 * Descripción:
 *   Maneja las solicitudes HTTP entrantes para inicio de sesión, cierre de
 *   sesión y verificación de identidad activa.
 * =============================================================================
 */

const authService = require("./auth.service");

// Configuración centralizada de la cookie HTTP-Only
const COOKIE_NAME = "token";
const COOKIE_OPTIONS = {
  httpOnly: true, // Inaccesible por scripts de JavaScript en el cliente (mitiga XSS)
  secure: process.env.NODE_ENV === "production", // Solo HTTPS en producción
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Previene ataques CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días de vigencia en milisegundos
};

/**
 * Endpoint: POST /api/auth/login
 * Procesa el inicio de sesión del usuario y establece la cookie de sesión.
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // Validación defensiva de entrada temprana
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Debe ingresar su usuario (o correo) y su contraseña.",
      });
    }

    // Delegación a la capa de servicio
    const { token, user } = await authService.authenticateUser(username.trim(), password);

    // Emisión de la cookie segura al navegador
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "Autenticación exitosa.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Endpoint: POST /api/auth/logout
 * Elimina la cookie de sesión del cliente.
 */
async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json({
    success: true,
    message: "Sesión finalizada correctamente.",
  });
}

/**
 * Endpoint: GET /api/auth/me
 * Retorna los datos del usuario autenticado a partir del token verificado por el middleware.
 */
async function getMe(req, res, next) {
  try {
    // req.user fue inyectado previamente por el middleware verifyToken
    const userProfile = await authService.getUserProfileById(req.user.userId);

    return res.status(200).json({
      success: true,
      data: { user: userProfile },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
  getMe,
};