const service = require("./seguridad.service");

async function ping(req, res) {
  res.json({ modulo: "seguridad", status: "ok" });
}

module.exports = { ping };
