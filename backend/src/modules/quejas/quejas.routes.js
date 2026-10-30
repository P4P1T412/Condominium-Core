const express = require('express');
const router = express.Router();
const quejasController = require('./quejas.controller');
const { verifyToken, checkRole } = require('../../middlewares/auth.middleware');

// GET /api/quejas - Consultar quejas (Autenticado)
router.get(
  '/',
  verifyToken,
  checkRole('ADMIN', 'ADMINISTRADOR', 'ADMINISTRACION', 'RESIDENTE', 'CONDOMINO', 'CONDÓMINO'),
  quejasController.obtenerQuejas
);

// POST /api/quejas - Crear nueva queja o sugerencia (Administración, Condóminos y Residentes)
router.post(
  '/',
  verifyToken,
  checkRole('ADMIN', 'ADMINISTRADOR', 'RESIDENTE', 'CONDOMINO', 'CONDÓMINO', 'USUARIO'),
  quejasController.crearQueja
);

// PUT /api/quejas/:id/responder - Responder queja (Administración)
router.put(
  '/:id/responder',
  verifyToken,
  checkRole('ADMIN', 'ADMINISTRACION', 'ADMINISTRADOR'),
  quejasController.responderQueja
);

router.post(
  '/:id/responder',
  verifyToken,
  checkRole('ADMIN', 'ADMINISTRACION', 'ADMINISTRADOR'),
  quejasController.responderQueja
);

module.exports = router;