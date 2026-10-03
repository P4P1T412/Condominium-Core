import { useState, useEffect } from "react";
import api from "../../api/axios";

export default function CasasList() {
  const [casas, setCasas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Estado para el modal de expediente familiar
  const [selectedCasa, setSelectedCasa] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    cargarCasas();
  }, []);

  async function cargarCasas() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/casas");
      if (response.data && response.data.success) {
        setCasas(response.data.data);
      } else {
        setError("No se pudieron obtener las viviendas.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Error al conectar con el servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verExpediente(idCasa) {
    setLoadingModal(true);
    setModalError("");
    try {
      const response = await api.get(`/casas/${idCasa}`);
      if (response.data && response.data.success) {
        setSelectedCasa(response.data.data);
      }
    } catch (err) {
      setModalError(
        err.response?.data?.message || "Error al cargar el expediente familiar."
      );
    } finally {
      setLoadingModal(false);
    }
  }

  function cerrarModal() {
    setSelectedCasa(null);
    setModalError("");
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Casas y Familias</h1>
          <p style={styles.subtitle}>
            Expediente de cada vivienda con su responsable y censo de residentes.
          </p>
        </div>
        <button onClick={cargarCasas} style={styles.refreshButton}>
          Actualizar padrón
        </button>
      </div>

      {error && <div style={styles.errorMessage}>{error}</div>}

      {loading ? (
        <div style={styles.centerMessage}>Cargando viviendas desde Oracle...</div>
      ) : casas.length === 0 ? (
        <div style={styles.centerMessage}>No hay casas registradas en el sistema.</div>
      ) : (
        <div style={styles.grid}>
          {casas.map((casa) => (
            <div key={casa.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Casa {casa.numeroCasa}
                  </h3>
                  <span style={styles.cardSubtitle}>Bloque {casa.bloque}</span>
                </div>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor:
                      casa.estado === "HABITADA" ? "#DCFCE7" : "#FEF3C7",
                    color:
                      casa.estado === "HABITADA" ? "#166534" : "#92400E",
                  }}
                >
                  {casa.estado}
                </span>
              </div>

              <div style={styles.cardBody}>
                <p style={styles.cardText}>
                  <strong>Dirección:</strong> {casa.direccion}
                </p>
                <p style={styles.cardText}>
                  <strong>Propietario:</strong> {casa.propietario?.nombre || "Sin asignar"}
                </p>
                <p style={styles.cardText}>
                  <strong>Habitantes activos:</strong> {casa.totalHabitantes}
                </p>
              </div>

              <button
                onClick={() => verExpediente(casa.id)}
                style={styles.cardButton}
              >
                Ver expediente familiar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal interactivo de Expediente Familiar */}
      {(selectedCasa || loadingModal) && (
        <div style={styles.modalOverlay} onClick={cerrarModal}>
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingModal ? (
              <div style={styles.centerMessage}>Cargando expediente...</div>
            ) : modalError ? (
              <div>
                <div style={styles.errorMessage}>{modalError}</div>
                <button onClick={cerrarModal} style={styles.closeButton}>
                  Cerrar
                </button>
              </div>
            ) : (
              selectedCasa && (
                <>
                  <div style={styles.modalHeader}>
                    <div>
                      <h2 style={styles.modalTitle}>
                        Expediente: Casa {selectedCasa.numeroCasa}
                      </h2>
                      <span style={styles.modalSubtitle}>
                        Bloque {selectedCasa.bloque} — {selectedCasa.direccion}
                      </span>
                    </div>
                    <button onClick={cerrarModal} style={styles.closeIcon}>
                      ✕
                    </button>
                  </div>

                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>Titular Responsable</h4>
                    <div style={styles.infoBox}>
                      <p><strong>Nombre:</strong> {selectedCasa.propietario?.nombre}</p>
                      <p><strong>DPI:</strong> {selectedCasa.propietario?.dpi || "No registrado"}</p>
                      <p><strong>Teléfono:</strong> {selectedCasa.propietario?.telefono || "N/A"}</p>
                      <p><strong>Correo:</strong> {selectedCasa.propietario?.correo || "N/A"}</p>
                    </div>
                  </div>

                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>
                      Habitantes Registrados ({selectedCasa.residentes?.length || 0})
                    </h4>
                    {selectedCasa.residentes?.length === 0 ? (
                      <p style={styles.emptyNote}>
                        No hay residentes registrados en esta casa.
                      </p>
                    ) : (
                      <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Nombre</th>
                              <th style={styles.th}>Identificación</th>
                              <th style={styles.th}>Tipo</th>
                              <th style={styles.th}>Rol Familiar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedCasa.residentes.map((res) => (
                              <tr key={res.idResidente} style={styles.tr}>
                                <td style={styles.td}>{res.nombreCompleto}</td>
                                <td style={styles.td}>{res.identificacion || "Menor"}</td>
                                <td style={styles.td}>{res.tipoResidente}</td>
                                <td style={styles.td}>
                                  {res.esPrincipal ? (
                                    <span style={styles.badgePrincipal}>Titular</span>
                                  ) : (
                                    "Miembro"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={styles.modalFooter}>
                    <button onClick={cerrarModal} style={styles.closeButton}>
                      Cerrar expediente
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "24px 32px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "26px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 6px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--color-text-muted, #667085)",
    margin: 0,
  },
  refreshButton: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "20px",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 2px 0",
  },
  cardSubtitle: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  badge: {
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardBody: {
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
    marginBottom: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  cardText: {
    margin: 0,
    color: "var(--color-text, #101828)",
  },
  cardButton: {
    width: "100%",
    padding: "9px",
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  centerMessage: {
    textAlign: "center",
    padding: "48px 0",
    color: "var(--color-text-muted, #667085)",
    fontSize: "15px",
  },
  errorMessage: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    marginBottom: "20px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    maxWidth: "650px",
    width: "100%",
    maxHeight: "85vh",
    overflowY: "auto",
    padding: "24px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
    paddingBottom: "12px",
    marginBottom: "16px",
  },
  modalTitle: {
    fontSize: "19px",
    fontWeight: "700",
    margin: "0 0 4px 0",
    color: "var(--color-text, #101828)",
  },
  modalSubtitle: {
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
  },
  closeIcon: {
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "var(--color-text-muted, #667085)",
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: "700",
    textTransform: "uppercase",
    color: "var(--color-text-muted, #667085)",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  },
  infoBox: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "var(--color-text, #101828)",
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left",
  },
  th: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    padding: "10px 12px",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
    color: "var(--color-text-muted, #667085)",
    fontWeight: "600",
  },
  tr: {
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  td: {
    padding: "10px 12px",
    color: "var(--color-text, #101828)",
  },
  badgePrincipal: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  emptyNote: {
    fontSize: "13px",
    fontStyle: "italic",
    color: "var(--color-text-muted, #667085)",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "20px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
    paddingTop: "12px",
  },
  closeButton: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
};