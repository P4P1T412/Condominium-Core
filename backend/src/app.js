require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

// Pool resiliente de Oracle y Middleware de Errores
const { initializeDbPool, closeDbPool, executeQuery } = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");

// Rutas por módulo
const authRoutes = require("./modules/auth/auth.routes");
const casasRoutes = require("./modules/casas/casas.routes");
const pagosRoutes = require("./modules/pagos/pagos.routes");
const notificacionesRoutes = require("./modules/notificaciones/notificaciones.routes");
const seguridadRoutes = require("./modules/seguridad/seguridad.routes");

const app = express();

// Seguridad HTTP básica
app.use(helmet());

// Configuración CORS estricta para soportar cookies httpOnly desde React (Vite)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // Permite envío y recepción de cookies
  })
);

app.use(express.json());
app.use(cookieParser()); // Parser de cookies para JWT
app.use(morgan("dev"));

// Límite general de peticiones (mitiga fuerza bruta en login, etc.)
const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 200,
  message: { success: false, message: "Demasiadas peticiones desde esta IP, intente más tarde." }
});
app.use(limiter);

// Rutas por módulo
app.use("/api/auth", authRoutes);
app.use("/api/casas", casasRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/seguridad", seguridadRoutes);

// Health check real contra Oracle (clave para demostración de fallas simuladas)
app.get("/api/health", async (req, res, next) => {
  try {
    const result = await executeQuery("SELECT SYSDATE, 'OK' AS DB_STATUS FROM DUAL");
    res.json({
      status: "ok",
      database: "Connected to Oracle 23c (Docker)",
      timestamp: result.rows[0].SYSDATE,
    });
  } catch (error) {
    next(error); // Si Oracle está desconectado, errorHandler enviará 503
  }
});

// Middleware centralizado de errores
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

// Inicializar primero la base de datos y luego escuchar peticiones
async function startServer() {
  try {
    await initializeDbPool();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor debido a error en BD:", error);
    process.exit(1);
  }
}

startServer();

// Cierre ordenado de conexiones
process.on("SIGINT", async () => {
  console.log("\nCerrando servidor...");
  await closeDbPool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDbPool();
  process.exit(0);
});