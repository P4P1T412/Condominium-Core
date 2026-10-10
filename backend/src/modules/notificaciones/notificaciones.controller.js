const service = require("./notificaciones.service");

async function ping(req, res) {
  res.json({ modulo: "notificaciones", status: "ok" });
}

module.exports = { ping };
