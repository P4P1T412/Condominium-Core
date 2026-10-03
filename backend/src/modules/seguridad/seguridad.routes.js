const express = require("express");
const router = express.Router();
const controller = require("./seguridad.controller");
// const verifyJWT = require("../../middlewares/verifyJWT");
// const checkRole = require("../../middlewares/checkRole");

// TODO (Seguridad): agregar verifyJWT y checkRole cuando el modulo de auth este listo
router.get("/", controller.ping);

module.exports = router;
