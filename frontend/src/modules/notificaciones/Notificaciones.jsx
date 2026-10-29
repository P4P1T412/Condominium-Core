import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export default function Notificaciones() {
  const { user } = useAuth(); // { id, nombre, rol, casaId }

  const [activeTab, setActiveTab] = useState("avisos");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensajeAlert, setMensajeAlert] = useState(null);

  // Listas con estado persistido desde backend
  const [comunicados, setComunicados] = useState([]);
  const [quejas, setQuejas] = useState([]);

  // Formulario adaptado para Comunicados Multicanal / Quejas
  const [formData, setFormData] = useState({
    titulo: "",
    contenido: "",
    categoria: "General",
    tipoDestino: "GLOBAL", // 'GLOBAL', 'CASA', 'INDIVIDUAL'
    idCasaDestino: "",
    idUsuarioDestino: "",
    canalEnvio: "TODOS", // 'APP', 'EMAIL', 'WHATSAPP', 'AMBOS', 'TODOS'
  });

  useEffect(() => {
    cargarDatos();
  }, [activeTab]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      if (activeTab === "avisos") {
        const res = await api.get("/notificaciones");
        const lista = res.data?.data || res.data || [];
        setComunicados(Array.isArray(lista) ? lista : []);
      } else {
        const res = await api.get("/quejas");
        const lista = res.data?.data || res.data || [];
        setQuejas(Array.isArray(lista) ? lista : []);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo || !formData.contenido) return;

    try {
      if (activeTab === "avisos") {
        const payload = {
          titulo: formData.titulo,
          contenido: formData.contenido,
          categoria: formData.categoria,
          idCasaDestino: formData.tipoDestino === "CASA" ? Number(formData.idCasaDestino) : null,
          idUsuarioDestino: formData.tipoDestino === "INDIVIDUAL" ? Number(formData.idUsuarioDestino) : null,
          canalEnvio: formData.canalEnvio,
        };

        const res = await api.post("/notificaciones", payload);
        setMensajeAlert({ tipo: "exito", texto: res.data?.message || "Comunicado emitido correctamente." });
      } else {
        const payload = {
          asunto: formData.titulo,
          descripcion: formData.contenido,
          idCasa: user?.casaId || user?.id_casa,
        };

        await api.post("/quejas", payload);
        setMensajeAlert({ tipo: "exito", texto: "Queja o sugerencia registrada correctamente." });
      }

      setShowModal(false);
      setFormData({
        titulo: "",
        contenido: "",
        categoria: "General",
        tipoDestino: "GLOBAL",
        idCasaDestino: "",
        idUsuarioDestino: "",
        canalEnvio: "TODOS",
      });
      cargarDatos();
    } catch (err) {
      setMensajeAlert({
        tipo: "error",
        texto: err.response?.data?.message || "Error al procesar la solicitud.",
      });
    }
  };

  // Filtrado local por categoría para avisos
  const comunicadosFiltrados = comunicados.filter((item) => {
    if (filterCategory === "Todas") return true;
    const catItem = item.CATEGORIA || item.categoria || "General";
    return catItem.toLowerCase() === filterCategory.toLowerCase();
  });

  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const esAdmin = rolUpper === "ADMIN" || rolUpper === "ADMINISTRADOR";

  return (
    <div style={styles.container}>
      {/* Encabezado Principal */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Comunicaciones del Condominio</h1>
          <p style={styles.subtitle}>
            Entérate de las novedades oficiales del residencial o envía tus inquietudes a la administración.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={cargarDatos}>
            Actualizar lista
          </button>
          {/* Si es Residente puede crear Quejas, si es Admin puede publicar Comunicados */}
          {(activeTab === "quejas" || esAdmin) && (
            <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>
              {activeTab === "avisos" ? "+ Publicar Comunicado" : "+ Nueva Queja / Sugerencia"}
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Respuesta */}
      {mensajeAlert && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            backgroundColor: mensajeAlert.tipo === "exito" ? "#DCFCE7" : "#FEE2E2",
            color: mensajeAlert.tipo === "exito" ? "#166534" : "#991B1B",
          }}
        >
          {mensajeAlert.texto}
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div style={styles.tabsContainer}>
        <button
          style={{ ...styles.tab, ...(activeTab === "avisos" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("avisos")}
        >
          📢 Avisos y Circulares
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === "quejas" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("quejas")}
        >
          ✍️ Buzón de Quejas y Sugerencias ({quejas.length})
        </button>
      </div>

      {/* RENDERIZADO SEGÚN PESTAÑA ACTIVA */}
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
              <option value="Seguridad">Seguridad</option>
              <option value="Eventos">Eventos</option>
              <option value="Administración">Administración</option>
              <option value="General">General</option>
            </select>
          </div>

          {loading ? (
            <p style={{ color: "#64748B" }}>Cargando avisos...</p>
          ) : comunicadosFiltrados.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                color: "#64748B",
              }}
            >
              No hay comunicados disponibles en esta categoría.
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {comunicadosFiltrados.map((item, idx) => {
                const canal = item.CANAL_ENVIO || item.canal_envio || "APP";
                const titulo = item.TITULO || item.titulo;
                const fecha = item.FECHA_PUBLICACION || item.fecha_publicacion || item.fecha;
                const contenido = item.CONTENIDO || item.contenido;
                const idCasaDest = item.ID_CASA_DESTINO || item.id_casa_destino;
                const numCasa = item.NUMERO_CASA || item.numero_casa;
                const idUserDest = item.ID_USUARIO_DESTINO || item.id_usuario_destino;

                return (
                  <div
                    key={item.ID_COMUNICADO || item.id_comunicado || idx}
                    style={{
                      ...styles.card,
                      borderLeft: `4px solid ${
                        canal === "WHATSAPP"
                          ? "#22C55E"
                          : canal === "EMAIL"
                          ? "#3B82F6"
                          : canal === "AMBOS" || canal === "TODOS"
                          ? "#8B5CF6"
                          : "#1B4B82"
                      }`,
                    }}
                  >
                    <div style={styles.cardHeader}>
                      <h3 style={styles.cardTitle}>{titulo}</h3>
                      <span style={styles.cardDate}>
                        {fecha ? new Date(fecha).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p style={styles.cardContent}>{contenido}</p>
                    <div style={styles.cardFooterSpace}>
                      <span style={styles.categoryBadge}>Canal: {canal}</span>
                      <span style={styles.destinatarioText}>
                        {idCasaDest
                          ? `Casa #${numCasa || idCasaDest}`
                          : idUserDest
                          ? `Aviso Individual`
                          : "Global"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* PESTAÑA QUEJAS Y SUGERENCIAS */
        <div>
          {loading ? (
            <p style={{ color: "#64748B" }}>Cargando solicitudes...</p>
          ) : quejas.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                color: "#64748B",
              }}
            >
              No hay quejas o sugerencias registradas por el momento.
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {quejas.map((item, idx) => {
                const asunto = item.ASUNTO || item.asunto;
                const numCasa = item.NUMERO_CASA || item.numero_casa || item.ID_CASA || item.id_casa;
                const estado = item.ESTADO || item.estado || "PENDIENTE";
                const descripcion = item.DESCRIPCION || item.descripcion;
                const fecha = item.FECHA_CREACION || item.fecha_creacion;

                return (
                  <div key={item.ID_QUEJA || item.id_queja || idx} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{asunto}</h3>
                        <span style={styles.cardSub}>
                          Reportado por Casa #{numCasa || "General"}
                        </span>
                      </div>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor:
                            estado === "RESUELTA" || estado === "ATENDIDO"
                              ? "#DCFCE7"
                              : estado === "EN_PROCESO"
                              ? "#DBEAFE"
                              : "#FEF3C7",
                          color:
                            estado === "RESUELTA" || estado === "ATENDIDO"
                              ? "#166534"
                              : estado === "EN_PROCESO"
                              ? "#1E40AF"
                              : "#92400E",
                        }}
                      >
                        {estado}
                      </span>
                    </div>
                    <p style={styles.cardContent}>{descripcion}</p>
                    <div style={styles.cardFooterSpace}>
                      <span style={styles.cardDate}>
                        Fecha: {fecha ? new Date(fecha).toLocaleDateString() : ""}
                      </span>
                      <button style={styles.btnActionSmall}>Ver Respuesta</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL ADAPTATIVO (PUBLICAR COMUNICADO O REGISTRAR QUEJA) */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              {activeTab === "avisos" ? "Publicar Nuevo Comunicado" : "Registrar Queja o Sugerencia"}
            </h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {activeTab === "avisos" ? "Título del Comunicado" : "Asunto / Título"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "avisos" ? "Ej: Mantenimiento de pozos" : "Ej: Ruido en área común"}
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  style={styles.input}
                />
              </div>

              {/* OPCIONES EXCLUSIVAS PARA COMUNICADOS (ROL ADMIN) */}
              {activeTab === "avisos" && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Categoría</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      style={styles.input}
                    >
                      <option value="General">General</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Seguridad">Seguridad</option>
                      <option value="Eventos">Eventos</option>
                      <option value="Administración">Administración</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Alcance del Destinatario</label>
                    <select
                      value={formData.tipoDestino}
                      onChange={(e) => setFormData({ ...formData, tipoDestino: e.target.value })}
                      style={styles.input}
                    >
                      <option value="GLOBAL">Todos los Residentes (Global)</option>
                      <option value="CASA">Por Casa Específica</option>
                      <option value="INDIVIDUAL">A un Usuario Directo (ID)</option>
                    </select>
                  </div>

                  {formData.tipoDestino === "CASA" && (
                    <div style={styles.formGroup}>
                      <label style={styles.label}>ID de la Casa Destino</label>
                      <input
                        type="number"
                        required
                        placeholder="Ej: 1"
                        value={formData.idCasaDestino}
                        onChange={(e) => setFormData({ ...formData, idCasaDestino: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  )}

                  {formData.tipoDestino === "INDIVIDUAL" && (
                    <div style={styles.formGroup}>
                      <label style={styles.label}>ID del Usuario Destino</label>
                      <input
                        type="number"
                        required
                        placeholder="Ej: 5"
                        value={formData.idUsuarioDestino}
                        onChange={(e) => setFormData({ ...formData, idUsuarioDestino: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  )}

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Canal de Despacho</label>
                    <select
                      value={formData.canalEnvio}
                      onChange={(e) => setFormData({ ...formData, canalEnvio: e.target.value })}
                      style={styles.input}
                    >
                      <option value="APP">Solo App</option>
                      <option value="EMAIL">Correo Electrónico</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="AMBOS">Email + WhatsApp</option>
                      <option value="TODOS">Todos los Canales (App + Email + WhatsApp)</option>
                    </select>
                  </div>
                </>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {activeTab === "avisos" ? "Contenido / Mensaje" : "Descripción detallada"}
                </label>
                <textarea
                  required
                  rows="4"
                  placeholder="Escribe el detalle aquí..."
                  value={formData.contenido}
                  onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                  style={{ ...styles.input, resize: "none" }}
                ></textarea>
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>
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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "24px", fontWeight: "700", color: "#0F172A", margin: "0 0 6px 0" },
  subtitle: { fontSize: "14px", color: "#64748B", margin: 0 },
  headerActions: { display: "flex", gap: "10px" },
  btnPrimary: { backgroundColor: "#1B4B82", color: "#FFFFFF", border: "none", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  btnSecondary: { backgroundColor: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  tabsContainer: { display: "flex", gap: "32px", borderBottom: "1px solid #E2E8F0", marginBottom: "24px" },
  tab: { background: "none", border: "none", padding: "12px 0", fontSize: "15px", fontWeight: "600", color: "#64748B", cursor: "pointer", borderBottom: "3px solid transparent" },
  tabActive: { color: "#1B4B82", borderBottom: "3px solid #1B4B82" },
  filterBar: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" },
  filterLabel: { fontSize: "14px", fontWeight: "600", color: "#334155" },
  selectInput: { padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", fontSize: "14px", color: "#1E293B" },
  cardsGrid: { display: "flex", flexDirection: "column", gap: "16px" },
  card: { backgroundColor: "#FFFFFF", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #E2E8F0" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" },
  cardTitle: { fontSize: "16px", fontWeight: "700", color: "#0F172A", margin: "0 0 4px 0" },
  cardSub: { fontSize: "12px", color: "#64748B" },
  cardDate: { fontSize: "12px", color: "#94A3B8" },
  cardContent: { fontSize: "14px", color: "#475569", lineHeight: "1.5", margin: "0 0 14px 0" },
  cardFooterSpace: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9", paddingTop: "12px" },
  categoryBadge: { fontSize: "12px", fontWeight: "500", backgroundColor: "#F1F5F9", color: "#475569", padding: "4px 10px", borderRadius: "6px" },
  destinatarioText: { fontSize: "12px", color: "#64748B", fontWeight: "500" },
  statusBadge: { fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "12px", textTransform: "uppercase" },
  btnActionSmall: { backgroundColor: "#F8FAFC", color: "#1B4B82", border: "1px solid #CBD5E1", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "12px", cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#FFFFFF", padding: "28px", borderRadius: "12px", width: "100%", maxWidth: "500px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 20px 0" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#334155" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" },
};