import { useState, useEffect } from "react";
import api from "../../api/axios";

export default function SolicitudesPendientes() {
  const [pendientes, setPendientes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [seleccionRoles, setSeleccionRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError("");
    try {
      const [resPendientes, resRoles] = await Promise.allSettled([
        api.get("/usuarios/pendientes"),
        api.get("/usuarios/roles"),
      ]);

      let listaRoles = [];

      if (resRoles.status === "fulfilled" && resRoles.value.data?.success) {
        listaRoles = resRoles.value.data.data;
        setRoles(listaRoles);
      }

      if (resPendientes.status === "fulfilled" && resPendientes.value.data?.success) {
        const lista = resPendientes.value.data.data;
        setPendientes(lista);

        // Rol por defecto sugerido para cada solicitud (el primero del catálogo)
        const defaults = {};
        lista.forEach((p) => {
          defaults[p.idUsuario] = String(listaRoles[0]?.idRol ?? "");
        });
        setSeleccionRoles(defaults);
      } else {
        setError("No fue posible cargar las solicitudes pendientes.");
      }
    } catch (err) {
      setError("Error de comunicación al consultar el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handleSeleccionRol(idUsuario, idRol) {
    setSeleccionRoles((prev) => ({ ...prev, [idUsuario]: idRol }));
  }

  async function handleAprobar(usuario) {
    const idRol = seleccionRoles[usuario.idUsuario];

    if (!idRol) {
      setMensaje({
        tipo: "error",
        texto: "Debe seleccionar un rol antes de aprobar la solicitud.",
      });
      return;
    }

    setProcesandoId(usuario.idUsuario);
    setMensaje({ tipo: "", texto: "" });

    try {
      const res = await api.put(`/usuarios/${usuario.idUsuario}/aprobar`, {
        idRol: Number(idRol),
      });

      if (res.data?.success) {
        setMensaje({
          tipo: "success",
          texto: `Cuenta de @${usuario.nombreUsuario} aprobada y activada correctamente.`,
        });
        await cargarDatos();
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err.response?.data?.message || "No se pudo aprobar la solicitud.",
      });
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleRechazar(usuario) {
    const confirmMsg = `¿Desea rechazar y eliminar la solicitud de ${usuario.persona?.nombreCompleto} (@${usuario.nombreUsuario})? Esta acción no se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;

    setProcesandoId(usuario.idUsuario);
    setMensaje({ tipo: "", texto: "" });

    try {
      const res = await api.delete(`/usuarios/${usuario.idUsuario}/rechazar`);

      if (res.data?.success) {
        setMensaje({
          tipo: "success",
          texto: `Solicitud de @${usuario.nombreUsuario} rechazada.`,
        });
        await cargarDatos();
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err.response?.data?.message || "No se pudo rechazar la solicitud.",
      });
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <span style={styles.counter}>
          Solicitudes pendientes: <strong>{pendientes.length}</strong>
        </span>
        <button onClick={cargarDatos} style={styles.btnSecondary}>
          Actualizar
        </button>
      </div>

      {error && <div style={styles.alertError}>{error}</div>}

      {mensaje.texto && (
        <div style={mensaje.tipo === "success" ? styles.alertSuccess : styles.alertError}>
          {mensaje.texto}
        </div>
      )}

      {loading ? (
        <div style={styles.emptyState}>Cargando solicitudes pendientes...</div>
      ) : pendientes.length === 0 ? (
        <div style={styles.emptyState}>
          No hay solicitudes pendientes de aprobación.
        </div>
      ) : (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Solicitante</th>
                <th style={styles.th}>Contacto</th>
                <th style={styles.th}>DPI</th>
                <th style={styles.th}>Usuario</th>
                <th style={styles.th}>Rol a Asignar</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((u) => (
                <tr key={u.idUsuario} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{u.persona?.nombreCompleto}</strong>
                    <small style={styles.subtext}>
                      Solicitado el{" "}
                      {u.fechaCreacion
                        ? new Date(u.fechaCreacion).toLocaleDateString()
                        : "—"}
                    </small>
                  </td>
                  <td style={styles.td}>
                    <div>{u.persona?.correo || "—"}</div>
                    <small style={styles.subtext}>{u.persona?.telefono || "—"}</small>
                  </td>
                  <td style={styles.td}>{u.persona?.dpi || "—"}</td>
                  <td style={styles.td}>
                    <strong>@{u.nombreUsuario}</strong>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={seleccionRoles[u.idUsuario] || ""}
                      onChange={(e) => handleSeleccionRol(u.idUsuario, e.target.value)}
                      style={styles.select}
                      disabled={procesandoId === u.idUsuario}
                    >
                      {roles.length === 0 ? (
                        <option value="">Sin roles disponibles</option>
                      ) : (
                        roles.map((r) => (
                          <option key={r.idRol} value={r.idRol}>
                            {r.nombre}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        onClick={() => handleAprobar(u)}
                        style={styles.btnAprobar}
                        disabled={procesandoId === u.idUsuario}
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleRechazar(u)}
                        style={styles.btnRechazar}
                        disabled={procesandoId === u.idUsuario}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    verticalAlign: "middle",
  },
  subtext: {
    color: "var(--color-text-muted, #667085)",
    fontSize: "11px",
    display: "block",
  },
  select: {
    padding: "7px 10px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    minWidth: "150px",
  },
  actionGroup: {
    display: "flex",
    gap: "8px",
  },
  btnAprobar: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    border: "none",
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnRechazar: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    border: "none",
    padding: "6px 14px",
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
  alertSuccess: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
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
};
