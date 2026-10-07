import { useState, useEffect } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";

export default function CatalogoCasas() {
  const [casas, setCasas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCasa, setSelectedCasa] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCasaId, setCurrentCasaId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    numeroCasa: "",
    bloque: "BLOQUE A",
    direccion: "",
    idPropietario: "",
    estado: "DISPONIBLE",
    totalHabitantes: 0,
  });

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  async function cargarDatosIniciales() {
    setLoading(true);
    setError("");
    try {
      const [resCasas, resPersonas] = await Promise.allSettled([
        api.get("/casas"),
        api.get("/casas/personas"),
      ]);

      if (resCasas.status === "fulfilled" && resCasas.value.data?.success) {
        setCasas(resCasas.value.data.data);
      } else {
        setError("No fue posible cargar el listado de casas.");
      }

      if (resPersonas.status === "fulfilled" && resPersonas.value.data?.success) {
        setPersonas(resPersonas.value.data.data);
      }
    } catch (err) {
      setError("Error de comunicación al consultar el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function verExpediente(idCasa) {
    try {
      const response = await api.get(`/casas/${idCasa}`);
      if (response.data && response.data.success) {
        setSelectedCasa(response.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo obtener el expediente.");
    }
  }

  function abrirModalCrear() {
    setIsEditing(false);
    setCurrentCasaId(null);
    setFormData({
      numeroCasa: "",
      bloque: "BLOQUE A",
      direccion: "",
      idPropietario: "",
      estado: "DISPONIBLE",
      totalHabitantes: 0,
    });
    setShowModal(true);
  }

  function abrirModalEditar(casa) {
    setIsEditing(true);
    setCurrentCasaId(casa.id);
    const idProp = casa.propietario?.idPersona || casa.propietario?.id || "";

    // Si la casa ya tiene habitantes en el censo, su estado real es OCUPADA
    const estadoCalculado = (casa.totalHabitantes > 0) ? "OCUPADA" : (casa.estado || "DISPONIBLE");

    setFormData({
      numeroCasa: casa.numeroCasa || "",
      bloque: casa.bloque || "",
      direccion: casa.direccion || "",
      idPropietario: idProp,
      estado: estadoCalculado,
      totalHabitantes: casa.totalHabitantes || 0,
    });
    setShowModal(true);
  }

  async function handleGuardarCasa(e) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      numeroCasa: formData.numeroCasa.trim(),
      bloque: formData.bloque.trim(),
      direccion: formData.direccion.trim(),
      estado: formData.estado, // Enviará 'DISPONIBLE' u 'OCUPADA' respetando Oracle
      idPropietario: formData.idPropietario ? Number(formData.idPropietario) : null,
    };

    try {
      let response;
      if (isEditing) {
        response = await api.put(`/casas/${currentCasaId}`, payload);
      } else {
        response = await api.post("/casas", payload);
      }

      if (response.data && response.data.success) {
        setShowModal(false);
        cargarDatosIniciales();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Ocurrió un error al guardar la vivienda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.container}>
      {/* Barra de herramientas */}
      <div style={styles.toolbar}>
        <span style={styles.counter}>
          Total de viviendas registradas: <strong>{casas.length}</strong>
        </span>
        <div style={styles.actions}>
          <button onClick={cargarDatosIniciales} style={styles.btnSecondary}>
            Actualizar lista
          </button>
          <button onClick={abrirModalCrear} style={styles.btnPrimary}>
            + Registrar Nueva Casa
          </button>
        </div>
      </div>

      {error && <div style={styles.alertError}>{error}</div>}

      {loading ? (
        <div style={styles.emptyState}>Cargando catálogo residencial...</div>
      ) : casas.length === 0 ? (
        <div style={styles.emptyState}>No hay viviendas registradas en el sistema.</div>
      ) : (
        <div style={styles.grid}>
          {casas.map((casa) => (
            <div key={casa.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Casa {casa.numeroCasa}</h3>
                  <span style={styles.cardSubtitle}>Bloque {casa.bloque}</span>
                </div>
                <StatusBadge status={casa.estado} />
              </div>

              <div style={styles.cardBody}>
                <p style={styles.detailRow}>
                  <span style={styles.detailLabel}>Dirección:</span>
                  <span style={styles.detailValue}>{casa.direccion}</span>
                </p>
                <p style={styles.detailRow}>
                  <span style={styles.detailLabel}>Propietario:</span>
                  <span style={styles.detailValue}>
                    {casa.propietario?.nombre || "Sin propietario asignado"}
                  </span>
                </p>
                <p style={styles.detailRow}>
                  <span style={styles.detailLabel}>Habitantes:</span>
                  <span style={styles.detailValue}>{casa.totalHabitantes} residentes</span>
                </p>
              </div>

              <div style={styles.cardButtonsGroup}>
                <button
                  onClick={() => verExpediente(casa.id)}
                  style={styles.btnExpediente}
                >
                  Expediente
                </button>
                <button
                  onClick={() => abrirModalEditar(casa)}
                  style={styles.btnEditar}
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Expediente Familiar */}
      {selectedCasa && (
        <div style={styles.modalOverlay} onClick={() => setSelectedCasa(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Expediente: Casa {selectedCasa.numeroCasa}</h2>
                <p style={styles.modalSubtitle}>
                  Bloque {selectedCasa.bloque} — {selectedCasa.direccion}
                </p>
              </div>
              <button onClick={() => setSelectedCasa(null)} style={styles.modalClose}>✕</button>
            </div>

            <section style={styles.modalSection}>
              <h4 style={styles.sectionHeading}>Propietario Titular</h4>
              <div style={styles.infoCard}>
                <p><strong>Nombre:</strong> {selectedCasa.propietario?.nombre || "Sin propietario asignado"}</p>
                {selectedCasa.propietario && (
                  <>
                    <p><strong>DPI:</strong> {selectedCasa.propietario?.dpi || "No registrado"}</p>
                    <p>
                      <strong>Contacto:</strong> {selectedCasa.propietario?.telefono || "N/A"} — {selectedCasa.propietario?.correo || "N/A"}
                    </p>
                  </>
                )}
              </div>
            </section>

            <section style={styles.modalSection}>
              <h4 style={styles.sectionHeading}>
                Habitantes y Núcleo Familiar ({selectedCasa.residentes?.length || 0})
              </h4>
              {selectedCasa.residentes?.length === 0 ? (
                <p style={styles.emptyNote}>No hay familiares o inquilinos asociados a esta casa.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nombre</th>
                      <th style={styles.th}>Identificación</th>
                      <th style={styles.th}>Tipo</th>
                      <th style={styles.th}>Condición</th>
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
                            <span style={styles.pillTitular}>Titular</span>
                          ) : (
                            <span style={styles.pillMiembro}>Dependiente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <div style={styles.modalFooter}>
              <button onClick={() => setSelectedCasa(null)} style={styles.btnSecondary}>
                Cerrar expediente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear o Editar Casa */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {isEditing ? `Editar Casa ${formData.numeroCasa}` : "Registrar Nueva Propiedad"}
                </h2>
                <p style={styles.modalSubtitle}>
                  {isEditing
                    ? "Actualice los datos o la asignación de la vivienda"
                    : "Incorporación de vivienda al inventario del residencial"}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} style={styles.modalClose}>✕</button>
            </div>

            <form onSubmit={handleGuardarCasa} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Número de Casa / Nomenclatura *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. B-201"
                    value={formData.numeroCasa}
                    onChange={(e) => setFormData({ ...formData, numeroCasa: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Bloque o Sector *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. BLOQUE B"
                    value={formData.bloque}
                    onChange={(e) => setFormData({ ...formData, bloque: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroupFull}>
                <label style={styles.label}>Dirección Detallada *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sector Norte Calle Principal Casa 1"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Estado de la Vivienda</label>
                  {formData.totalHabitantes > 0 ? (
                    <div>
                      <select
                        value="OCUPADA"
                        disabled
                        style={{ ...styles.select, backgroundColor: "#F3F4F6", cursor: "not-allowed" }}
                      >
                        <option value="OCUPADA">OCUPADA (Con residentes)</option>
                      </select>
                      <small style={styles.helperText}>
                        Bloqueado a OCUPADA porque tiene {formData.totalHabitantes} habitante(s) en el censo.
                      </small>
                    </div>
                  ) : (
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      style={styles.select}
                    >
                      <option value="DISPONIBLE">DISPONIBLE (Vacía / En venta)</option>
                      <option value="OCUPADA">OCUPADA (Habitada)</option>
                    </select>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Propietario Asignado (Opcional)</label>
                  <select
                    value={formData.idPropietario}
                    onChange={(e) => setFormData({ ...formData, idPropietario: e.target.value })}
                    style={styles.select}
                  >
                    <option value="">-- Sin propietario / En venta --</option>
                    {personas.map((p) => (
                      <option key={p.idPersona} value={p.idPersona}>
                        {p.nombreCompleto} {p.dpi ? `(DPI: ${p.dpi})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={styles.btnSecondary}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary} disabled={saving}>
                  {saving ? "Guardando cambios..." : isEditing ? "Actualizar Casa" : "Guardar Casa"}
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
  container: {
    width: "100%",
    boxSizing: "border-box",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "12px",
  },
  counter: {
    fontSize: "14px",
    color: "var(--color-text-muted, #667085)",
  },
  actions: {
    display: "flex",
    gap: "10px",
  },
  btnPrimary: {
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnSecondary: {
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "20px",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  cardTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 2px 0",
  },
  cardSubtitle: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "16px",
  },
  detailRow: {
    margin: 0,
    fontSize: "13px",
    display: "flex",
    justifyContent: "space-between",
  },
  detailLabel: {
    color: "var(--color-text-muted, #667085)",
  },
  detailValue: {
    color: "var(--color-text, #101828)",
    fontWeight: "500",
    textAlign: "right",
    maxWidth: "60%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardButtonsGroup: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "8px",
  },
  btnExpediente: {
    backgroundColor: "#EEF4FB",
    color: "var(--color-primary, #1B4B82)",
    border: "none",
    borderRadius: "6px",
    padding: "8px 0",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnEditar: {
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "6px",
    padding: "8px 0",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 0",
    color: "var(--color-text-muted, #667085)",
    fontSize: "14px",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    padding: "10px 14px",
    borderRadius: "8px",
    marginBottom: "16px",
    fontSize: "13px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 25, 44, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
    boxSizing: "border-box",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    maxWidth: "620px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    overflowX: "hidden", // Elimina el scroll horizontal
    padding: "24px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
    boxSizing: "border-box",
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
    fontSize: "18px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 2px 0",
  },
  modalSubtitle: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    margin: 0,
  },
  modalClose: {
    background: "none",
    border: "none",
    fontSize: "18px",
    color: "var(--color-text-muted, #667085)",
    cursor: "pointer",
  },
  modalSection: {
    marginBottom: "18px",
  },
  sectionHeading: {
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    color: "var(--color-text-muted, #667085)",
    margin: "0 0 8px 0",
  },
  infoCard: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    borderRadius: "8px",
    padding: "12px 14px",
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left",
  },
  th: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    padding: "8px 10px",
    color: "var(--color-text-muted, #667085)",
    fontWeight: "600",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  tr: {
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  td: {
    padding: "8px 10px",
    color: "var(--color-text, #101828)",
  },
  pillTitular: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  pillMiembro: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  emptyNote: {
    fontSize: "13px",
    fontStyle: "italic",
    color: "var(--color-text-muted, #667085)",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
    paddingTop: "14px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0, // Clave para evitar desbordes en flex/grid
    boxSizing: "border-box",
  },
  formGroupFull: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "100%",
    boxSizing: "border-box",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box", // Previene que el padding ensanche el input
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    boxSizing: "border-box",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  helperText: {
    fontSize: "11px",
    color: "#6B7280",
    marginTop: "4px",
    display: "block",
  },
};