import { useState, useEffect } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";

export default function DirectorioCuentas() {
  const [usuarios, setUsuarios] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal para crear usuario
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    idPersona: "",
    idRol: "",
    nombreUsuario: "",
    contrasena: "",
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError("");
    try {
      const [resUsuarios, resPersonas, resRoles] = await Promise.allSettled([
        api.get("/usuarios"),
        api.get("/casas/personas"),
        api.get("/usuarios/roles"),
      ]);

      if (resUsuarios.status === "fulfilled" && resUsuarios.value.data?.success) {
        setUsuarios(resUsuarios.value.data.data);
      } else {
        setError("No fue posible cargar el listado de usuarios.");
      }

      if (resPersonas.status === "fulfilled" && resPersonas.value.data?.success) {
        setPersonas(resPersonas.value.data.data);
      }

      if (resRoles.status === "fulfilled" && resRoles.value.data?.success) {
        setRoles(resRoles.value.data.data);
      }
    } catch (err) {
      setError("Error de comunicación al consultar el servidor.");
    } finally {
      setLoading(false);
    }
  }

  // Filtrar personas que aún no tienen usuario asignado
  const personasSinUsuario = personas.filter(
    (p) => !usuarios.some((u) => u.persona?.idPersona === p.idPersona)
  );

  function abrirModalCrear() {
    setFormData({
      idPersona: personasSinUsuario[0]?.idPersona || "",
      idRol: roles[0]?.idRol || "",
      nombreUsuario: "",
      contrasena: "",
    });
    setShowModal(true);
  }

  async function handleToggleEstado(usuario) {
    const nuevoEstado = usuario.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    const confirmMsg = nuevoEstado === "INACTIVO"
      ? `¿Desea suspender el acceso a ${usuario.nombreUsuario}?`
      : `¿Desea reactivar la cuenta de ${usuario.nombreUsuario}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.put(`/usuarios/${usuario.idUsuario}/estado`, {
        estado: nuevoEstado,
      });
      if (res.data?.success) {
        cargarDatos();
      }
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo cambiar el estado.");
    }
  }

  async function handleCrearUsuario(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post("/usuarios", formData);
      if (res.data?.success) {
        setShowModal(false);
        cargarDatos();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error al crear cuenta de usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <span style={styles.counter}>
          Cuentas registradas: <strong>{usuarios.length}</strong>
        </span>
        <div style={styles.actions}>
          <button onClick={cargarDatos} style={styles.btnSecondary}>
            Actualizar
          </button>
          <button onClick={abrirModalCrear} style={styles.btnPrimary}>
            + Crear Usuario / Condómino
          </button>
        </div>
      </div>

      {error && <div style={styles.alertError}>{error}</div>}

      {loading ? (
        <div style={styles.emptyState}>Cargando directorio de cuentas...</div>
      ) : usuarios.length === 0 ? (
        <div style={styles.emptyState}>No hay usuarios dados de alta.</div>
      ) : (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Usuario</th>
                <th style={styles.th}>Persona Vinculada</th>
                <th style={styles.th}>Rol</th>
                <th style={styles.th}>Último Ingreso</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.idUsuario} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>@{u.nombreUsuario}</strong>
                  </td>
                  <td style={styles.td}>
                    <div>{u.persona?.nombreCompleto}</div>
                    <small style={styles.subtext}>{u.persona?.correo || u.persona?.dpi}</small>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badgeRol}>{u.rol?.nombre}</span>
                  </td>
                  <td style={styles.td}>
                    {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString() : "Nunca ha ingresado"}
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={u.estado} />
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleToggleEstado(u)}
                      style={
                        u.estado === "ACTIVO"
                          ? styles.btnSuspender
                          : styles.btnActivar
                      }
                    >
                      {u.estado === "ACTIVO" ? "Suspender" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Crear Usuario */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Crear Cuenta de Usuario</h3>
                <p style={styles.modalSubtitle}>Asigna credenciales a una persona del padrón</p>
              </div>
              <button onClick={() => setShowModal(false)} style={styles.modalClose}>✕</button>
            </div>

            <form onSubmit={handleCrearUsuario} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Persona Física (Padrón) *</label>
                <select
                  required
                  value={formData.idPersona}
                  onChange={(e) => setFormData({ ...formData, idPersona: e.target.value })}
                  style={styles.select}
                >
                  {personasSinUsuario.length === 0 ? (
                    <option value="">Todas las personas ya tienen usuario</option>
                  ) : (
                    personasSinUsuario.map((p) => (
                      <option key={p.idPersona} value={p.idPersona}>
                        {p.nombreCompleto} {p.dpi ? `(DPI: ${p.dpi})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nombre de Usuario *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. jperez"
                    value={formData.nombreUsuario}
                    onChange={(e) => setFormData({ ...formData, nombreUsuario: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Rol de Acceso *</label>
                  <select
                    required
                    value={formData.idRol}
                    onChange={(e) => setFormData({ ...formData, idRol: e.target.value })}
                    style={styles.select}
                  >
                    {roles.map((r) => (
                      <option key={r.idRol} value={r.idRol}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contraseña Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={formData.contrasena}
                  onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
                  style={styles.input}
                />
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
                <button
                  type="submit"
                  style={styles.btnPrimary}
                  disabled={saving || personasSinUsuario.length === 0}
                >
                  {saving ? "Creando..." : "Crear Usuario"}
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
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
    flexWrap: "wrap",
    gap: "10px",
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
  tableCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    overflowX: "auto",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left",
  },
  th: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    padding: "12px 14px",
    color: "var(--color-text-muted, #667085)",
    fontWeight: "600",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  tr: {
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  td: {
    padding: "12px 14px",
    color: "var(--color-text, #101828)",
  },
  subtext: {
    color: "var(--color-text-muted, #667085)",
    fontSize: "11px",
    display: "block",
  },
  badgeRol: {
    display: "inline-block",
    backgroundColor: "#EEF4FB",
    color: "var(--color-primary, #1B4B82)",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "11px",
  },
  btnSuspender: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    border: "none",
    padding: "5px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnActivar: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    border: "none",
    padding: "5px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    padding: "10px 14px",
    borderRadius: "8px",
    marginBottom: "16px",
    fontSize: "13px",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 0",
    color: "var(--color-text-muted, #667085)",
    fontSize: "14px",
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
    maxWidth: "520px",
    width: "100%",
    padding: "24px",
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
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  input: {
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  select: {
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
  },
};