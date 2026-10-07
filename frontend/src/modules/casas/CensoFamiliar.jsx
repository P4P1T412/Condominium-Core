import { useState, useEffect } from "react";
import api from "../../api/axios";

/**
 * Pestaña 2: Censo y Núcleo Familiar
 * 
 * Gestiona el padrón habitacional: censo general de residentes,
 * vinculación de familiares/inquilinos y registro de personas.
 */
export default function CensoFamiliar() {
  const [casas, setCasas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [residentesCenso, setResidentesCenso] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);

  // Formulario de asignación a casa
  const [formData, setFormData] = useState({
    idCasa: "",
    idPersona: "",
    tipoResidente: "FAMILIAR",
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  // Modal para registrar una nueva persona
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [guardandoPersona, setGuardandoPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState({
    nombres: "",
    apellidos: "",
    dpi: "",
    telefono: "",
    correo: "",
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [resCasas, resPersonas] = await Promise.allSettled([
        api.get("/casas"),
        api.get("/casas/personas"),
      ]);

      let casasList = [];
      if (resCasas.status === "fulfilled" && resCasas.value.data?.success) {
        casasList = resCasas.value.data.data;
        setCasas(casasList);
        if (casasList.length > 0 && !formData.idCasa) {
          setFormData((prev) => ({ ...prev, idCasa: casasList[0].id }));
        }
      }

      if (resPersonas.status === "fulfilled" && resPersonas.value.data?.success) {
        const personasList = resPersonas.value.data.data;
        setPersonas(personasList);
        if (personasList.length > 0 && !formData.idPersona) {
          setFormData((prev) => ({ ...prev, idPersona: personasList[0].idPersona }));
        }
      }

      // Cargar los residentes detallados de todas las casas para armar el censo real
      await compilarCensoGeneral(casasList);
    } catch (err) {
      console.error("Error al cargar datos del censo:", err);
    } finally {
      setLoading(false);
    }
  }

  async function compilarCensoGeneral(casasList) {
    try {
      // Consultamos los expedientes de las casas en paralelo
      const expedientesPromises = casasList.map((c) => api.get(`/casas/${c.id}`));
      const resultados = await Promise.allSettled(expedientesPromises);

      const listaTotal = [];
      resultados.forEach((res) => {
        if (res.status === "fulfilled" && res.value.data?.success) {
          const casaData = res.value.data.data;
          if (Array.isArray(casaData.residentes)) {
            casaData.residentes.forEach((r) => {
              listaTotal.push({
                ...r,
                numeroCasa: casaData.numeroCasa,
                bloque: casaData.bloque,
                direccionCasa: casaData.direccion,
                idCasa: casaData.id,
              });
            });
          }
        }
      });

      setResidentesCenso(listaTotal);
    } catch (error) {
      console.error("Error al compilar lista de habitantes:", error);
    }
  }

  // Verifica si la casa actualmente seleccionada en el formulario ya tiene un titular
  const casaActual = casas.find((c) => String(c.id) === String(formData.idCasa));
  const tieneTitular = residentesCenso.some(
    (r) => String(r.idCasa) === String(formData.idCasa) && r.esPrincipal
  );

  async function handleVincular(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje({ tipo: "", texto: "" });

    try {
      const response = await api.post(`/casas/${formData.idCasa}/residentes`, {
        idPersona: Number(formData.idPersona),
        tipoResidente: formData.tipoResidente,
        esPrincipal: formData.tipoResidente === "TITULAR",
      });

      if (response.data && response.data.success) {
        setMensaje({
          tipo: "success",
          texto: "Residente asignado a la vivienda correctamente.",
        });
        cargarDatos();
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err.response?.data?.message || "No se pudo vincular al residente en la vivienda.",
      });
    } finally {
      setGuardando(false);
    }
  }

  async function handleCrearPersona(e) {
    e.preventDefault();
    setGuardandoPersona(true);
    try {
      const response = await api.post("/casas/personas", personaForm);
      if (response.data && response.data.success) {
        const nueva = response.data.data;
        // Agregamos a la lista local y la preseleccionamos
        setPersonas((prev) => [nueva, ...prev]);
        setFormData((prev) => ({ ...prev, idPersona: nueva.idPersona }));
        setShowPersonaModal(false);
        setPersonaForm({ nombres: "", apellidos: "", dpi: "", telefono: "", correo: "" });
        setMensaje({
          tipo: "success",
          texto: `Persona registrada: ${nueva.nombreCompleto} quedó preseleccionada.`,
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error al registrar persona.");
    } finally {
      setGuardandoPersona(false);
    }
  }

  const censoFiltrado = residentesCenso.filter((r) => {
    const texto = `${r.nombreCompleto} ${r.identificacion || ""} ${r.numeroCasa} ${r.bloque}`.toLowerCase();
    return texto.includes(filtro.toLowerCase());
  });

  return (
    <div style={styles.container}>
      {/* Columna Izquierda: Formulario de Asignación */}
      <section style={styles.formCard}>
        <div style={styles.formCardHeader}>
          <h3 style={styles.cardHeading}>Asignar Habitante a Casa</h3>
          <p style={styles.cardDesc}>
            Vincula un miembro familiar, dependiente o inquilino a una propiedad.
          </p>
        </div>

        {mensaje.texto && (
          <div
            style={
              mensaje.tipo === "success"
                ? styles.alertSuccess
                : styles.alertError
            }
          >
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleVincular} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Vivienda Destino *</label>
            <select
              value={formData.idCasa}
              onChange={(e) => {
                setFormData({ ...formData, idCasa: e.target.value });
                setMensaje({ tipo: "", texto: "" });
              }}
              style={styles.select}
              required
            >
              {casas.map((c) => (
                <option key={c.id} value={c.id}>
                  Casa {c.numeroCasa} ({c.bloque}) — Propietario: {c.propietario?.nombre || "Sin asignar"}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <div style={styles.labelWithAction}>
              <label style={styles.label}>Persona a Vincular *</label>
              <button
                type="button"
                onClick={() => setShowPersonaModal(true)}
                style={styles.btnLinkAction}
              >
                + Registrar persona
              </button>
            </div>
            <select
              value={formData.idPersona}
              onChange={(e) => setFormData({ ...formData, idPersona: e.target.value })}
              style={styles.select}
              required
            >
              {personas.map((p) => (
                <option key={p.idPersona} value={p.idPersona}>
                  {p.nombreCompleto} {p.dpi ? `(DPI: ${p.dpi})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Residencia *</label>
            <select
              value={formData.tipoResidente}
              onChange={(e) => setFormData({ ...formData, tipoResidente: e.target.value })}
              style={styles.select}
            >
              <option value="FAMILIAR">Familiar (Cónyuge, hijo, pariente)</option>
              <option value="INQUILINO">Inquilino (Arrendatario)</option>
              <option value="TITULAR" disabled={tieneTitular}>
                {tieneTitular ? "Titular (Ya asignado a esta casa)" : "Titular Principal"}
              </option>
            </select>

            {tieneTitular && formData.tipoResidente === "TITULAR" && (
              <small style={styles.warningNote}>
                Esta vivienda ya cuenta con un titular. Se asignará como Familiar o Inquilino.
              </small>
            )}
          </div>

          <button
            type="submit"
            disabled={guardando || personas.length === 0}
            style={styles.btnSubmit}
          >
            {guardando ? "Guardando en padrón..." : "Asignar a Vivienda"}
          </button>
        </form>
      </section>

      {/* Columna Derecha: Censo Residencial Consolidado */}
      <section style={styles.censoSection}>
        <div style={styles.censoHeader}>
          <div>
            <h3 style={styles.cardHeading}>Padrón y Censo Consolidado</h3>
            <p style={styles.cardDesc}>
              Total de habitantes registrados en el residencial: <strong>{residentesCenso.length}</strong>
            </p>
          </div>

          <div style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Buscar habitante por nombre, DPI o casa..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Cargando censo habitacional...</div>
        ) : censoFiltrado.length === 0 ? (
          <div style={styles.emptyState}>
            {filtro
              ? "No se encontraron habitantes con ese criterio de búsqueda."
              : "No hay residentes vinculados a ninguna vivienda actualmente."}
          </div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Residente</th>
                  <th style={styles.th}>Identificación</th>
                  <th style={styles.th}>Vivienda</th>
                  <th style={styles.th}>Contacto</th>
                  <th style={styles.th}>Condición</th>
                </tr>
              </thead>
              <tbody>
                {censoFiltrado.map((res) => (
                  <tr key={`${res.idCasa}-${res.idResidente}`} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.residenteNombre}>{res.nombreCompleto}</span>
                    </td>
                    <td style={styles.td}>{res.identificacion || "Menor de edad"}</td>
                    <td style={styles.td}>
                      <strong>Casa {res.numeroCasa}</strong>
                      <span style={styles.bloqueText}> ({res.bloque})</span>
                    </td>
                    <td style={styles.td}>{res.telefono || res.correo || "No registrado"}</td>
                    <td style={styles.td}>
                      {res.esPrincipal ? (
                        <span style={styles.badgeTitular}>Titular</span>
                      ) : (
                        <span style={styles.badgeMiembro}>{res.tipoResidente}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal: Registrar Nueva Persona */}
      {showPersonaModal && (
        <div style={styles.modalOverlay} onClick={() => setShowPersonaModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Registrar Nueva Persona</h3>
                <p style={styles.modalSubtitle}>Incorporar al padrón de ciudadanos del condominio</p>
              </div>
              <button onClick={() => setShowPersonaModal(false)} style={styles.modalClose}>✕</button>
            </div>

            <form onSubmit={handleCrearPersona} style={styles.personaForm}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nombres *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. María Elena"
                    value={personaForm.nombres}
                    onChange={(e) => setPersonaForm({ ...personaForm, nombres: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Apellidos *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Morales Gómez"
                    value={personaForm.apellidos}
                    onChange={(e) => setPersonaForm({ ...personaForm, apellidos: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>DPI / Identificación</label>
                  <input
                    type="text"
                    placeholder="ej. 2345678900101"
                    value={personaForm.dpi}
                    onChange={(e) => setPersonaForm({ ...personaForm, dpi: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Teléfono</label>
                  <input
                    type="text"
                    placeholder="ej. 5555-1234"
                    value={personaForm.telefono}
                    onChange={(e) => setPersonaForm({ ...personaForm, telefono: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ej. maria.morales@correo.com"
                  value={personaForm.correo}
                  onChange={(e) => setPersonaForm({ ...personaForm, correo: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowPersonaModal(false)}
                  style={styles.btnSecondary}
                  disabled={guardandoPersona}
                >
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary} disabled={guardandoPersona}>
                  {guardandoPersona ? "Registrando..." : "Guardar Persona"}
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
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "24px",
    alignItems: "start",
    boxSizing: "border-box",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  },
  formCardHeader: {
    marginBottom: "16px",
  },
  cardHeading: {
    fontSize: "16px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 4px 0",
  },
  cardDesc: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  labelWithAction: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  btnLinkAction: {
    background: "none",
    border: "none",
    color: "var(--color-primary, #1B4B82)",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
    padding: 0,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    boxSizing: "border-box",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
    color: "var(--color-text, #101828)",
  },
  warningNote: {
    fontSize: "11px",
    color: "#D97706",
    marginTop: "2px",
  },
  btnSubmit: {
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "6px",
  },
  alertSuccess: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    marginBottom: "12px",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    marginBottom: "12px",
  },
  censoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  },
  censoHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px",
  },
  searchWrapper: {
    minWidth: "260px",
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  tableResponsive: {
    overflowX: "auto",
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
    color: "var(--color-text-muted, #667085)",
    fontWeight: "600",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  td: {
    padding: "10px 12px",
    color: "var(--color-text, #101828)",
  },
  residenteNombre: {
    fontWeight: "600",
  },
  bloqueText: {
    fontSize: "11px",
    color: "var(--color-text-muted, #667085)",
  },
  badgeTitular: {
    display: "inline-block",
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
  },
  badgeMiembro: {
    display: "inline-block",
    backgroundColor: "#F1F5F9",
    color: "#475569",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "600",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 0",
    color: "var(--color-text-muted, #667085)",
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
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    maxWidth: "500px",
    width: "100%",
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
    fontSize: "17px",
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
  personaForm: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
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
};