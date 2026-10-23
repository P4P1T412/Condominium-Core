const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("./pagos.controller");
const { verifyToken, requireRole } = require("../../middlewares/auth.middleware");

const uploadDirectory = path.resolve(__dirname, "../../../uploads/comprobantes");
fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `payment-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    callback(null, allowed.includes(file.mimetype));
  },
});

const router = express.Router();
router.use(verifyToken);

router.get("/pendientes", requireRole("ADMINISTRADOR"), controller.getPending);
router.get("/estado-cuenta", requireRole("CONDOMINO"), controller.getStatement);
router.get("/estado-cuenta-general", requireRole("ADMINISTRADOR"), controller.getGeneral);
router.get("/morosos", requireRole("ADMINISTRADOR"), controller.getDelinquent);
router.get("/multas", requireRole("ADMINISTRADOR"), controller.getActiveFines);
router.post("/multas", requireRole("ADMINISTRADOR"), controller.createFine);
router.post("/reportar", requireRole("CONDOMINO"), upload.single("comprobante"), controller.submit);
router.put("/:id/validar", requireRole("ADMINISTRADOR"), controller.validate);
router.get("/:id/recibo", requireRole("ADMINISTRADOR", "CONDOMINO"), controller.receipt);
router.get("/:id/comprobante", requireRole("ADMINISTRADOR", "CONDOMINO"), controller.attachment);

module.exports = router;
