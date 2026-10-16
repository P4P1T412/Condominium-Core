const PDFDocument = require("pdfkit");
const pagosService = require("./pagos.service");

async function getPending(req, res, next) {
  try {
    res.json({ success: true, data: await pagosService.getPendingPayments() });
  } catch (error) {
    next(error);
  }
}

async function getStatement(req, res, next) {
  try {
    res.json({ success: true, data: await pagosService.getAccountStatement(req.user.personaId) });
  } catch (error) {
    next(error);
  }
}

async function getGeneral(req, res, next) {
  try {
    res.json({ success: true, data: await pagosService.getGeneralStatement(req.query.periodo) });
  } catch (error) {
    next(error);
  }
}

async function getDelinquent(req, res, next) {
  try {
    res.json({ success: true, data: await pagosService.getDelinquentHouses() });
  } catch (error) {
    next(error);
  }
}

async function createFine(req, res, next) {
  try {
    const { idCasa, motivo, monto, fechaVencimiento } = req.body;
    if (!idCasa || !motivo?.trim() || !monto || !fechaVencimiento) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Casa, motivo, monto y fecha de vencimiento son obligatorios.",
      });
    }
    const data = await pagosService.createFine(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function submit(req, res, next) {
  try {
    const { idCuota, monto, fechaPago, metodo, referencia } = req.body;
    if (!idCuota || !monto || !fechaPago || !metodo || !req.file) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Cuota, monto, fecha, método y comprobante son obligatorios.",
      });
    }
    const data = await pagosService.submitPayment({
      ...req.body,
      comprobanteUrl: req.file ? `/uploads/comprobantes/${req.file.filename}` : null,
    }, req.user.personaId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function validate(req, res, next) {
  try {
    const { estado, observacion } = req.body;
    if (!["VALIDO", "RECHAZADO"].includes(estado)) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "El estado debe ser VALIDO o RECHAZADO.",
      });
    }
    if (estado === "RECHAZADO" && !observacion?.trim()) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Debe indicar el motivo del rechazo.",
      });
    }
    await pagosService.updatePaymentStatus(req.params.id, estado, observacion, req.user.userId);
    return res.json({ success: true, message: "Pago actualizado correctamente." });
  } catch (error) {
    next(error);
  }
}

async function receipt(req, res, next) {
  try {
    const payment = await pagosService.getPaymentReceipt(req.params.id, req.user.userId);
    const document = new PDFDocument({ size: "LETTER", margin: 50 });
    res.type("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="recibo-pago-${payment.ID_PAGO}.pdf"`);
    document.pipe(res);
    document.fontSize(20).text("Condominio - Recibo de pago", { align: "center" });
    document.moveDown();
    document.fontSize(12)
      .text(`Recibo: ${payment.ID_PAGO}`)
      .text(`Casa: ${payment.NUMERO_CASA} (${payment.BLOQUE})`)
      .text(`Responsable: ${payment.PROPIETARIO}`)
      .text(`Periodo: ${payment.PERIODO}`)
      .text(`Concepto: ${payment.CONCEPTO}`)
      .text(`Monto: Q ${Number(payment.MONTO_PAGADO).toFixed(2)}`)
      .text(`Método: ${payment.METODO_PAGO}`)
      .text(`Referencia: ${payment.REFERENCIA || "N/A"}`)
      .text(`Fecha de pago: ${payment.FECHA_PAGO}`)
      .text(`Estado: VALIDADO`);
    document.end();
  } catch (error) {
    next(error);
  }
}

async function attachment(req, res, next) {
  try {
    const filePath = await pagosService.getPaymentAttachment(req.params.id, req.user.userId);
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPending,
  getStatement,
  getGeneral,
  getDelinquent,
  createFine,
  submit,
  validate,
  receipt,
  attachment,
};
