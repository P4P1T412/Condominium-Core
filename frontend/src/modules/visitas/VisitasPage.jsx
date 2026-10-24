import { useState } from "react";

export default function VisitasPage() {
  const [activeTab, setActiveTab] = useState("programadas");
  const [showModal, setShowModal] = useState(false);

  // Formulario para pre-autorizar
  const [formData, setFormData] = useState({
    nombre: "",
    dpi: "",
    placa: "",
    casa: "A-101",
    fecha: new Date().toISOString().split("T")[0],
  });

  // Lista de Visitas Programadas
  const [visitas, setVisitas] = useState([
    {
      id: 1,
      visitant: "Carlos Eduardo Mendoza",
      dpi: "2345678900101",
      placa: "P-452GHT",
      casa: "A-101",
      fecha: "2026-10-19",
      estado: "INGRESO AUTORIZADO",
      statusColor: "#DCFCE7",
      textColor: "#166534",
    },
    {
      id: 2,
      visitant: "María Fernanda Ramos",
      dpi: "1987654320101",
      placa: "P-112BKN",
      casa: "A-102",
      fecha: "2026-10-19",
      estado: "PENDIENTE",
      statusColor: "#FEF3C7",
      textColor: "#92400E",
    },
  ]);

  // Lista para la Bitácora de Entradas/Salidas
  const [bitacora, setBitacora] = useState([
    {
      id: 501,
      visitant: "Carlos Eduardo Mendoza",
      dpi: "2345678900101",
      casa: "A-101",
      horaEntrada: "08:30 AM",
      horaSalida: "En residencia",
      estado: "ADENTRO",
      badgeBg: "#DCFCE7",
      badgeText: "#166534",
    },
    {
      id: 502,
      visitant: "Mario Roberto Gomez",
      dpi: "3004561230101",
      casa: "B-202",
      horaEntrada: "07:15 AM",
      horaSalida: "10:00 AM",
      estado: "FINALIZADO",
      badgeBg: "#F1F5F9",
      badgeText: "#475569",
    },
  ]);

  // Pre-autorizar visita
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.dpi) return;

    const nuevaVisita = {
      id: Date.now(),
      visitant: formData.nombre,
      dpi: formData.dpi,
      placa: formData.placa || "N/A",
      casa: formData.casa,
      fecha: formData.fecha,
      estado: "PENDIENTE",
      statusColor: "#FEF3C7",
      textColor: "#92400E",
    };

    setVisitas([nuevaVisita, ...visitas]);
    setFormData({
      nombre: "",
      dpi: "",
      placa: "",
      casa: "A-101",
      fecha: new Date().toISOString().split("T")[0],
    });
    setShowModal(false);
  };

  // Registrar Ingreso y pasarlo a Bitácora
  const handleRegistrarIngreso = (v) => {
    // Actualizar estado en programadas
    setVisitas(
      visitas.map((item) =>
        item.id === v.id
          ? {
              ...item,
              estado: "INGRESO AUTORIZADO",
              statusColor: "#DCFCE7",
              textColor: "#166534",
            }
          : item
      )
    );

    // Agregar a la bitácora
    const horaActual = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nuevoRegistro = {
      id: Date.now(),
      visitant: v.visitant,
      dpi: v.dpi,
      casa: v.casa,
      horaEntrada: horaActual,
      horaSalida: "En residencia",
      estado: "ADENTRO",
      badgeBg: "#DCFCE7",
      badgeText: "#166534",
    };
    setBitacora([nuevoRegistro, ...bitacora]);
  };

  // Marcar Salida en Bitácora
  const handleRegistrarSalida = (id) => {
    const horaActual = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setBitacora(
      bitacora.map((b) =>
        b.id === id
          ? {
              ...b,
              horaSalida: horaActual,
              estado: "FINALIZADO",
              badgeBg: "#F1F5F9",
              badgeText: "#475569",
            }
          : b
      )
    );
  };

  return (
    <div style={styles.container}>
      {/* Encabezado Principal */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Garita y Control de Visitas</h1>
          <p style={styles.subtitle}>
            Gestión de ingresos, registro de visitas anticipadas y bitácora de seguridad en garita.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary}>Actualizar lista</button>
          <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>
            + Pre-autorizar Visita
          </button>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div style={styles.tabsContainer}>
        <button
          style={{ ...styles.tab, ...(activeTab === "programadas" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("programadas")}
        >
          🚗 Visitas Programadas
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === "bitacora" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("bitacora")}
        >
          📋 Bitácora de Entradas/Salidas ({bitacora.length})
        </button>
      </div>

      {/* VISTA SEGÚN LA PESTAÑA SELECCIONADA */}
      {activeTab === "programadas" ? (
        <>
          <div style={styles.infoSummary}>
            Total de registros para hoy: <strong>{visitas.length} visitas</strong>
          </div>

          <div style={styles.cardsGrid}>
            {visitas.map((item) => (
              <div key={item.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>{item.visitant}</h3>
                    <span style={styles.cardSub}>DPI: {item.dpi}</span>
                  </div>
                  <span style={{ ...styles.badge, backgroundColor: item.statusColor, color: item.textColor }}>
                    {item.estado}
                  </span>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.dataRow}>
                    <span style={styles.label}>Casa a visitar:</span>
                    <span style={styles.value}>{item.casa}</span>
                  </div>
                  <div style={styles.dataRow}>
                    <span style={styles.label}>Vehículo / Placa:</span>
                    <span style={styles.value}>{item.placa}</span>
                  </div>
                  <div style={styles.dataRow}>
                    <span style={styles.label}>Fecha programada:</span>
                    <span style={styles.value}>{item.fecha}</span>
                  </div>
                </div>

                <div style={styles.cardFooter}>
                  <button style={styles.actionBtnSecondary}>Ver Detalles</button>
                  {item.estado === "PENDIENTE" && (
                    <button
                      style={styles.actionBtnPrimary}
                      onClick={() => handleRegistrarIngreso(item)}
                    >
                      Registrar Ingreso
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* TABLA DE BITÁCORA DE ENTRADAS Y SALIDAS */
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Visitante</th>
                <th style={styles.th}>Identificación / DPI</th>
                <th style={styles.th}>Casa</th>
                <th style={styles.th}>Hora Entrada</th>
                <th style={styles.th}>Hora Salida</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acción Garita</th>
              </tr>
            </thead>
            <tbody>
              {bitacora.map((row) => (
                <tr key={row.id} style={styles.tableRow}>
                  <td style={{ ...styles.td, fontWeight: "600", color: "#0F172A" }}>{row.visitant}</td>
                  <td style={styles.td}>{row.dpi}</td>
                  <td style={styles.td}>{row.casa}</td>
                  <td style={styles.td}>{row.horaEntrada}</td>
                  <td style={styles.td}>{row.horaSalida}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: row.badgeBg, color: row.badgeText }}>
                      {row.estado}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {row.estado === "ADENTRO" ? (
                      <button style={styles.btnSalida} onClick={() => handleRegistrarSalida(row.id)}>
                        Marcar Salida
                      </button>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94A3B8" }}>Completado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL PARA PRE-AUTORIZAR */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Pre-autorizar Nueva Visita</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nombre del Visitante</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Antonio López"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>DPI / Identificación</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1234567890101"
                  value={formData.dpi}
                  onChange={(e) => setFormData({ ...formData, dpi: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Placa del Vehículo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: P-123XYZ"
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Casa a Visitar</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: A-101"
                  value={formData.casa}
                  onChange={(e) => setFormData({ ...formData, casa: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fecha Programada</label>
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
                  Guardar Visita
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
  tabsContainer: { display: "flex", gap: "32px", borderBottom: "1px solid #E2E8F0", marginBottom: "20px" },
  tab: { background: "none", border: "none", padding: "12px 0", fontSize: "15px", fontWeight: "600", color: "#64748B", cursor: "pointer", borderBottom: "3px solid transparent" },
  tabActive: { color: "#1B4B82", borderBottom: "3px solid #1B4B82" },
  infoSummary: { fontSize: "14px", color: "#475569", marginBottom: "20px" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" },
  card: { backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" },
  cardTitle: { fontSize: "16px", fontWeight: "700", color: "#0F172A", margin: "0 0 2px 0" },
  cardSub: { fontSize: "12px", color: "#64748B" },
  badge: { fontSize: "11px", fontWeight: "700", padding: "4px 8px", borderRadius: "12px", textTransform: "uppercase" },
  cardBody: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  dataRow: { display: "flex", justifyContent: "space-between", fontSize: "13px" },
  label: { color: "#64748B" },
  value: { color: "#1E293B", fontWeight: "600" },
  cardFooter: { display: "flex", gap: "10px" },
  actionBtnPrimary: { flex: 1, backgroundColor: "#1B4B82", color: "#FFFFFF", border: "none", padding: "8px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "13px", cursor: "pointer" },
  actionBtnSecondary: { flex: 1, backgroundColor: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", padding: "8px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "13px", cursor: "pointer" },

  // Estilos de la Tabla de Bitácora
  tableCard: { backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" },
  tableHeaderRow: { backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" },
  th: { padding: "14px 16px", fontWeight: "600", color: "#475569", fontSize: "13px" },
  tableRow: { borderBottom: "1px solid #F1F5F9" },
  td: { padding: "14px 16px", color: "#334155" },
  btnSalida: { backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "12px", cursor: "pointer" },

  // Estilos Modal
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalContent: { backgroundColor: "#FFFFFF", padding: "28px", borderRadius: "12px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 20px 0" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" },
};