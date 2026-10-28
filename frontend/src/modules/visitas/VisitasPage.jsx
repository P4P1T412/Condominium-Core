import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function VisitasPage() {
  const { user } = useAuth();

  // Normalización de Roles
  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const esAdmin = rolUpper === "ADMIN" || rolUpper === "ADMINISTRADOR";
  const esGarita = rolUpper === "GARITA";
  const esResidente = rolUpper === "RESIDENTE" || rolUpper === "CONDOMINO";

  // Pestaña activa
  const [activeTab, setActiveTab] = useState(esGarita ? "eventos" : "individuales");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState(null);

  // Estados de datos
  const [visitas, setVisitas] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [listaCasas, setListaCasas] = useState([]);

  // Estado para desplegar/colapsar eventos por id_evento
  const [eventosDesplegados, setEventosDesplegados] = useState({});

  // Formulario Carga Masiva (Excel)
  const [tipoEvento, setTipoEvento] = useState("Cumpleaños");
  const [otroEvento, setOtroEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [salonSeleccionado, setSalonSeleccionado] = useState("Salón Social 1");
  const [archivoExcel, setArchivoExcel] = useState(null);

  // Modal de Configuración / Autorización para Administración
  const [eventoParaAprobar, setEventoParaAprobar] = useState(null);
  const [fechaAprobacion, setFechaAprobacion] = useState("");
  const [salonAprobacion, setSalonAprobacion] = useState("Salón Social 1");
  const [rangoParqueoInicio, setRangoParqueoInicio] = useState(1);

  // Modal para Agregar Visita Extra a un Evento Específico
  const [eventoParaAgregarInvitado, setEventoParaAgregarInvitado] = useState(null);
  const [extraInvitadoData, setExtraInvitadoData] = useState({
    nombre: "",
    dpi: "",
    placa: "",
    correo: "",
  });

  // Formulario Visita Individual
  const [formData, setFormData] = useState({
    nombre: "",
    dpi: "",
    placa: "",
    correo: "",
    casaId: user?.casaId || user?.id_casa || "",
    fecha: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    cargarDatos();
    cargarCasas();
  }, []);

  const toggleDesplegarEvento = (idEvento) => {
    setEventosDesplegados((prev) => ({
      ...prev,
      [idEvento]: !prev[idEvento],
    }));
  };

  const cargarCasas = async () => {
    try {
      const res = await api.get("/casas");
      const casasData = res.data?.data || res.data || [];
      setListaCasas(casasData);

      if ((esAdmin || esGarita) && casasData.length > 0 && !formData.casaId) {
        const primera = casasData[0];
        setFormData((prev) => ({
          ...prev,
          casaId: primera.ID_CASA || primera.id_casa || primera.id || 1,
        }));
      }
    } catch (err) {
      console.warn("Aviso al cargar casas:", err.message);
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setMensaje(null);

      const res = await api.get("/visitas");
      let list = [];

      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      }

      const getEstado = (item) => String(item.ESTADO || item.estado || "").toUpperCase();

      // Pestaña Visitas: Pendientes o Autorizadas que aún no están DENTRO de la residencia
      setVisitas(list.filter((item) => getEstado(item) !== "FINALIZADA" && getEstado(item) !== "DENEGADA" && getEstado(item) !== "DENTRO"));
      
      // Pestaña Bitácora: Visitantes con ingreso registrado en Garita
      setBitacora(list.filter((item) => getEstado(item) === "DENTRO" || getEstado(item) === "FINALIZADA"));
    } catch (err) {
      console.error("Error al cargar las visitas:", err);
      setMensaje({ tipo: "error", texto: "Error al conectar con el servidor." });
    } finally {
      setLoading(false);
    }
  };

  // Subir Carga Masiva (Excel)
  const handleSubirExcel = async (e) => {
    e.preventDefault();
    if (!archivoExcel || !fechaEvento) {
      setMensaje({ tipo: "error", texto: "Complete la fecha del evento y adjunte el archivo Excel." });
      return;
    }

    if (tipoEvento === "Otros" && !otroEvento.trim()) {
      setMensaje({ tipo: "error", texto: "Especifique el nombre del evento al seleccionar 'Otros'." });
      return;
    }

    const tituloFinalEvento = tipoEvento === "Otros" ? otroEvento.trim() : tipoEvento;

    const payload = new FormData();
    payload.append("nombreEvento", tituloFinalEvento);
    payload.append("tipoEvento", tipoEvento);
    payload.append("otroEvento", otroEvento.trim());
    payload.append("fechaEvento", fechaEvento);
    payload.append("salon", salonSeleccionado);
    payload.append("archivoExcel", archivoExcel);

    try {
      setMensaje(null);
      const res = await api.post("/visitas/evento-masivo", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMensaje({ tipo: "exito", texto: res.data.message || "Evento registrado correctamente." });
      setTipoEvento("Cumpleaños");
      setOtroEvento("");
      setFechaEvento("");
      setArchivoExcel(null);
      setActiveTab("eventos");
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al procesar el archivo Excel." });
    }
  };

  // Agregar una Visita / Invitado Extra a un Evento Existente
  const handleAgregarInvitadoExtra = async (e) => {
    e.preventDefault();
    if (!eventoParaAgregarInvitado || !extraInvitadoData.nombre || !extraInvitadoData.dpi) return;

    try {
      setMensaje(null);
      const res = await api.post("/visitas", {
        nombreVisitante: extraInvitadoData.nombre,
        identificacion: extraInvitadoData.dpi,
        placaVehiculo: extraInvitadoData.placa,
        correoVisitante: extraInvitadoData.correo,
        fechaEsperada: eventoParaAgregarInvitado.fecha,
        casaId: user?.casaId || user?.id_casa || 1,
        idEvento: Number(eventoParaAgregarInvitado.id_evento),
      });

      setMensaje({
        tipo: "exito",
        texto: esAdmin
          ? "Visita extra agregada y autorizada al evento exitosamente."
          : "Solicitud de invitado extra enviada a Administración para su aprobación.",
      });

      setEventoParaAgregarInvitado(null);
      setExtraInvitadoData({ nombre: "", dpi: "", placa: "", correo: "" });
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al agregar la visita extra al evento." });
    }
  };

  // Modal de Administración: Asignar Fecha, Salón y Rango de Parqueos
  const handleConfirmarAprobarEvento = async () => {
    if (!eventoParaAprobar) return;
    try {
      const res = await api.put(`/visitas/eventos/${eventoParaAprobar.id_evento}/aprobar`, {
        fecha: fechaAprobacion,
        salon: salonAprobacion,
        parqueoInicio: Number(rangoParqueoInicio),
      });

      setMensaje({ tipo: "exito", texto: res.data.message || "Recursos asignados y parqueos configurados." });
      setEventoParaAprobar(null);
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al configurar los recursos del evento." });
    }
  };

  // Enviar Visita Masiva a Garita
  const handleEnviarAGarita = async (idEvento) => {
    try {
      const res = await api.put(`/visitas/eventos/${idEvento}/enviar-garita`);
      setMensaje({ tipo: "exito", texto: res.data.message || "Evento enviado exitosamente a la Garita." });
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al enviar el evento a Garita." });
    }
  };

  // Garita: Registrar Ingreso Individual
  const handleRegistrarIngresoIndividual = async (item) => {
    try {
      const token = item.TOKEN_QR || item.token_qr;
      await api.post("/visitas/garita/acceso", {
        token,
        tipoMovimiento: "ENTRADA",
        observacion: "Ingreso registrado por Garita",
      });
      setMensaje({ tipo: "exito", texto: "Ingreso registrado exitosamente. Se trasladó a la Bitácora." });
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al registrar el ingreso." });
    }
  };

  // Garita: Registrar Salida
  const handleRegistrarSalida = async (idVisita, tokenQr) => {
    try {
      await api.post("/visitas/garita/acceso", {
        token: tokenQr,
        tipoMovimiento: "SALIDA",
        observacion: "Salida registrada por Garita",
      });
      setMensaje({ tipo: "exito", texto: "Salida registrada exitosamente." });
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al marcar la salida." });
    }
  };

  // Guardar Visita Individual General
  const handleSubmitVisitaIndividual = async (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.dpi) return;

    try {
      setMensaje(null);
      const casaDestino = formData.casaId || user?.casaId || user?.id_casa || 1;

      const res = await api.post("/visitas", {
        nombreVisitante: formData.nombre,
        identificacion: formData.dpi,
        placaVehiculo: formData.placa,
        correoVisitante: formData.correo,
        fechaEsperada: formData.fecha,
        casaId: Number(casaDestino),
      });

      setMensaje({ tipo: "exito", texto: res.data?.message || "Visita autorizada correctamente." });
      setShowModal(false);
      setFormData({
        nombre: "",
        dpi: "",
        placa: "",
        correo: "",
        casaId: listaCasas[0]?.ID_CASA || 1,
        fecha: new Date().toISOString().split("T")[0],
      });
      cargarDatos();
    } catch (err) {
      setMensaje({ tipo: "error", texto: "Error al registrar la visita." });
    }
  };

  // AGRUPACIÓN Y FILTRADO POR EVENTO SEGÚN ROL
  const eventosAgrupados = {};
  const visitasIndividuales = [];

  visitas.forEach((v) => {
    const rawIdEv = v.ID_EVENTO ?? v.id_evento;
    const idEv = rawIdEv ? String(rawIdEv) : null;

    if (idEv && idEv !== "null" && idEv !== "undefined") {
      const estadoEv = String(v.ESTADO_EVENTO || v.estado_evento || "").toUpperCase();

      // GARITA solo debe ver eventos con estado ENVIADO_GARITA o APROBADO
      if (esGarita && estadoEv !== "ENVIADO_GARITA" && estadoEv !== "APROBADO") {
        return;
      }

      if (!eventosAgrupados[idEv]) {
        eventosAgrupados[idEv] = {
          id_evento: idEv,
          nombre_evento: v.NOMBRE_EVENTO || v.nombre_evento || `Evento #${idEv}`,
          salon: v.SALON_ASIGNADO || v.salon_asignado || "Salón Social 1",
          condomino: v.NOMBRE_CONDOMINO || v.nombre_condomino || "Residente",
          casa: v.NUMERO_CASA || v.numero_casa || "N/A",
          fecha: v.FECHA_ESPERADA || v.fecha_esperada,
          estado_evento: estadoEv,
          invitados: [],
        };
      }
      eventosAgrupados[idEv].invitados.push(v);
    } else {
      visitasIndividuales.push(v);
    }
  });

  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Control de Visitas y Garita</h1>
          <p style={styles.subtitle}>
            {esGarita
              ? "Control de acceso e ingresos en garita por eventos o visitas individuales."
              : esResidente
              ? "Gestión de visitas y eventos de su residencia."
              : "Administración global de accesos, salones y asignación de parqueos."}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={cargarDatos}>
            Actualizar lista
          </button>
          <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>
            + {esGarita ? "Registrar Visita Express" : "Pre-autorizar Visita"}
          </button>
        </div>
      </div>

      {/* Alerta de Respuesta */}
      {mensaje && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "8px",
            backgroundColor: mensaje.tipo === "exito" ? "#DCFCE7" : "#FEE2E2",
            color: mensaje.tipo === "exito" ? "#166534" : "#991B1B",
            fontWeight: "600",
            fontSize: "14px",
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Pestañas de Navegación */}
      <div style={styles.tabsContainer}>
        <button
          style={{ ...styles.tab, ...(activeTab === "individuales" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("individuales")}
        >
          👤 Visitas Individuales ({visitasIndividuales.length})
        </button>

        <button
          style={{ ...styles.tab, ...(activeTab === "eventos" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("eventos")}
        >
          🎉 Visitas para Eventos ({Object.keys(eventosAgrupados).length})
        </button>

        <button
          style={{ ...styles.tab, ...(activeTab === "bitacora" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("bitacora")}
        >
          📋 Bitácora de Accesos ({bitacora.length})
        </button>

        {!esGarita && (
          <button
            style={{ ...styles.tab, ...(activeTab === "excel" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("excel")}
          >
            📁 Carga Masiva (Excel)
          </button>
        )}
      </div>

      {/* PESTAÑA 1: VISITAS INDIVIDUALES */}
      {activeTab === "individuales" && (
        <>
          <div style={styles.infoSummary}>
            Visitas individuales autorizadas / programadas: <strong>{visitasIndividuales.length} registros</strong>
          </div>

          {loading ? (
            <p style={{ color: "#64748B" }}>Cargando datos...</p>
          ) : visitasIndividuales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
              <p>No hay visitas individuales pendientes de ingreso.</p>
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {visitasIndividuales.map((item) => {
                const idVisita = item.ID_VISITA || item.id_visita;
                const nombreVisitante = item.NOMBRE_VISITANTE || item.nombre_visitante;
                const identificacion = item.IDENTIFICACION || item.identificacion;
                const estado = String(item.ESTADO || item.estado || "").toUpperCase();
                const numeroCasa = item.NUMERO_CASA || item.numero_casa;
                const condomino = item.NOMBRE_CONDOMINO || item.nombre_condomino || "Condómino";
                const placaVehiculo = item.PLACA_VEHICULO || item.placa_vehiculo;
                const fechaEsperada = item.FECHA_ESPERADA || item.fecha_esperada;

                return (
                  <div key={idVisita} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{nombreVisitante}</h3>
                        <span style={styles.cardSub}>DPI: {identificacion || "N/A"}</span>
                      </div>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: estado === "AUTORIZADA" ? "#DCFCE7" : "#FEF3C7",
                          color: estado === "AUTORIZADA" ? "#166534" : "#92400E",
                        }}
                      >
                        {estado}
                      </span>
                    </div>

                    <div style={styles.cardBody}>
                      <div style={styles.dataRow}>
                        <span style={styles.label}>Casa Destino:</span>
                        <span style={styles.value}>{numeroCasa ? `Casa ${numeroCasa}` : "N/A"}</span>
                      </div>
                      <div style={styles.dataRow}>
                        <span style={styles.label}>Condómino:</span>
                        <span style={styles.value}>{condomino}</span>
                      </div>
                      <div style={styles.dataRow}>
                        <span style={styles.label}>Vehículo / Placa:</span>
                        <span style={styles.value}>{placaVehiculo || "N/A"}</span>
                      </div>
                      <div style={styles.dataRow}>
                        <span style={styles.label}>Fecha Esperada:</span>
                        <span style={styles.value}>{fechaEsperada || "--"}</span>
                      </div>
                    </div>

                    <div style={styles.cardFooter}>
                      {(esGarita || esAdmin) && estado === "AUTORIZADA" && (
                        <button style={styles.actionBtnPrimary} onClick={() => handleRegistrarIngresoIndividual(item)}>
                          Registrar Ingreso
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PESTAÑA 2: VISITAS PARA EVENTOS */}
      {activeTab === "eventos" && (
        <>
          <div style={styles.infoSummary}>
            Eventos registrados: <strong>{Object.keys(eventosAgrupados).length} eventos activos</strong>
          </div>

          {loading ? (
            <p style={{ color: "#64748B" }}>Cargando eventos...</p>
          ) : Object.keys(eventosAgrupados).length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
              <p>No hay eventos o cargas masivas registrados actualmente.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {Object.values(eventosAgrupados).map((ev) => {
                const estaAbierto = !!eventosDesplegados[ev.id_evento];
                const tieneParqueosAsignados = ev.invitados.some((i) => (i.NUMERO_PARQUEO || i.numero_parqueo));

                return (
                  <div key={ev.id_evento} style={styles.eventBox}>
                    {/* ENCABEZADO DEL EVENTO */}
                    <div
                      style={styles.eventBoxHeader}
                      onClick={() => toggleDesplegarEvento(ev.id_evento)}
                    >
                      <div>
                        <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A", fontWeight: "700" }}>
                          🎉 {ev.nombre_evento} — <span style={{ color: "#1B4B82" }}>📍 {ev.salon}</span>
                        </h3>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748B" }}>
                          Solicitado por: <strong>{ev.condomino}</strong> (Casa: <strong>{ev.casa}</strong>) | Fecha: <strong>{ev.fecha}</strong> | <strong>{ev.invitados.length} invitados</strong>
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                        {/* BOTÓN PARA CONDÓMINO / ADMIN */}
                        {!esGarita && (
                          <button
                            onClick={() => setEventoParaAgregarInvitado(ev)}
                            style={styles.btnAgregarExtra}
                          >
                            ➕ {esAdmin ? "Agregar Visita Extra" : "Agregar Invitado Extra"}
                          </button>
                        )}

                        {/* SOLO ADMIN: Botón para abrir Modal de Configuración / Autorización */}
                        {esAdmin && (
                          <button
                            onClick={() => {
                              setEventoParaAprobar(ev);
                              setFechaAprobacion(ev.fecha || "");
                              setSalonAprobacion(ev.salon || "Salón Social 1");
                            }}
                            style={styles.btnAprobarEvento}
                          >
                            ⚙️ Autorizar Evento / Configurar Parqueos
                          </button>
                        )}

                        {/* SOLO ADMIN: Botón 'Enviar visita masiva a garita' */}
                        {esAdmin && tieneParqueosAsignados && ev.estado_evento !== "ENVIADO_GARITA" && (
                          <button
                            onClick={() => handleEnviarAGarita(ev.id_evento)}
                            style={{ ...styles.btnAprobarEvento, backgroundColor: "#1B4B82" }}
                          >
                            🚀 Enviar visita masiva a Garita
                          </button>
                        )}

                        <span style={{ fontSize: "18px", color: "#64748B", cursor: "pointer", marginLeft: "8px" }}>
                          {estaAbierto ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {/* LISTADO DE INVITADOS (SOLO SI SE DESPLIEGA) */}
                    {estaAbierto && (
                      <div style={styles.eventBoxBody}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <h4 style={{ margin: 0, color: "#334155", fontSize: "14px" }}>
                            Listado de Invitados ({ev.invitados.length}):
                          </h4>
                          {!esGarita && (
                            <button
                              onClick={() => setEventoParaAgregarInvitado(ev)}
                              style={{ ...styles.btnAgregarExtra, padding: "4px 10px", fontSize: "12px" }}
                            >
                              + {esAdmin ? "Agregar Visita a este Evento" : "Agregar Invitado a este Evento"}
                            </button>
                          )}
                        </div>

                        <div style={styles.cardsGrid}>
                          {ev.invitados.map((item) => {
                            const idVisita = item.ID_VISITA || item.id_visita;
                            const estado = String(item.ESTADO || item.estado || "").toUpperCase();
                            const parqueo = item.NUMERO_PARQUEO || item.numero_parqueo;

                            return (
                              <div key={idVisita} style={styles.card}>
                                <div style={styles.cardHeader}>
                                  <div>
                                    <h3 style={styles.cardTitle}>{item.NOMBRE_VISITANTE || item.nombre_visitante}</h3>
                                    <span style={styles.cardSub}>DPI: {item.IDENTIFICACION || item.identificacion || "N/A"}</span>
                                  </div>
                                  <span
                                    style={{
                                      ...styles.badge,
                                      backgroundColor: estado === "AUTORIZADA" ? "#DCFCE7" : "#FEF3C7",
                                      color: estado === "AUTORIZADA" ? "#166534" : "#92400E",
                                    }}
                                  >
                                    {estado}
                                  </span>
                                </div>

                                <div style={styles.cardBody}>
                                  <div style={styles.dataRow}>
                                    <span style={styles.label}>Placa Vehículo:</span>
                                    <span style={styles.value}>{item.PLACA_VEHICULO || item.placa_vehiculo || "N/A"}</span>
                                  </div>
                                  <div style={styles.dataRow}>
                                    <span style={styles.label}>Nº Parqueo:</span>
                                    <span style={{ color: parqueo ? "#166534" : "#94A3B8", fontWeight: "700" }}>
                                      {parqueo ? `🅿️ Parqueo #${parqueo}` : "Sin asignación"}
                                    </span>
                                  </div>
                                </div>

                                {esGarita && estado === "AUTORIZADA" && (
                                  <button style={styles.actionBtnPrimary} onClick={() => handleRegistrarIngresoIndividual(item)}>
                                    Registrar Ingreso
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PESTAÑA 3: BITÁCORA */}
      {activeTab === "bitacora" && (
        <div style={styles.tableCard}>
          {bitacora.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
              <p>No hay accesos registrados en la bitácora actualmente.</p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>Visitante</th>
                  <th style={styles.th}>DPI / Identificación</th>
                  <th style={styles.th}>Casa / Evento</th>
                  <th style={styles.th}>Hora Entrada</th>
                  <th style={styles.th}>Hora Salida</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {bitacora.map((row) => {
                  const idVisita = row.ID_VISITA || row.id_visita;
                  const nombreVisitante = row.NOMBRE_VISITANTE || row.nombre_visitante;
                  const identificacion = row.IDENTIFICACION || row.identificacion;
                  const fechaEntrada = row.FECHA_ENTRADA || row.fecha_entrada;
                  const fechaSalida = row.FECHA_SALIDA || row.fecha_salida;
                  const estado = String(row.ESTADO || row.estado || "").toUpperCase();
                  const tokenQr = row.TOKEN_QR || row.token_qr;
                  const numeroCasa = row.NUMERO_CASA || row.numero_casa;
                  const nombreEv = row.NOMBRE_EVENTO || row.nombre_evento;

                  return (
                    <tr key={idVisita} style={styles.tableRow}>
                      <td style={{ ...styles.td, fontWeight: "600", color: "#0F172A" }}>{nombreVisitante}</td>
                      <td style={styles.td}>{identificacion || "N/A"}</td>
                      <td style={styles.td}>{nombreEv ? `🎉 ${nombreEv}` : numeroCasa ? `Casa ${numeroCasa}` : "N/A"}</td>
                      <td style={styles.td}>{fechaEntrada || "--"}</td>
                      <td style={styles.td}>{fechaSalida || "En residencia"}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: estado === "DENTRO" ? "#DCFCE7" : "#F1F5F9",
                            color: estado === "DENTRO" ? "#166534" : "#475569",
                          }}
                        >
                          {estado}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {estado === "DENTRO" && (esGarita || esAdmin) ? (
                          <button style={styles.btnSalida} onClick={() => handleRegistrarSalida(idVisita, tokenQr)}>
                            Marcar Salida
                          </button>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94A3B8" }}>Completado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PESTAÑA 4: CARGA MASIVA EXCEL */}
      {activeTab === "excel" && !esGarita && (
        <div style={styles.formContainerCenter}>
          <div style={styles.formCard}>
            <h2 style={styles.modalTitle}>Subir Lista de Invitados para Evento (Excel)</h2>
            <form onSubmit={handleSubirExcel} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Tipo / Nombre del Evento (*)</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  style={styles.input}
                >
                  <option value="Cumpleaños">Cumpleaños</option>
                  <option value="Boda">Boda</option>
                  <option value="Conferencia">Conferencia / Charla</option>
                  <option value="15 Años">15 Años / Quinceañera</option>
                  <option value="Funeral">Funeral / In Memoriam</option>
                  <option value="Baby Shower">Baby Shower</option>
                  <option value="Reunión Familiar">Reunión Familiar</option>
                  <option value="Misa / Religioso">Misa / Evento Religioso</option>
                  <option value="Graduación">Graduación</option>
                  <option value="Convivio">Convivio / Fiesta de Fin de Año</option>
                  <option value="Partido">Partido / Torneo Deportivo</option>
                  <option value="Otros">Otros (Especificar)</option>
                </select>
              </div>

              {tipoEvento === "Otros" && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Especifique el Nombre del Evento (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Aniversario de Bodas / Torneo de Tenis"
                    value={otroEvento}
                    onChange={(e) => setOtroEvento(e.target.value)}
                    style={styles.input}
                  />
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Fecha Requerida para el Evento (*)</label>
                <input
                  type="date"
                  required
                  value={fechaEvento}
                  onChange={(e) => setFechaEvento(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Área o Salón Requerido (*)</label>
                <select
                  value={salonSeleccionado}
                  onChange={(e) => setSalonSeleccionado(e.target.value)}
                  style={styles.input}
                >
                  <option value="Salón Social 1">Salón Social 1 (Capacidad 50 parqueos)</option>
                  <option value="Salón Social 2">Salón Social 2 (Capacidad 30 parqueos)</option>
                  <option value="Área de Jardines">Área de Jardines y Piscina</option>
                  <option value="Cancha Deportiva">Cancha Deportiva / Polideportivo</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Archivo Excel con Lista de Invitados (*)</label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  required
                  onChange={(e) => setArchivoExcel(e.target.files[0])}
                  style={styles.input}
                />
              </div>

              <button type="submit" style={{ ...styles.btnPrimary, width: "100%", marginTop: "10px" }}>
                Procesar Carga Masiva
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR VISITA EXTRA A UN EVENTO ESPECÍFICO */}
      {eventoParaAgregarInvitado && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              ➕ {esAdmin ? "Agregar Visita Extra a" : "Agregar Invitado a"} "{eventoParaAgregarInvitado.nombre_evento}"
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
              Se agregará a la lista del evento del <strong>{eventoParaAgregarInvitado.fecha}</strong>.
            </p>

            <form onSubmit={handleAgregarInvitadoExtra} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nombre Completo de la Visita (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Fernando López"
                  value={extraInvitadoData.nombre}
                  onChange={(e) => setExtraInvitadoData({ ...extraInvitadoData, nombre: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>DPI / Identificación (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2990182730101"
                  value={extraInvitadoData.dpi}
                  onChange={(e) => setExtraInvitadoData({ ...extraInvitadoData, dpi: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Placa del Vehículo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: P-120XYZ"
                  value={extraInvitadoData.placa}
                  onChange={(e) => setExtraInvitadoData({ ...extraInvitadoData, placa: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  placeholder="visitante@correo.com"
                  value={extraInvitadoData.correo}
                  onChange={(e) => setExtraInvitadoData({ ...extraInvitadoData, correo: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setEventoParaAgregarInvitado(null)}
                  style={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  {esAdmin ? "Agregar Visita a Evento" : "Enviar Solicitud a Administración"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN / AUTORIZACIÓN DE EVENTO POR ADMINISTRACIÓN */}
      {eventoParaAprobar && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Autorizar Evento y Asignar Recursos</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
              Evento: <strong>{eventoParaAprobar.nombre_evento}</strong> ({eventoParaAprobar.invitados.length} invitados)
            </p>

            <div style={styles.formGroup}>
              <label style={styles.label}>Fecha del Evento (*)</label>
              <input
                type="date"
                value={fechaAprobacion}
                onChange={(e) => setFechaAprobacion(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={{ ...styles.formGroup, marginTop: "12px" }}>
              <label style={styles.label}>Confirmar Área / Salón a Alquilar (*)</label>
              <select
                value={salonAprobacion}
                onChange={(e) => setSalonAprobacion(e.target.value)}
                style={styles.input}
              >
                <option value="Salón Social 1">Salón Social 1</option>
                <option value="Salón Social 2">Salón Social 2</option>
                <option value="Área de Jardines">Área de Jardines y Piscina</option>
                <option value="Cancha Deportiva">Cancha Deportiva / Polideportivo</option>
              </select>
            </div>

            <div style={{ ...styles.formGroup, marginTop: "12px" }}>
              <label style={styles.label}>Número de Parqueo Inicial a Asignar (*)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={rangoParqueoInicio}
                onChange={(e) => setRangoParqueoInicio(e.target.value)}
                style={styles.input}
              />
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Se asignará desde el parqueo #{rangoParqueoInicio} hasta el #{Number(rangoParqueoInicio) + eventoParaAprobar.invitados.length - 1} correlativamente.
              </span>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setEventoParaAprobar(null)} style={styles.btnSecondary}>
                Cancelar
              </button>
              <button onClick={handleConfirmarAprobarEvento} style={styles.btnAprobarEvento}>
                Aceptar / Confirmar Recursos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISITA INDIVIDUAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              {esGarita ? "Registro Express en Garita" : "Pre-autorizar Visita Individual"}
            </h2>
            <form onSubmit={handleSubmitVisitaIndividual} style={styles.form}>
              {(esAdmin || esGarita) && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Casa Destino y Condómino (*)</label>
                  <select
                    required
                    value={formData.casaId}
                    onChange={(e) => setFormData({ ...formData, casaId: e.target.value })}
                    style={styles.input}
                  >
                    <option value="">-- Seleccionar Casa / Condómino --</option>
                    {listaCasas.map((c) => {
                      const idCasaVal = c.ID_CASA || c.id_casa || c.id;
                      const numCasaVal = c.NUMERO_CASA || c.numero_casa || c.numeroCasa;
                      const condomino = c.NOMBRE_CONDOMINO || c.nombre_condomino || "Propietario";

                      return (
                        <option key={idCasaVal} value={idCasaVal}>
                          Casa {numCasaVal || idCasaVal} ({condomino})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Nombre del Visitante (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Manuel Morales"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>DPI / Identificación (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 2390182730101"
                  value={formData.dpi}
                  onChange={(e) => setFormData({ ...formData, dpi: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Placa del Vehículo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: P-450FGH"
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  placeholder="visitante@correo.com"
                  value={formData.correo}
                  onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fecha Esperada</label>
                <input
                  type="date"
                  required
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  {esAdmin || esGarita ? "Guardar y Registrar Visita" : "Enviar Solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos
const styles = {
  container: { width: "100%", maxWidth: "1100px", margin: "0 auto", fontFamily: "Segoe UI, system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "24px", fontWeight: "700", color: "#0F172A", margin: "0 0 6px 0" },
  subtitle: { fontSize: "14px", color: "#64748B", margin: 0 },
  headerActions: { display: "flex", gap: "10px" },
  btnPrimary: { backgroundColor: "#1B4B82", color: "#FFFFFF", border: "none", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  btnSecondary: { backgroundColor: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  btnAprobarEvento: { backgroundColor: "#16A34A", color: "#FFFFFF", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "13px" },
  btnAgregarExtra: { backgroundColor: "#0EA5E9", color: "#FFFFFF", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "13px" },
  tabsContainer: { display: "flex", gap: "28px", borderBottom: "1px solid #E2E8F0", marginBottom: "20px" },
  tab: { background: "none", border: "none", padding: "12px 0", fontSize: "15px", fontWeight: "600", color: "#64748B", cursor: "pointer", borderBottom: "3px solid transparent" },
  tabActive: { color: "#1B4B82", borderBottom: "3px solid #1B4B82" },
  infoSummary: { fontSize: "14px", color: "#475569", marginBottom: "20px" },
  eventBox: { border: "1px solid #CBD5E1", borderRadius: "12px", backgroundColor: "#FFFFFF", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  eventBoxHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", cursor: "pointer" },
  eventBoxBody: { padding: "20px", borderTop: "1px solid #E2E8F0" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "18px" },
  card: { backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" },
  cardTitle: { fontSize: "14px", fontWeight: "700", color: "#0F172A", margin: "0 0 2px 0" },
  cardSub: { fontSize: "12px", color: "#64748B" },
  badge: { fontSize: "11px", fontWeight: "700", padding: "4px 8px", borderRadius: "12px", textTransform: "uppercase" },
  cardBody: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" },
  dataRow: { display: "flex", justifyContent: "space-between", fontSize: "13px" },
  label: { color: "#64748B" },
  value: { color: "#1E293B", fontWeight: "600" },
  cardFooter: { display: "flex", gap: "10px" },
  actionBtnPrimary: { flex: 1, backgroundColor: "#1B4B82", color: "#FFFFFF", border: "none", padding: "8px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "13px", cursor: "pointer" },
  tableCard: { backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" },
  tableHeaderRow: { backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" },
  th: { padding: "14px 16px", fontWeight: "600", color: "#475569", fontSize: "13px" },
  tableRow: { borderBottom: "1px solid #F1F5F9" },
  td: { padding: "14px 16px", color: "#334155" },
  btnSalida: { backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "12px", cursor: "pointer" },
  formContainerCenter: { display: "flex", justifyContent: "center", width: "100%" },
  formCard: { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "520px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#FFFFFF", padding: "28px", borderRadius: "12px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 20px 0" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" },
};