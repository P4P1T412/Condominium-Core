const { Router } = require("express");
const multer = require("multer");
const verifyJWTModule = require("../../middlewares/verifyJWT");
const checkRoleModule = require("../../middlewares/checkRole");
const visitasController = require("./visitas.controller");

// Normalización resiliente de middlewares de autenticación y roles
const verifyJWT = typeof verifyJWTModule === "function" ? verifyJWTModule : (verifyJWTModule.verifyJWT || verifyJWTModule.authenticateToken);
const checkRole = typeof checkRoleModule === "function" ? checkRoleModule : checkRoleModule.checkRole;

const router = Router();

// Configuración de almacenamiento en memoria para Multer (Excel)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Formato de archivo no válido. Solo se admiten archivos Excel (.xlsx, .xls)."), false);
    }
  }
});

// Proteger todas las rutas del módulo con verificación de JWT
router.use(verifyJWT);

// --- RUTAS DEL MÓDULO DE VISITAS Y EVENTOS ---

// 1. Obtener listado de visitas (Filtrado según el rol del usuario)
router.get("/", visitasController.obtenerVisitas);

// 2. Crear solicitud de visita individual (Residentes / Condóminos y Admins)
router.post("/", visitasController.crearVisitaIndividual);

// 3. Aprobar solicitud de visita individual (Solo Administrador)
router.put("/:idVisita/aprobar", checkRole(["ADMIN", "ADMINISTRADOR"]), visitasController.aprobarVisita);

// 4. Rechazar solicitud de visita individual (Solo Administrador)
router.put("/:idVisita/rechazar", checkRole(["ADMIN", "ADMINISTRADOR"]), visitasController.rechazarVisita);

// 5. Carga masiva de eventos desde Excel (Residentes y Admins)
router.post(
  "/evento-masivo",
  checkRole(["ADMIN", "ADMINISTRADOR", "RESIDENTE", "CONDOMINO"]),
  upload.single("archivoExcel"),
  visitasController.procesarEventoMasivo
);

// 6. Autorizar y configurar evento masivo (Solo Administrador: asigna salón, fecha y parqueos)
router.put("/eventos/:idEvento/aprobar", checkRole(["ADMIN", "ADMINISTRADOR"]), visitasController.aprobarEvento);

// 7. Enviar lista masiva autorizada a la Garita (Solo Administrador)
router.put(
  "/eventos/:idEvento/enviar-garita",
  checkRole(["ADMIN", "ADMINISTRADOR"]),
  visitasController.enviarEventoAGarita
);

// 8. Rechazar evento masivo completo (Solo Administrador)
router.put("/eventos/:idEvento/rechazar", checkRole(["ADMIN", "ADMINISTRADOR"]), visitasController.rechazarEvento);

// 9. Registro masivo express de ingreso en Garita para todos los invitados de un evento (Admins y Garita)
router.post(
  "/eventos/:idEvento/ingreso-masivo",
  checkRole(["ADMIN", "ADMINISTRADOR", "GARITA"]),
  visitasController.registrarIngresoMasivo
);

// 10. Registrar servicios externos y proveedores
router.post("/servicios-externos", checkRole(["ADMIN", "ADMINISTRADOR"]), visitasController.crearServicioExterno);

// 11. Registrar entradas y salidas individuales en Garita
router.post("/garita/acceso", checkRole(["ADMIN", "ADMINISTRADOR", "GARITA"]), visitasController.registrarAccesoGarita);

module.exports = router;