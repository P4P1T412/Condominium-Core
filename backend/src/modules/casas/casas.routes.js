const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const casasController = require("./casas.controller");
const { verifyToken, requireRole } = require("../../middlewares/auth.middleware");

// Almacenamiento en memoria para procesar el Excel sin escribir en disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const extensionValida = [".xlsx", ".xls"].includes(extension);
    const mimeValido = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
      "application/zip",
      "",
    ].includes(file.mimetype);

    if (extensionValida && mimeValido) {
      return callback(null, true);
    }

    return callback(
      new Error("Formato de archivo no válido. Solo se admiten archivos Excel (.xlsx, .xls).")
    );
  },
});

// Acepta el archivo tanto en el campo "archivo" como en "archivoExcel"
const recibirExcel = (req, res, next) => {
  upload.fields([
    { name: "archivo", maxCount: 1 },
    { name: "archivoExcel", maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        code: "INVALID_FILE_UPLOAD",
        message: error.message || "No se pudo procesar el archivo adjunto.",
      });
    }
    next();
  });
};

// Todas las rutas requieren sesión activa
router.use(verifyToken);

// Catálogo de Personas para dropdowns de propietarios y residentes
// Accesible en: GET /api/casas/personas
router.get("/personas", requireRole("ADMINISTRADOR"), casasController.getPersonas);
router.post("/personas", requireRole("ADMINISTRADOR"), casasController.createPersona);

// Carga masiva de viviendas desde Excel (debe declararse antes de /:id)
// Accesible en: GET /api/casas/carga-masiva/plantilla
router.get(
  "/carga-masiva/plantilla",
  requireRole("ADMINISTRADOR"),
  casasController.descargarPlantilla
);
// Accesible en: POST /api/casas/carga-masiva
router.post(
  "/carga-masiva",
  requireRole("ADMINISTRADOR"),
  recibirExcel,
  casasController.importarCasas
);

// Consultas (Administrador, Garita o Condómino para autogestión)
router.get("/", requireRole("ADMINISTRADOR", "GARITA", "CONDOMINO"), casasController.getCasas);
router.get("/:id", requireRole("ADMINISTRADOR", "GARITA", "CONDOMINO"), casasController.getCasa);

// Modificaciones exclusivas del Administrador
router.post("/", requireRole("ADMINISTRADOR"), casasController.createCasa);
router.put("/:id", requireRole("ADMINISTRADOR"), casasController.updateCasa);
router.post("/:id/residentes", requireRole("ADMINISTRADOR"), casasController.addResidente);
router.delete(
  "/:id/residentes/:idResidente",
  requireRole("ADMINISTRADOR"),
  casasController.removeResidente
);

module.exports = router;