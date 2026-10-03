import "./StatusBadge.css";

/**
 * Mapeo de estados del sistema contra esquemas de color institucional.
 * Centraliza la semántica visual para todo el condominio.
 */
const STATUS_COLORS = {
  // Éxito / Operativo normal
  ACTIVO: "green",
  HABITADA: "green",
  OCUPADA: "green",
  RESUELTO: "green",
  VALIDO: "green",

  // Informativo / En proceso
  DISPONIBLE: "blue",
  EN_PROCESO: "blue",

  // Atención / Pendientes
  PENDIENTE: "amber",

  // Bajas / Deshabilitados
  INACTIVO: "gray",

  // Alertas / Fallas / Rechazos
  RECHAZADO: "red",
  MOROSO: "red",
};

/**
 * Insignia visual estándar para estados.
 *
 * @param {string} status - Texto del estado (ej: 'ACTIVO', 'HABITADA', 'PENDIENTE').
 */
export default function StatusBadge({ status }) {
  if (!status) return null;

  // Normaliza el texto a mayúsculas para buscar el color correcto
  const normalizedStatus = String(status).toUpperCase();
  const color = STATUS_COLORS[normalizedStatus] || "gray";

  return (
    <span className={`status-badge status-badge--${color}`}>
      {status}
    </span>
  );
}