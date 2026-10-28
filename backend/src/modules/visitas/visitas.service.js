const xlsx = require("xlsx");
const crypto = require("crypto");
const db = require("../../config/db.js");

/**
 * Carga masiva de eventos desde archivo Excel
 */
const procesarEventoMasivo = async (fileBuffer, nombreEvento, fechaEvento, datosAdicionales, user) => {
  if (!fileBuffer) {
    throw new Error("Debe proporcionar un archivo Excel válido.");
  }

  const workbook = xlsx.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  if (!rows || rows.length === 0) {
    throw new Error("El archivo Excel no contiene filas con datos.");
  }

  let tituloEventoReal = String(
    nombreEvento ||
      datosAdicionales?.nombreEvento ||
      datosAdicionales?.tipoEvento ||
      "Evento Especial"
  ).trim();

  if (tituloEventoReal === "Otros" && datosAdicionales?.otroEvento) {
    tituloEventoReal = String(datosAdicionales.otroEvento).trim();
  }

  const salonSolicitado = datosAdicionales?.salon || datosAdicionales?.salon_asignado || "Salón Social 1";
  const casaId = datosAdicionales?.casaId || user?.casaId || user?.id_casa || 1;

  let idResidente = user?.idResidente || user?.id_residente || null;
  if (!idResidente && casaId) {
    try {
      const sqlRes = `SELECT id_residente FROM RESIDENTE WHERE id_casa = :casaId AND ROWNUM = 1`;
      const resVal = await db.executeQuery(sqlRes, { casaId: Number(casaId) });
      const rowsRes = resVal.rows || resVal.data || resVal || [];
      if (rowsRes.length > 0) idResidente = rowsRes[0].ID_RESIDENTE || rowsRes[0].id_residente;
    } catch (e) {
      console.warn("Aviso al consultar id_residente:", e.message);
    }
  }
  if (!idResidente) idResidente = 1;

  // 1. Crear NUEVA fila en EVENTO_VISITA
  const sqlEvento = `
    INSERT INTO EVENTO_VISITA (id_casa, nombre_evento, fecha_evento, solicitado_por, salon_asignado, estado_aprobacion)
    VALUES (:casaId, :nombreEvento, TO_DATE(:fechaEvento, 'YYYY-MM-DD'), :solicitadoPor, :salon, 'PENDIENTE_APROBACION')`;

  await db.executeQuery(
    sqlEvento,
    {
      casaId: Number(casaId),
      nombreEvento: String(tituloEventoReal),
      fechaEvento,
      solicitadoPor: Number(user?.id || user?.id_usuario || 1),
      salon: salonSolicitado,
    },
    { autoCommit: true }
  );

  // 2. Obtener el ID del evento exacto recién creado
  const sqlGetNewId = `
    SELECT id_evento 
    FROM EVENTO_VISITA 
    WHERE nombre_evento = :nombreEvento 
    ORDER BY id_evento DESC 
    FETCH FIRST 1 ROWS ONLY`;

  const resNewId = await db.executeQuery(sqlGetNewId, { nombreEvento: String(tituloEventoReal) });
  const rowsId = resNewId.rows || resNewId.data || resNewId || [];
  
  if (!rowsId || rowsId.length === 0) {
    throw new Error("No se pudo obtener el ID del evento recién registrado en Oracle.");
  }

  const idEvento = rowsId[0].ID_EVENTO || rowsId[0].id_evento;

  // 3. Insertar los invitados del Excel vinculados a este evento
  for (const row of rows) {
    try {
      const sqlVisita = `
        INSERT INTO VISITA (
          id_casa, id_residente, id_evento, nombre_visitante, identificacion, 
          correo_visitante, telefono_visitante, placa_vehiculo, 
          fecha_esperada, estado
        ) VALUES (
          :casaId, :idResidente, :idEvento, :nombre, :ident, 
          :correo, :tel, :placa, 
          TO_DATE(:fecha, 'YYYY-MM-DD'), 'PENDIENTE'
        )`;

      await db.executeQuery(
        sqlVisita,
        {
          casaId: Number(casaId),
          idResidente: Number(idResidente),
          idEvento: Number(idEvento),
          nombre: String(row.Nombre || row.NOMBRE || "Invitado"),
          ident: String(row.DPI || row.Identificacion || row.IDENTIFICACION || ""),
          correo: row.Correo || row.CORREO || null,
          tel: String(row.Telefono || row.TELEFONO || ""),
          placa: row.Placa || row.PLACA || null,
          fecha: fechaEvento,
        },
        { autoCommit: true }
      );
    } catch (eVisita) {
      console.warn("Aviso al insertar invitado:", eVisita.message);
    }
  }

  return { idEvento, totalProcesados: rows.length, message: `Evento "${tituloEventoReal}" registrado exitosamente con ID #${idEvento}.` };
};

/**
 * Obtener Visitas globales agrupadas por evento y casa
 */
const obtenerVisitas = async (user) => {
  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const esAdmin = rolUpper === "ADMIN" || rolUpper === "ADMINISTRADOR" || rolUpper === "GARITA";
  const casaId = user?.casaId || user?.id_casa;

  let sql = `
    SELECT 
      v.id_visita,
      v.id_casa,
      v.id_evento,
      v.nombre_visitante,
      v.identificacion,
      v.placa_vehiculo,
      v.correo_visitante,
      v.estado,
      v.numero_parqueo,
      TO_CHAR(v.fecha_esperada, 'YYYY-MM-DD') AS fecha_esperada,
      TO_CHAR(v.fecha_entrada, 'DD/MM/YYYY HH24:MI') AS fecha_entrada,
      TO_CHAR(v.fecha_salida, 'DD/MM/YYYY HH24:MI') AS fecha_salida,
      v.token_qr,
      c.numero_casa,
      e.nombre_evento,
      e.salon_asignado,
      e.estado_aprobacion AS estado_evento,
      NVL(TRIM(p.nombres || ' ' || p.apellidos), 'Condómino') AS nombre_condomino
    FROM VISITA v
    LEFT JOIN CASA c ON v.id_casa = c.id_casa
    LEFT JOIN EVENTO_VISITA e ON v.id_evento = e.id_evento
    LEFT JOIN RESIDENTE r ON v.id_residente = r.id_residente
    LEFT JOIN PERSONA p ON r.id_persona = p.id_persona`;

  const params = {};
  if (!esAdmin && casaId && Number(casaId) > 0) {
    sql += ` WHERE v.id_casa = :casaId`;
    params.casaId = Number(casaId);
  }

  sql += ` ORDER BY v.id_visita DESC`;

  try {
    const result = await db.executeQuery(sql, params);
    const rows = result.rows || result.data || result || [];

    return rows.map((r) => {
      const idVisita = r.ID_VISITA ?? r.id_visita;
      const nombreEv = r.NOMBRE_EVENTO ?? r.nombre_evento;
      return {
        id_visita: idVisita,
        id_casa: r.ID_CASA ?? r.id_casa,
        id_evento: r.ID_EVENTO ?? r.id_evento,
        nombre_visitante: r.NOMBRE_VISITANTE ?? r.nombre_visitante,
        identificacion: r.IDENTIFICACION ?? r.identificacion,
        placa_vehiculo: r.PLACA_VEHICULO ?? r.placa_vehiculo,
        correo_visitante: r.CORREO_VISITANTE ?? r.correo_visitante,
        estado: r.ESTADO ?? r.estado,
        numero_parqueo: r.NUMERO_PARQUEO ?? r.numero_parqueo,
        fecha_esperada: r.FECHA_ESPERADA ?? r.fecha_esperada,
        fecha_entrada: r.FECHA_ENTRADA ?? r.fecha_entrada,
        fecha_salida: r.FECHA_SALIDA ?? r.fecha_salida,
        token_qr: r.TOKEN_QR ?? r.token_qr,
        numero_casa: r.NUMERO_CASA ?? r.numero_casa,
        nombre_evento: nombreEv,
        salon_asignado: r.SALON_ASIGNADO ?? r.salon_asignado,
        estado_evento: r.ESTADO_EVENTO ?? r.estado_evento,
        nombre_condomino: r.NOMBRE_CONDOMINO ?? r.nombre_condomino ?? "Condómino",

        ID_VISITA: idVisita,
        ID_CASA: r.ID_CASA ?? r.id_casa,
        ID_EVENTO: r.ID_EVENTO ?? r.id_evento,
        NOMBRE_VISITANTE: r.NOMBRE_VISITANTE ?? r.nombre_visitante,
        IDENTIFICACION: r.IDENTIFICACION ?? r.identificacion,
        PLACA_VEHICULO: r.PLACA_VEHICULO ?? r.placa_vehiculo,
        CORREO_VISITANTE: r.CORREO_VISITANTE ?? r.correo_visitante,
        ESTADO: r.ESTADO ?? r.estado,
        NUMERO_PARQUEO: r.NUMERO_PARQUEO ?? r.numero_parqueo,
        FECHA_ESPERADA: r.FECHA_ESPERADA ?? r.fecha_esperada,
        FECHA_ENTRADA: r.FECHA_ENTRADA ?? r.fecha_entrada,
        FECHA_SALIDA: r.FECHA_SALIDA ?? r.fecha_salida,
        TOKEN_QR: r.TOKEN_QR ?? r.token_qr,
        NUMERO_CASA: r.NUMERO_CASA ?? r.numero_casa,
        NOMBRE_EVENTO: nombreEv,
        SALON_ASIGNADO: r.SALON_ASIGNADO ?? r.salon_asignado,
        ESTADO_EVENTO: r.ESTADO_EVENTO ?? r.estado_evento,
        NOMBRE_CONDOMINO: r.NOMBRE_CONDOMINO ?? r.nombre_condomino ?? "Condómino",
      };
    });
  } catch (error) {
    console.error("Aviso al consultar visitas:", error.message);
    return [];
  }
};

/**
 * Crear Visita Individual o Agregar Invitado Extra a un Evento
 */
const crearVisitaIndividual = async (datos, user) => {
  const nombreVisitante = datos.nombreVisitante || datos.nombre;
  const identificacion = datos.identificacion || datos.dpi;
  const placaVehiculo = datos.placaVehiculo || datos.placa || null;
  const correoVisitante = datos.correoVisitante || datos.correo || null;
  const fechaEsperada = datos.fechaEsperada || datos.fecha || new Date().toISOString().split("T")[0];
  const casaId = datos.casaId || user?.casaId || user?.id_casa || 1;
  const idEvento = datos.idEvento || datos.id_evento || null;

  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const esAdmin = rolUpper === "ADMIN" || rolUpper === "ADMINISTRADOR" || rolUpper === "GARITA";

  const estadoFinal = esAdmin ? "AUTORIZADA" : "PENDIENTE";
  const tokenQR = esAdmin ? crypto.randomUUID() : null;

  const sql = `
    INSERT INTO VISITA (
      id_casa, id_residente, id_evento, nombre_visitante, identificacion, 
      placa_vehiculo, correo_visitante, fecha_esperada, estado, token_qr
    ) VALUES (
      :casaId, 1, :idEvento, :nombre, :identificacion, 
      :placa, :correo, TO_DATE(:fecha, 'YYYY-MM-DD'), :estado, :token
    )`;

  await db.executeQuery(
    sql,
    {
      casaId: Number(casaId),
      idEvento: idEvento ? Number(idEvento) : null,
      nombre: String(nombreVisitante),
      identificacion: String(identificacion),
      placa: placaVehiculo,
      correo: correoVisitante,
      fecha: fechaEsperada,
      estado: estadoFinal,
      token: tokenQR,
    },
    { autoCommit: true }
  );

  return { message: esAdmin ? "Visita autorizada exitosamente." : "Solicitud de invitado enviada a Administración." };
};

/**
 * Aprobar Evento (Administración)
 */
const aprobarEvento = async (idEvento, body = {}) => {
  const salon = body.salon || "Salón Social 1";
  const fecha = body.fecha;
  const parqueoInicio = Number(body.parqueoInicio || 1);

  if (fecha) {
    const sqlUpEv = `UPDATE EVENTO_VISITA SET salon_asignado = :salon, fecha_evento = TO_DATE(:fecha, 'YYYY-MM-DD') WHERE id_evento = :idEvento`;
    await db.executeQuery(sqlUpEv, { salon, fecha, idEvento: Number(idEvento) }, { autoCommit: true });
  } else {
    const sqlUpEv = `UPDATE EVENTO_VISITA SET salon_asignado = :salon WHERE id_evento = :idEvento`;
    await db.executeQuery(sqlUpEv, { salon, idEvento: Number(idEvento) }, { autoCommit: true });
  }

  const sqlGetVisitas = `SELECT id_visita FROM VISITA WHERE id_evento = :idEvento ORDER BY id_visita ASC`;
  const res = await db.executeQuery(sqlGetVisitas, { idEvento: Number(idEvento) });
  const visitas = res.rows || res.data || res || [];

  let numParqueo = parqueoInicio;
  for (const v of visitas) {
    const idVisita = v.ID_VISITA || v.id_visita;
    const token = crypto.randomUUID();

    if (fecha) {
      const sqlUpdateVisita = `
        UPDATE VISITA 
        SET estado = 'AUTORIZADA', numero_parqueo = :parqueo, fecha_esperada = TO_DATE(:fecha, 'YYYY-MM-DD'), token_qr = :token 
        WHERE id_visita = :idVisita`;
      await db.executeQuery(sqlUpdateVisita, { parqueo: numParqueo, fecha, token, idVisita: Number(idVisita) }, { autoCommit: true });
    } else {
      const sqlUpdateVisita = `
        UPDATE VISITA 
        SET estado = 'AUTORIZADA', numero_parqueo = :parqueo, token_qr = :token 
        WHERE id_visita = :idVisita`;
      await db.executeQuery(sqlUpdateVisita, { parqueo: numParqueo, token, idVisita: Number(idVisita) }, { autoCommit: true });
    }
    numParqueo++;
  }

  return { message: "Recursos asignados y parqueos configurados correctamente." };
};

/**
 * Enviar a Garita
 */
const enviarEventoAGarita = async (idEvento) => {
  const sqlUpEv = `UPDATE EVENTO_VISITA SET estado_aprobacion = 'ENVIADO_GARITA' WHERE id_evento = :idEvento`;
  await db.executeQuery(sqlUpEv, { idEvento: Number(idEvento) }, { autoCommit: true });

  const sqlUpVis = `UPDATE VISITA SET estado = 'AUTORIZADA' WHERE id_evento = :idEvento`;
  await db.executeQuery(sqlUpVis, { idEvento: Number(idEvento) }, { autoCommit: true });

  return { message: "Evento y lista masiva enviados exitosamente a Garita." };
};

/**
 * Registro de Garita
 */
const registrarAccesoGarita = async (token, tipoMovimiento, observacion, guardId) => {
  const sqlGetVisita = `SELECT id_visita FROM VISITA WHERE token_qr = :token AND estado IN ('AUTORIZADA', 'DENTRO')`;
  const result = await db.executeQuery(sqlGetVisita, { token });
  const visitas = result.rows || result.data || result || [];

  if (!visitas || visitas.length === 0) throw new Error("Pase QR no válido o expirado.");

  const visita = visitas[0];
  const idVisita = visita.ID_VISITA || visita.id_visita;

  if (tipoMovimiento === "ENTRADA") {
    const sqlUpdate = `UPDATE VISITA SET estado = 'DENTRO', fecha_entrada = SYSDATE WHERE id_visita = :idVisita`;
    await db.executeQuery(sqlUpdate, { idVisita: Number(idVisita) }, { autoCommit: true });
  } else {
    const sqlUpdate = `UPDATE VISITA SET estado = 'FINALIZADA', fecha_salida = SYSDATE WHERE id_visita = :idVisita`;
    await db.executeQuery(sqlUpdate, { idVisita: Number(idVisita) }, { autoCommit: true });
  }

  return { message: `Registro de ${tipoMovimiento} procesado exitosamente.` };
};

const aprobarVisita = async (idVisita) => {
  const token = crypto.randomUUID();
  const sqlUpdate = `UPDATE VISITA SET estado = 'AUTORIZADA', token_qr = :token WHERE id_visita = :idVisita`;
  await db.executeQuery(sqlUpdate, { token, idVisita: Number(idVisita) }, { autoCommit: true });
  return { message: "Visita aprobada exitosamente." };
};

const rechazarVisita = async (idVisita) => {
  const sqlUpdate = `UPDATE VISITA SET estado = 'DENEGADA' WHERE id_visita = :idVisita`;
  await db.executeQuery(sqlUpdate, { idVisita: Number(idVisita) }, { autoCommit: true });
  return { message: "Solicitud de visita rechazada." };
};

module.exports = {
  procesarEventoMasivo,
  cargarEventoExcel: procesarEventoMasivo,
  obtenerVisitas,
  crearVisitaIndividual,
  aprobarVisita,
  rechazarVisita,
  aprobarEvento,
  enviarEventoAGarita,
  registrarAccesoGarita,
};