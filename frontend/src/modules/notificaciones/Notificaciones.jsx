import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const OPCIONES_DESTINATARIO = [
  { value: "TODOS", label: "Todos los usuarios" },
  { value: "ADMINISTRADOR", label: "Administración del condominio", soloNoAdmin: true },
  { value: "CONDOMINOS", label: "Condóminos / residentes" },
  { value: "GARITA", label: "Garita / personal de seguridad" },
  { value: "ESPECIFICO", label: "Un usuario en específico" },
];

const FORMULARIO_BASE = {
  titulo: "",
  contenido: "",
  tipoDestinatario: "TODOS",
  idUsuarioDestino: "",
  canalEnvio: "APP",
  enviarWhatsApp: true,
};

function formatearFecha(valor) {
  if (!valor) return "Sin fecha";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? String(valor) : fecha.toLocaleDateString("es-GT");
}

function etiquetaDestinatario(item) {
  const tipo = String(
    item.TIPO_DESTINATARIO || item.tipo_destinatario || ""
  ).toUpperCase();
  const idCasa = item.ID_CASA_DESTINO || item.id_casa_destino;

  if (tipo === "ESPECIFICO") {
    return item.DESTINATARIO_USUARIO || "Usuario específico";
  }
  if (tipo === "ADMINISTRADOR") return "Administración";
  if (tipo === "CONDOMINOS") return "Condóminos / residentes";
  if (tipo === "GARITA") return "Garita / seguridad";
  if (idCasa) return `Casa #${item.NUMERO_CASA || idCasa}`;
  return "Todos los usuarios";
}

export default function Notificaciones() {
  const { user } = useAuth();
  const rolUsuario = String(user?.rol || user?.role || "").toUpperCase();
  const esAdministrador = ["ADMIN", "ADMINISTRADOR"].includes(rolUsuario);

  const [activeTab, setActiveTab] = useState("avisos");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensajeAlert, setMensajeAlert] = useState(null);

  const [comunicados, setComunicados] = useState([]);
  const [quejas, setQuejas] = useState([]);
  const [usuariosDestino, setUsuariosDestino] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  const [formData, setFormData] = useState({ ...FORMULARIO_BASE });

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    cargarUsuariosDestino();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      if (activeTab === "avisos") {
        const res = await api.get("/notificaciones");
        setComunicados(res.data.data || []);
      } else {
        const res = await api.get("/quejas");
        setQuejas(res.data.data || []);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setMensajeAlert({
        tipo: "error",
        texto: err.response?.data?.message || "No se pudo cargar la información.",
      });
    } finally {
      setLoading(false);
    }
  };

  const cargarUsuariosDestino = async () => {
    try {
      setCargandoUsuarios(true);
      const res = await api.get("/quejas/usuarios");
      setUsuariosDestino(res.data.data || []);
    } catch (err) {
      console.error("Error al cargar usuarios destinatarios:", err);
    } finally {
      setCargandoUsuarios(false);
    }
  };

  const abrirModal = () => {
    setMensajeAlert(null);
    setFormData({
      ...FORMULARIO_BASE,
      tipoDestinatario:
        activeTab === "quejas" && !esAdministrador ? "ADMINISTRADOR" : "TODOS",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim() || !formData.contenido.trim()) return;

    if (formData.tipoDestinatario === "ESPECIFICO" && !formData.idUsuarioDestino) {
      setMensajeAlert({
        tipo: "error",
        texto: "Seleccione el usuario específico que recibirá la comunicación.",
      });
      return;
    }

    const payloadBase = {
      tipoDestinatario: formData.tipoDestinatario,
      idUsuarioDestino:
        formData.tipoDestinatario === "ESPECIFICO"
          ? Number(formData.idUsuarioDestino)
          : null,
      canalEnvio: formData.canalEnvio,
      enviarWhatsApp: formData.enviarWhatsApp,
    };

    try {
      if (activeTab === "avisos") {
        if (!esAdministrador) {
          setMensajeAlert({
            tipo: "error",
            texto: "Solo la administración puede publicar avisos.",
          });
          return;
        }

        const res = await api.post("/notificaciones", {
          titulo: formData.titulo.trim(),
          contenido: formData.contenido.trim(),
          ...payloadBase,
        });
        setMensajeAlert({
          tipo: "exito",
          texto: res.data.message || "Comunicado publicado correctamente.",
        });
      } else {
        const res = await api.post("/quejas", {
          asunto: formData.titulo.trim(),
          descripcion: formData.contenido.trim(),
          idCasa: user?.casaId || null,
          ...payloadBase,
        });
        setMensajeAlert({
          tipo: "exito",
          texto:
            res.data.message || "Queja o sugerencia registrada correctamente.",
        });
      }

      setShowModal(false);
      setFormData({ ...FORMULARIO_BASE });
      await cargarDatos();
    } catch (err) {
      setMensajeAlert({
        tipo: "error",
        texto:
          err.response?.data?.message || "Error al procesar la solicitud.",
      });
    }
  };

  const opcionesDestinatario = OPCIONES_DESTINATARIO.filter(
    (opcion) => !(opcion.soloNoAdmin && esAdministrador)
  );

  const puedeCrear = activeTab === "quejas" || esAdministrador;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Comunicaciones del Condominio</h1>
          <p style={styles.subtitle}>
            Entérate de las novedades oficiales del residencial o envía tus
            inquietudes a la administración.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={cargarDatos}>
            Actualizar lista
          </button>
          {puedeCrear && (
            <button style={styles.btnPrimary} onClick={abrirModal}>
              {activeTab === "avisos"
                ? "+ Publicar Comunicado"
                : "+ Nueva Queja / Sugerencia"}
            </button>
          )}
        </div>
      </div>

      {mensajeAlert && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            backgroundColor:
              mensajeAlert.tipo === "exito" ? "#DCFCE7" : "#FEE2E2",
            color: mensajeAlert.tipo === "exito" ? "#166534" : "#991B1B",
          }}
        >
          {mensajeAlert.texto}
        </div>
      )}

      <div style={styles.tabsContainer}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "avisos" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("avisos")}
        >
          Avisos y Circulares
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "quejas" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("quejas")}
        >
          Buzón de Quejas y Sugerencias ({quejas.length})
        </button>
      </div>

      {activeTab === "avisos" ? (
        <>
          <div style={styles.filterBar}>
            <span style={styles.filterLabel}>Filtrar por categoría:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Todas">Todas</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Administración">Administración</option>
              <option value="General">General</option>
            </select>
          </div>

          {loading ? (
            <p style={styles.loadingText}>Cargando avisos...</p>
          ) : comunicados.length === 0 ? (
            <p style={styles.emptyState}>No hay avisos publicados por el momento.</p>
          ) : (
            <div style={styles.cardsGrid}>
              {comunicados.map((item) => (
                <div
                  key={item.ID_COMUNICADO}
                  style={{
                    ...styles.card,
                    borderLeft: `4px solid ${
                      item.ENVIAR_WHATSAPP === "SI" ||
                      item.CANAL_ENVIO === "WHATSAPP"
                        ? "#22C55E"
                        : item.CANAL_ENVIO === "EMAIL"
                        ? "#3B82F6"
                        : "#1B4B82"
                    }`,
                  }}
                >
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{item.TITULO}</h3>
                    <span style={styles.cardDate}>
                      {formatearFecha(item.FECHA_PUBLICACION)}
                    </span>
                  </div>
                  <p style={styles.cardContent}>{item.CONTENIDO}</p>
                  <div style={styles.cardFooterSpace}>
                    <div style={styles.badgeGroup}>
                      <span style={styles.categoryBadge}>
                        Canal: {item.CANAL_ENVIO || "APP"}
                      </span>
                      <span style={styles.destinatarioBadge}>
                        Dirigido a: {etiquetaDestinatario(item)}
                      </span>
                      {(item.ENVIAR_WHATSAPP === "SI" ||
                        ["WHATSAPP", "AMBOS", "TODOS"].includes(
                          item.CANAL_ENVIO
                        )) && (
                        <span style={styles.whatsappBadge}>WhatsApp</span>
                      )}
                    </div>
                    <span style={styles.autorText}>
                      Publicado por: {item.AUTOR || "Administración"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <p style={styles.loadingText}>Cargando quejas y sugerencias...</p>
          ) : quejas.length === 0 ? (
            <p style={styles.emptyState}>
              Aún no hay quejas o sugerencias registradas.
            </p>
          ) : (
            <div style={styles.cardsGrid}>
              {quejas.map((item) => (
                <div key={item.ID_QUEJA} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h3 style={styles.cardTitle}>{item.ASUNTO}</h3>
                      <span style={styles.cardSub}>
                        Reportado por{" "}
                        {item.NOMBRE_REPORTA ||
                          item.USUARIO_REPORTA ||
                          "Usuario"}
                        {item.NUMERO_CASA
                          ? ` · Casa #${item.NUMERO_CASA}`
                          : ""}
                      </span>
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor:
                          item.ESTADO === "RESUELTA" ? "#DCFCE7" : "#FEF3C7",
                        color:
                          item.ESTADO === "RESUELTA" ? "#166534" : "#92400E",
                      }}
                    >
                      {item.ESTADO || "PENDIENTE"}
                    </span>
                  </div>
                  <p style={styles.cardContent}>{item.DESCRIPCION}</p>
                  <div style={styles.cardFooterSpace}>
                    <div style={styles.badgeGroup}>
                      <span style={styles.destinatarioBadge}>
                        Dirigido a: {etiquetaDestinatario(item)}
                      </span>
                      {(item.ENVIAR_WHATSAPP === "SI" ||
                        ["WHATSAPP", "AMBOS", "TODOS"].includes(
                          item.CANAL_ENVIO
                        )) && (
                        <span style={styles.whatsappBadge}>WhatsApp</span>
                      )}
                    </div>
                    <span style={styles.cardDate}>
                      Fecha: {formatearFecha(item.FECHA_CREACION)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              {activeTab === "avisos"
                ? "Publicar Nuevo Comunicado"
                : "Registrar Queja o Sugerencia"}
            </h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {activeTab === "avisos"
                    ? "Título del Comunicado"
                    : "Asunto / Título"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder={
                    activeTab === "avisos"
                      ? "Ej: Mantenimiento de pozos"
                      : "Ej: Ruido en área común"
                  }
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Dirigido a</label>
                <select
                  value={formData.tipoDestinatario}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipoDestinatario: e.target.value,
                      idUsuarioDestino:
                        e.target.value === "ESPECIFICO"
                          ? formData.idUsuarioDestino
                          : "",
                    })
                  }
                  style={styles.input}
                >
                  {opcionesDestinatario.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
                {esAdministrador && (
                  <span style={styles.hint}>
                    La opción "Administración" no está disponible para el
                    administrador en sesión.
                  </span>
                )}
              </div>

              {formData.tipoDestinatario === "ESPECIFICO" && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Usuario destinatario</label>
                  <select
                    required
                    value={formData.idUsuarioDestino}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        idUsuarioDestino: e.target.value,
                      })
                    }
                    style={styles.input}
                    disabled={cargandoUsuarios}
                  >
                    <option value="">
                      {cargandoUsuarios
                        ? "Cargando usuarios..."
                        : "Seleccione un usuario"}
                    </option>
                    {usuariosDestino.map((usuario) => (
                      <option key={usuario.idUsuario} value={usuario.idUsuario}>
                        {usuario.nombreCompleto} — {usuario.rol}
                        {usuario.numeroCasa
                          ? ` (Casa #${usuario.numeroCasa})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {!cargandoUsuarios && usuariosDestino.length === 0 && (
                    <span style={styles.hint}>
                      No hay usuarios activos disponibles para seleccionar.
                    </span>
                  )}
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Canal de despacho</label>
                <select
                  value={formData.canalEnvio}
                  onChange={(e) =>
                    setFormData({ ...formData, canalEnvio: e.target.value })
                  }
                  style={styles.input}
                >
                  <option value="APP">Solo App</option>
                  <option value="EMAIL">Correo electrónico</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="AMBOS">Email + WhatsApp</option>
                  <option value="TODOS">Todos (App + Email + WhatsApp)</option>
                </select>
              </div>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={formData.enviarWhatsApp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enviarWhatsApp: e.target.checked,
                    })
                  }
                  style={styles.checkbox}
                />
                <span>Enviar también por WhatsApp</span>
              </label>
              <span style={styles.hint}>
                Se usará el teléfono registrado de cada destinatario. Si Twilio
                no está configurado, se omite el envío sin afectar el registro.
              </span>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {activeTab === "avisos"
                    ? "Contenido / Mensaje"
                    : "Descripción detallada"}
                </label>
                <textarea
                  required
                  rows="4"
                  maxLength={2000}
                  placeholder="Escribe el detalle aquí..."
                  value={formData.contenido}
                  onChange={(e) =>
                    setFormData({ ...formData, contenido: e.target.value })
                  }
                  style={{ ...styles.input, resize: "none" }}
                ></textarea>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  Guardar y Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { width: "100%", maxWidth: "1100px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px",
  },
  title: { fontSize: "24px", fontWeight: "700", color: "#0F172A", margin: "0 0 6px 0" },
  subtitle: { fontSize: "14px", color: "#64748B", margin: 0 },
  headerActions: { display: "flex", gap: "10px", flexWrap: "wrap" },
  btnPrimary: {
    backgroundColor: "#1B4B82",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 18px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnSecondary: {
    backgroundColor: "#F1F5F9",
    color: "#334155",
    border: "1px solid #CBD5E1",
    padding: "10px 18px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  tabsContainer: {
    display: "flex",
    gap: "32px",
    borderBottom: "1px solid #E2E8F0",
    marginBottom: "24px",
  },
  tab: {
    background: "none",
    border: "none",
    padding: "12px 0",
    fontSize: "15px",
    fontWeight: "600",
    color: "#64748B",
    cursor: "pointer",
    borderBottom: "3px solid transparent",
  },
  tabActive: { color: "#1B4B82", borderBottom: "3px solid #1B4B82" },
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  filterLabel: { fontSize: "14px", fontWeight: "600", color: "#334155" },
  selectInput: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #CBD5E1",
    backgroundColor: "#FFFFFF",
    fontSize: "14px",
    color: "#1E293B",
  },
  cardsGrid: { display: "flex", flexDirection: "column", gap: "16px" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    border: "1px solid #E2E8F0",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "10px",
  },
  cardTitle: { fontSize: "16px", fontWeight: "700", color: "#0F172A", margin: "0 0 4px 0" },
  cardSub: { fontSize: "12px", color: "#64748B" },
  cardDate: { fontSize: "12px", color: "#94A3B8" },
  cardContent: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: "1.5",
    margin: "0 0 14px 0",
    whiteSpace: "pre-wrap",
  },
  cardFooterSpace: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    borderTop: "1px solid #F1F5F9",
    paddingTop: "12px",
    flexWrap: "wrap",
  },
  badgeGroup: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  categoryBadge: {
    fontSize: "12px",
    fontWeight: "500",
    backgroundColor: "#F1F5F9",
    color: "#475569",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  destinatarioBadge: {
    fontSize: "12px",
    fontWeight: "500",
    backgroundColor: "#EEF4FB",
    color: "#1B4B82",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  whatsappBadge: {
    fontSize: "11px",
    fontWeight: "700",
    backgroundColor: "#DCFCE7",
    color: "#166534",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  destinatarioText: { fontSize: "12px", color: "#64748B", fontWeight: "500" },
  autorText: { fontSize: "12px", color: "#64748B" },
  statusBadge: {
    fontSize: "11px",
    fontWeight: "700",
    padding: "4px 10px",
    borderRadius: "12px",
    textTransform: "uppercase",
  },
  loadingText: { color: "#64748B", fontSize: "14px" },
  emptyState: {
    color: "#64748B",
    fontSize: "14px",
    padding: "24px",
    backgroundColor: "#FFFFFF",
    border: "1px dashed #CBD5E1",
    borderRadius: "10px",
    textAlign: "center",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    padding: "28px",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "560px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 20px 0" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#334155" },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #CBD5E1",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#FFFFFF",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#334155",
    cursor: "pointer",
  },
  checkbox: { width: "18px", height: "18px", cursor: "pointer" },
  hint: { fontSize: "12px", color: "#64748B", lineHeight: "1.4" },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "12px",
  },
};
