function errorHandler(err, req, res, next) {
  console.error(`[Error Handler] ${req.method} ${req.originalUrl || req.url} - ${err.message}`);

  const msg = err.message || "";

  // 1. Intercepción de caídas, rechazos o arranque de Oracle (Falla simulada)
  const isDbConnectionError =
    msg.includes("ORA-12541") || // TNS: no listener
    msg.includes("ORA-12514") || // TNS: listener does not currently know of service
    msg.includes("ORA-03113") || // End-of-file on communication channel
    msg.includes("ORA-03114") || // Not connected to ORACLE
    msg.includes("ORA-01109") || // Database not open
    msg.includes("ORA-01033") || // ORACLE initialization or shutdown in progress
    msg.includes("ORA-POOL-NOT-INIT") ||
    msg.includes("NJS-500") ||   // Connection pool cerrado
    msg.includes("NJS-503") ||   // Connection could not be established (ECONNREFUSED)
    msg.includes("NJS-518") ||   // Service not registered with listener
    msg.includes("ECONNREFUSED");

  if (isDbConnectionError) {
    return res.status(503).json({
      success: false,
      code: "DATABASE_UNAVAILABLE",
      message: "El servicio de base de datos no se encuentra disponible temporalmente. Intente nuevamente en unos instantes."
    });
  }

  // 2. Intercepción de triggers y reglas de negocio personalizadas de Oracle (ORA-20000 a ORA-20999)
  if (msg.includes("ORA-20")) {
    const match = msg.match(/ORA-20\d{3}:\s*([^\n\r]+)/);
    const customMessage = match ? match[1] : "Violación de regla de negocio en el sistema.";

    return res.status(400).json({
      success: false,
      code: "BUSINESS_RULE_VIOLATION",
      message: customMessage
    });
  }

  // 3. Claves únicas duplicadas en Oracle
  if (msg.includes("ORA-00001")) {
    return res.status(409).json({
      success: false,
      code: "RESOURCE_ALREADY_EXISTS",
      message: "El registro ya existe en el sistema (correo, DPI, usuario o número de casa duplicado)."
    });
  }

  // 4. Fallas de integridad referencial
  if (msg.includes("ORA-02291")) {
    return res.status(400).json({
      success: false,
      code: "FOREIGN_KEY_VIOLATION",
      message: "El registro hace referencia a una entidad inexistente en la base de datos."
    });
  }

  // 5. Error general o no previsto
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    code: err.code || "INTERNAL_SERVER_ERROR",
    message: statusCode === 500 ? "Error interno del servidor" : msg
  });
}

module.exports = errorHandler;