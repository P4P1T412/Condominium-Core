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
    res.json({
      success: true,
      data: await pagosService.getAccountStatement({
        personaId: req.user.personaId,
        userId: req.user.userId,
      }),
    });
  } catch (error) {
    next(error);
  }
}

async function getGeneral(req, res, next) {
  try {
    const { periodo, desde, hasta, idCasa } = req.query;
    if (desde && !isValidDateString(desde) || hasta && !isValidDateString(hasta)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE",
        message: "Las fechas del filtro deben tener el formato AAAA-MM-DD.",
      });
    }
    if (desde && hasta && desde > hasta) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE_RANGE",
        message: "La fecha inicial no puede ser posterior a la fecha final.",
      });
    }
    res.json({
      success: true,
      data: await pagosService.getGeneralStatement({ periodo, desde, hasta, idCasa }),
    });
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

async function getActiveFines(req, res, next) {
  try {
    const { desde, hasta, idCasa } = req.query;
    if (desde && !isValidDateString(desde) || hasta && !isValidDateString(hasta)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE",
        message: "Las fechas del filtro deben tener el formato AAAA-MM-DD.",
      });
    }
    if (desde && hasta && desde > hasta) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE_RANGE",
        message: "La fecha inicial no puede ser posterior a la fecha final.",
      });
    }
    res.json({ success: true, data: await pagosService.getActiveFines({ desde, hasta, idCasa }) });
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
    const dateParts = typeof fechaVencimiento === "string"
      ? fechaVencimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      : null;
    const parsedDate = dateParts
      ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])))
      : null;
    const isValidDate = parsedDate
      && parsedDate.getUTCFullYear() === Number(dateParts[1])
      && parsedDate.getUTCMonth() === Number(dateParts[2]) - 1
      && parsedDate.getUTCDate() === Number(dateParts[3]);
    if (!isValidDate) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE",
        message: "La fecha de vencimiento debe tener el formato AAAA-MM-DD.",
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
    if ((!idCuota && !req.body.idMulta) || !monto || !fechaPago || !metodo || !req.file) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Cuota o mora, monto, fecha, método y comprobante son obligatorios.",
      });
    }
    const data = await pagosService.submitPayment({
      ...req.body,
      comprobanteUrl: req.file ? `/uploads/comprobantes/${req.file.filename}` : null,
    }, {
      personaId: req.user.personaId,
      userId: req.user.userId,
    });
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
    const document = new PDFDocument({ size: [612, 396], margin: 24 });
    const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
    const left = document.page.margins.left;
    const right = left + pageWidth;
    const darkGray = "#222222";
    const mediumGray = "#6B6B6B";
    const lightGray = "#E9E9E9";
    const border = "#333333";
    const text = "#222222";
    const amount = Number(payment.MONTO_PAGADO || 0);
    const date = payment.FECHA_PAGO ? new Date(payment.FECHA_PAGO) : null;
    const formattedDate = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("es-GT")
      : "No disponible";
    const dueDate = payment.FECHA_VENCIMIENTO ? new Date(payment.FECHA_VENCIMIENTO) : null;
    const formattedDueDate = dueDate && !Number.isNaN(dueDate.getTime())
      ? dueDate.toLocaleDateString("es-GT")
      : "No disponible";
    const periodDate = String(payment.PERIODO || "").match(/^(\d{4})-(\d{2})$/);
    const period = periodDate
      ? new Date(Number(periodDate[1]), Number(periodDate[2]) - 1, 1)
        .toLocaleDateString("es-GT", { month: "long", year: "numeric" })
      : payment.PERIODO || "No disponible";
    const cell = (x, y, width, height, value, options = {}) => {
      document
        .fillColor(options.fill || "#FFFFFF")
        .strokeColor(options.stroke || border)
        .lineWidth(options.lineWidth || 0.7)
        .rect(x, y, width, height)
        .fillAndStroke();
      document
        .fillColor(options.color || text)
        .font(options.font || "Helvetica")
        .fontSize(options.size || 9)
        .text(String(value ?? ""), x + (options.padding || 7), y + (options.top || 6), {
          width: width - ((options.padding || 7) * 2),
          align: options.align || "left",
        });
    };

    res.type("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="recibo-pago-${payment.ID_PAGO}.pdf"`);
    document.pipe(res);

    const headerHeight = 55;
    document.rect(left, 24, pageWidth, headerHeight).strokeColor(border).lineWidth(1).stroke();
    document.font("Helvetica-Bold").fontSize(20).fillColor(darkGray)
      .text("CONDOMINIO", left + 12, 34);
    document.font("Helvetica").fontSize(8).fillColor(mediumGray)
      .text("JUNTA DE PROPIETARIOS", left + 13, 58);
    const receiptBoxX = left + pageWidth - 245;
    document.rect(receiptBoxX, 24, 245, headerHeight).strokeColor(border).lineWidth(1).stroke();
    document.rect(receiptBoxX, 24, 245, 17).fillAndStroke("#D0D0D0", border);
    document.font("Helvetica-Bold").fontSize(10).fillColor(darkGray)
      .text("RECIBO DE PAGO", receiptBoxX, 28, { width: 245, align: "center" });
    document.font("Helvetica-Bold").fontSize(9)
      .text(`No. ${payment.ID_PAGO}`, receiptBoxX, 46, { width: 245, align: "center" });
    document.font("Helvetica").fontSize(8)
      .text("Administración residencial", receiptBoxX, 59, { width: 245, align: "center" });

    const customerY = 87;
    const half = pageWidth / 2;
    cell(left, customerY, half, 32, payment.PROPIETARIO || "No disponible", {
      fill: lightGray, font: "Helvetica-Bold", size: 9, top: 5,
    });
    cell(left + half, customerY, half, 32, `Casa ${payment.NUMERO_CASA || "N/D"}${payment.BLOQUE ? ` · Bloque ${payment.BLOQUE}` : ""}`, {
      fill: lightGray, font: "Helvetica-Bold", size: 9, top: 5,
    });
    document.font("Helvetica").fontSize(7).fillColor(mediumGray)
      .text("CONDÓMINO", left + 6, customerY + 21)
      .text("INMUEBLE", left + half + 6, customerY + 21);

    const tableY = 132;
    const descriptionWidth = pageWidth * 0.54;
    const periodWidth = pageWidth * 0.19;
    const amountWidth = pageWidth - descriptionWidth - periodWidth;
    cell(left, tableY, descriptionWidth, 19, "Descripción", { fill: "#BDBDBD", font: "Helvetica-Bold", size: 8, top: 5 });
    cell(left + descriptionWidth, tableY, periodWidth, 19, "Período", { fill: "#BDBDBD", font: "Helvetica-Bold", size: 8, align: "center", top: 5 });
    cell(left + descriptionWidth + periodWidth, tableY, amountWidth, 19, "Importe", { fill: "#BDBDBD", font: "Helvetica-Bold", size: 8, align: "right", top: 5 });
    cell(left, tableY + 19, descriptionWidth, 30, payment.CONCEPTO || "Cuota de mantenimiento", { font: "Helvetica-Bold", size: 9, top: 7 });
    cell(left + descriptionWidth, tableY + 19, periodWidth, 30, period, { size: 8, align: "center", top: 7 });
    cell(left + descriptionWidth + periodWidth, tableY + 19, amountWidth, 30, `Q ${amount.toFixed(2)}`, { font: "Helvetica-Bold", size: 9, align: "right", top: 7 });
    cell(left, tableY + 49, pageWidth - amountWidth, 21, "TOTAL PAGADO", { fill: lightGray, font: "Helvetica-Bold", size: 9, align: "right", top: 6 });
    cell(left + pageWidth - amountWidth, tableY + 49, amountWidth, 21, `Q ${amount.toFixed(2)}`, { fill: lightGray, font: "Helvetica-Bold", size: 9, align: "right", top: 6 });

    const detailY = 222;
    document.font("Helvetica-Bold").fontSize(10).fillColor(darkGray)
      .text("DETALLE DE LA TRANSACCIÓN", left, detailY);
    document.moveTo(left, detailY + 16).lineTo(right, detailY + 16).strokeColor(border).lineWidth(0.7).stroke();
    const detailTop = detailY + 24;
    const detailRow = 24;
    cell(left, detailTop, half, detailRow, `Fecha de pago: ${formattedDate}`, { size: 8, top: 6 });
    cell(left + half, detailTop, half, detailRow, `Método: ${payment.METODO_PAGO || "N/A"}`, { size: 8, top: 6 });
    cell(left, detailTop + detailRow, half, detailRow, `Referencia: ${payment.REFERENCIA || "N/A"}`, { size: 8, top: 6 });
    cell(left + half, detailTop + detailRow, half, detailRow, "Estado: VALIDADO", {
      fill: "#DDEBDD", color: "#27613A", font: "Helvetica-Bold", size: 8, top: 6,
    });

    const footerY = 294;
    const footerHeight = 54;
    cell(left, footerY, pageWidth, 18, "BANCO / MEDIO DE PAGO", { fill: "#BDBDBD", font: "Helvetica-Bold", size: 8, top: 5 });
    cell(left, footerY + 18, half * 0.98, footerHeight - 18, "Gracias por realizar su pago.", { size: 8, top: 7 });
    const datesX = left + half * 0.98;
    const datesWidth = pageWidth - half * 0.98;
    cell(datesX, footerY + 18, datesWidth / 2, 24, `FECHA EMISIÓN\n${formattedDate}`, { fill: lightGray, font: "Helvetica-Bold", size: 6.5, align: "center", top: 4 });
    cell(datesX + datesWidth / 2, footerY + 18, datesWidth / 2, 24, `FECHA VENCIMIENTO\n${formattedDueDate}`, { fill: lightGray, font: "Helvetica-Bold", size: 6.5, align: "center", top: 4 });
    cell(datesX, footerY + 42, datesWidth, 12, `TOTAL A PAGAR  Q ${amount.toFixed(2)}`, { fill: "#D0D0D0", font: "Helvetica-Bold", size: 7, align: "right", top: 2 });
    document.font("Helvetica").fontSize(7).fillColor(mediumGray)
      .text("Comprobante electrónico generado por el sistema del condominio.", left, 365, { width: pageWidth, align: "center" });
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

function isValidDateString(value) {
  const parts = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!parts) return false;
  const date = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  return date.getUTCFullYear() === Number(parts[1])
    && date.getUTCMonth() === Number(parts[2]) - 1
    && date.getUTCDate() === Number(parts[3]);
}

module.exports = {
  getPending,
  getStatement,
  getGeneral,
  getDelinquent,
  getActiveFines,
  createFine,
  submit,
  validate,
  receipt,
  attachment,
};
