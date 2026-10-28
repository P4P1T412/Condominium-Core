const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {
  // 1. Buscar token en cookies (gracias a cookieParser)
  let token = req.cookies?.token || req.cookies?.jwt || req.cookies?.token_acceso;

  // 2. Si no está en cookies, buscar en las cabeceras HTTP (Authorization / x-access-token)
  if (!token) {
    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers["x-access-token"];
    if (authHeader) {
      token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    }
  }

  // 3. Si sigue sin existir ningún token
  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ 
      success: false, 
      message: "Token no proporcionado" 
    });
  }

  // 4. Verificar firma JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "tu_clave_secreta");
    req.user = decoded; // Inyecta el usuario autenticado
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: "Token inválido o expirado" 
    });
  }
};

module.exports = verifyJWT;