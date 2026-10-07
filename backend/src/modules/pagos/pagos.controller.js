const service = require("./pagos.service");

async function ping(req, res) {
  res.json({ modulo: "pagos", status: "ok" });
}

module.exports = { ping };
