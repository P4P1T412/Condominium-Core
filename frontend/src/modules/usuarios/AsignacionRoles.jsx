import { useState, useEffect } from "react";
import api from "../../api/axios";

export default function AsignacionRoles() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState("");
  const [nuevoRolId, setNuevoRolId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [resUsuarios, resRoles] = await Promise.allSettled([
        api.get("/usuarios"),
        api.get("/usuarios/roles"),
      ]);

      if (resUsuarios.status === "fulfilled" && resUsuarios.value.data?.success) {
        const uList = resUsuarios.value.data.data;
        setUsuarios(uList);
        if (uList.length > 0) {
          setSelectedUsuarioId(String(uList[0].idUsuario));
          setNuevoRolId(String(uList[0].rol.idRol));
        }
      }

      if (resRoles.status === "fulfilled" && resRoles.value.data?.success) {
        setRoles(resRoles.value.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const usuarioSeleccionado = usuarios.find(
    (u) => String(u.idUsuario) === String(selectedUsuarioId)
  );

  function handleSelectUsuario(id) {
    setSelectedUsuarioId(id);
    const u = usuarios.find((item) => String(item.idUsuario) === String(id));
    if (u) {
      setNuevoRolId(String(u.rol.idRol));
    }
    setMensaje({ tipo: "", texto: "" });
  }

  async function handleGuardarRol(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje({ tipo: "", texto: "" });

    try {
      const res = await api.put(`/usuarios/${selectedUsuarioId}/rol`, {
        idRol: Number(nuevoRolId),
      });

      if (res.data?.success) {
        setMensaje({
          tipo: "success",
          texto: "Rol asignado correctamente.",
        });
        cargarDatos();
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err.response?.data?.message || "Error al actualizar rol.",
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h3 style={styles.title}>Modificar Rol de Acceso</h3>
        <p style={styles.desc}>
          Seleccione una cuenta para revisar sus atribuciones actuales y redefinir su rol en el sistema.
        </p>

        {mensaje.texto && (
          <div style={mensaje.tipo === "success" ? styles.alertSuccess : styles.alertError}>
            {mensaje.texto}
          </div>
        )}

        {loading ? (
          <p style={styles.empty}>Cargando información de cuentas y roles...</p>
        ) : (
          <form onSubmit={handleGuardarRol} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Seleccionar Cuenta de Usuario</label>
              <select
                value={selectedUsuarioId}
                onChange={(e) => handleSelectUsuario(e.target.value)}
                style={styles.select}
              >
                {usuarios.map((u) => (
                  <option key={u.idUsuario} value={u.idUsuario}>
                    @{u.nombreUsuario} — {u.persona?.nombreCompleto} ({u.rol?.nombre})
                  </option>
                ))}
              </select>
            </div>

            {usuarioSeleccionado && (
              <div style={styles.panelInfo}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Persona asociada:</span>
                  <strong>{usuarioSeleccionado.persona?.nombreCompleto}</strong>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Rol actual:</span>
                  <span style={styles.badgeRol}>{usuarioSeleccionado.rol?.nombre}</span>
                </div>
                <p style={styles.rolDesc}>
                  {usuarioSeleccionado.rol?.descripcion || "Sin descripción de permisos registrada."}
                </p>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Nuevo Rol a Asignar</label>
              <select
                value={nuevoRolId}
                onChange={(e) => setNuevoRolId(e.target.value)}
                style={styles.select}
              >
                {roles.map((r) => (
                  <option key={r.idRol} value={r.idRol}>
                    {r.nombre} — {r.descripcion}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={guardando || !usuarioSeleccionado}
              style={styles.btnSubmit}
            >
              {guardando ? "Actualizando rol..." : "Confirmar Cambio de Rol"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "600px",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  title: {
    fontSize: "17px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 4px 0",
  },
  desc: {
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
    margin: "0 0 20px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
  },
  panelInfo: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    borderRadius: "8px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
  },
  infoLabel: {
    color: "var(--color-text-muted, #667085)",
  },
  badgeRol: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
  },
  rolDesc: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    fontStyle: "italic",
    margin: "4px 0 0 0",
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
  },
  alertSuccess: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
  },
  empty: {
    textAlign: "center",
    color: "var(--color-text-muted, #667085)",
    fontSize: "13px",
    padding: "20px 0",
  },
};