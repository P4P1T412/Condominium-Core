import { useState } from "react";

export default function Notificaciones() {
  const [activeTab, setActiveTab] = useState("quejas");
  const [filterCategory, setFilterCategory] = useState("Todas");
  
  // Estado para controlar la visibilidad del modal y los datos del formulario
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    categoria: "General",
    contenido: "",
  });

  // Lista de Comunicados (Avisos)
  const [comunicados, setComunicados] = useState([
    {
      id: 1,
      titulo: "[IMPORTANTE] Mantenimiento Programado de Piscinas",
      contenido: "Estimados vecinos, la piscina principal estará cerrada este jueves de 8:00 AM a 2:00 PM por limpieza profunda.",
      fecha: "2026-10-06",
      categoria: "Mantenimiento",
      badgeColor: "#EF4444",
    },
    {
      id: 2,
      titulo: "[IMPORTANTE] Asamblea General Ordinaria de Condóminos",
      contenido: "Se les convoca a la reunión anual en el Salón Social el próximo 15 de Octubre a las 18:00 hrs.",
      fecha: "2026-10-01",
      categoria: "Administración",
      badgeColor: "#EF4444",
    },
    {
      id: 3,
      titulo: "Recordatorio sobre horarios de recolección de basura",
      contenido: "Favor colocar sus contenedores antes de las 7:00 AM los días martes, jueves y sábados.",
      fecha: "2026-09-28",
      categoria: "General",
      badgeColor: "#3B82F6",
    },
  ]);

  // Lista de Quejas y Sugerencias
  const [quejas, setQuejas] = useState([
    {
      id: 101,
      casa: "Casa A-101",
      asunto: "Ruido excesivo durante la noche",
      descripcion: "En la casa B-204 hubo música a alto volumen pasada la medianoche el sábado.",
      fecha: "2026-10-18",
      estado: "PENDIENTE",
      badgeColor: "#FEF3C7",
      textColor: "#92400E",
    },
    {
      id: 102,
      casa: "Casa A-102",
      asunto: "Falla en iluminación del parque central",
      descripcion: "Dos luminarias frente al área de juegos infantiles se encuentran apagadas.",
      fecha: "2026-10-15",
      estado: "EN REVISIÓN",
      badgeColor: "#E0F2FE",
      textColor: "#0369A1",
    },
  ]);

  // Función para procesar el envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.titulo || !formData.contenido) return;

    const fechaHoy = new Date().toISOString().split("T")[0];

    if (activeTab === "avisos") {
      const nuevoComunicado = {
        id: Date.now(),
        titulo: formData.titulo,
        contenido: formData.contenido,
        fecha: fechaHoy,
        categoria: formData.categoria,
        badgeColor: formData.categoria === "Mantenimiento" ? "#EF4444" : "#3B82F6",
      };
      setComunicados([nuevoComunicado, ...comunicados]);
    } else {
      const nuevaQueja = {
        id: Date.now(),
        casa: "Mi Casa",
        asunto: formData.titulo,
        descripcion: formData.contenido,
        fecha: fechaHoy,
        estado: "PENDIENTE",
        badgeColor: "#FEF3C7",
        textColor: "#92400E",
      };
      setQuejas([nuevaQueja, ...quejas]);
    }

    // Limpiar y cerrar modal
    setFormData({ titulo: "", categoria: "General", contenido: "" });
    setShowModal(false);
  };

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
          <button style={styles.btnSecondary}>Actualizar lista</button>
          <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>
            {activeTab === "avisos" ? "+ Publicar Comunicado" : "+ Nueva Queja / Sugerencia"}
          </button>
        </div>
      </div>

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
              <option value="Administración">Administración</option>
              <option value="General">General</option>
            </select>
          </div>

          <div style={styles.cardsGrid}>
            {comunicados
              .filter((c) => filterCategory === "Todas" || c.categoria === filterCategory)
              .map((item) => (
                <div key={item.id} style={{ ...styles.card, borderLeft: `4px solid ${item.badgeColor}` }}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{item.titulo}</h3>
                    <span style={styles.cardDate}>{item.fecha}</span>
                  </div>
                  <p style={styles.cardContent}>{item.contenido}</p>
                  <div style={styles.cardFooter}>
                    <span style={styles.categoryBadge}>Categoría: {item.categoria}</span>
                  </div>
                </div>
              ))}
          </div>
        </>
      ) : (
        <div style={styles.cardsGrid}>
          {quejas.map((item) => (
            <div key={item.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>{item.asunto}</h3>
                  <span style={styles.cardSub}>Reportado por {item.casa}</span>
                </div>
                <span style={{ ...styles.statusBadge, backgroundColor: item.badgeColor, color: item.textColor }}>
                  {item.estado}
                </span>
              </div>
              <p style={styles.cardContent}>{item.descripcion}</p>
              <div style={styles.cardFooterSpace}>
                <span style={styles.cardDate}>Fecha: {item.fecha}</span>
                <button style={styles.btnActionSmall}>Ver Respuesta</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PARA CREAR COMUNICADO O QUEJA */}
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
                  placeholder={activeTab === "avisos" ? "Ej: Mantenimiento de bombas" : "Ej: Ruido en área común"}
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  style={styles.input}
                />
              </div>

              {activeTab === "avisos" && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Categoría</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    style={styles.input}
                  >
                    <option value="General">General</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Administración">Administración</option>
                  </select>
                </div>
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
  cardFooter: { display: "flex", alignItems: "center" },
  cardFooterSpace: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9", paddingTop: "12px" },
  categoryBadge: { fontSize: "12px", fontWeight: "500", backgroundColor: "#F1F5F9", color: "#475569", padding: "4px 10px", borderRadius: "6px" },
  statusBadge: { fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "12px", textTransform: "uppercase" },
  btnActionSmall: { backgroundColor: "#F8FAFC", color: "#1B4B82", border: "1px solid #CBD5E1", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "12px", cursor: "pointer" },
  
  // Estilos del Modal
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#FFFFFF", padding: "28px", borderRadius: "12px", width: "100%", maxWidth: "500px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 20px 0" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#334155" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" },
};