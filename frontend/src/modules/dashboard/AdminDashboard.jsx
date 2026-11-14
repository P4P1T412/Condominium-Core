import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Home,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Accesos directos operativos (Fila 3)
// ---------------------------------------------------------------------------
const ACCESOS_DIRECTOS = [
  {
    icon: Upload,
    label: "Carga Masiva de Casas",
    description: "Importar viviendas desde Excel",
    to: "/casas",
  },
  {
    icon: CircleDollarSign,
    label: "Registrar Pago",
    description: "Validar comprobantes y cuotas",
    to: "/pagos",
  },
  {
    icon: Megaphone,
    label: "Crear Aviso General",
    description: "Comunicado a todo el condominio",
    to: "/notificaciones",
  },
  {
    icon: ClipboardList,
    label: "Ver Bitácora de Garita",
    description: "Ingresos y salidas del día",
    to: "/visitas",
  },
];

const TONO_AZUL = { fondo: "#EEF4FB", texto: "#1B4B82" };
const TONO_VERDE = { fondo: "#ECFDF5", texto: "#047857" };
const TONO_CIEN = { fondo: "#E0F2FE", texto: "#0369A1" };
const TONO_ROJO = { fondo: "#FEE2E2", texto: "#991B1B" };
const TONO_VERDE_CLARO = { fondo: "#DCFCE7", texto: "#15803D" };

/** Formatea montos en Quetzales: Q 1,234.50 */
function dinero(valor) {
  const monto = Number(valor || 0);
  return `Q ${monto.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Formatea enteros con separador de miles. */
function entero(valor) {
  return Number(valor || 0).toLocaleString("es-GT");
}

/** "2026-11" -> "noviembre 2026" */
function textoPeriodo(periodo) {
  const partes = String(periodo || "").match(/^(\d{4})-(\d{2})$/);
  if (!partes) return "";
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, 1);
  return fecha.toLocaleDateString("es-GT", { month: "long", year: "numeric" });
}

/** Hora local de la última actualización. */
function horaActualizacion(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Barra de progreso reutilizable (sin librerías externas). */
function BarraProgreso({ porcentaje, color }) {
  const ancho = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  return (
    <div style={styles.progressTrack}>
      <div
        style={{
          ...styles.progressFill,
          width: `${ancho}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/** Tarjeta KPI de la Fila 1. */
function TarjetaKPI({ icon: Icon, titulo, valor, unidad, tono, pie, children }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiHeader}>
        <span
          style={{
            ...styles.kpiIcon,
            backgroundColor: tono.fondo,
            color: tono.texto,
          }}
        >
          <Icon size={18} />
        </span>
        <span style={styles.kpiTitle}>{titulo}</span>
      </div>

      <div style={styles.kpiValueRow}>
        <span style={styles.kpiValue}>{valor}</span>
        {unidad && <span style={styles.kpiUnit}>{unidad}</span>}
      </div>

      {children}

      {pie && <div style={styles.kpiFoot}>{pie}</div>}
    </div>
  );
}

/** Fila de dos estadísticas compactas dentro de una tarjeta KPI. */
function MiniEstadistica({ etiqueta, valor, alerta }) {
  return (
    <div style={styles.miniStat}>
      <span style={styles.miniStatLabel}>{etiqueta}</span>
      <span
        style={{
          ...styles.miniStatValue,
          ...(alerta ? styles.miniStatValueAlerta : {}),
        }}
      >
        {valor}
      </span>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /**
   * Carga las métricas consolidadas. En la primera carga muestra el
   * indicador completo; en las siguientes conserva los datos anteriores
   * y solo bloquea el botón de actualización.
   */
  async function cargarMetricas({ inicial = false } = {}) {
    if (inicial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const response = await api.get("/dashboard/admin");
      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError("No fue posible cargar las métricas del dashboard.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Error de comunicación con el servidor. Verifique su sesión."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    cargarMetricas({ inicial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ Estados UI
  if (loading && !data) {
    return (
      <div style={styles.stateBox}>
        <Loader2 size={30} color="#1B4B82" className="spin" />
        <p style={styles.stateText}>Cargando métricas del condominio...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.stateBox}>
        <AlertTriangle size={30} color="#B45309" />
        <p style={styles.stateText}>{error}</p>
        <button
          type="button"
          style={styles.btnPrimary}
          onClick={() => cargarMetricas({ inicial: true })}
        >
          <RefreshCw size={15} />
          Reintentar
        </button>
      </div>
    );
  }

  const viviendas = data?.viviendas || {};
  const finanzas = data?.finanzas || {};
  const operacion = data?.operacion || {};
  const pendientes = data?.pendientes || { eventos: [], quejas: [] };

  const morosidadAlerta = Number(finanzas.cuotasVencidas || 0) > 0;
  const hayPendientes = Number(pendientes.total || 0) > 0;
  const sinCuotasPeriodo = Number(finanzas.cuotasEmitidas || 0) === 0;

  return (
    <div style={styles.container}>
      {/* ------------------------------------------------------------ Header */}
      <header style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Dashboard Estratégico</h1>
          <p style={styles.pageSubtitle}>
            Resumen operativo para la toma de decisiones
            {finanzas.periodo ? ` · ${textoPeriodo(finanzas.periodo)}` : ""}
          </p>
        </div>

        <div style={styles.headerActions}>
          <span style={styles.updatedAt}>
            {data?.generadoEn
              ? `Actualizado ${horaActualizacion(data.generadoEn)}`
              : ""}
          </span>
          <button
            type="button"
            style={{
              ...styles.btnPrimary,
              opacity: refreshing ? 0.7 : 1,
              cursor: refreshing ? "wait" : "pointer",
            }}
            onClick={() => cargarMetricas()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            {refreshing ? "Actualizando..." : "Actualizar métricas"}
          </button>
        </div>
      </header>

      {error && <div style={styles.alertError}>{error}</div>}

      {/* ----------------------------------------- Fila 1: Tarjetas KPI (4) */}
      <section style={styles.kpiGrid}>
        {/* 1. Ocupación Residencial */}
        <TarjetaKPI
          icon={Home}
          titulo="Ocupación Residencial"
          valor={`${entero(viviendas.ocupadas)} / ${entero(viviendas.totalCasas)}`}
          unidad="casas"
          tono={TONO_AZUL}
          pie={`${entero(viviendas.disponibles)} disponibles · ${entero(
            viviendas.inactivas
          )} inactivas · ${entero(viviendas.residentesActivos)} residentes activos`}
        >
          <div style={styles.kpiProgressRow}>
            <BarraProgreso
              porcentaje={viviendas.porcentajeOcupacion}
              color="#1B4B82"
            />
            <span style={styles.kpiProgressLabel}>
              {Number(viviendas.porcentajeOcupacion || 0).toFixed(1)}%
            </span>
          </div>
        </TarjetaKPI>

        {/* 2. Recaudación del Mes */}
        <TarjetaKPI
          icon={Wallet}
          titulo="Recaudación del Mes"
          valor={dinero(finanzas.recaudadoMes)}
          tono={TONO_VERDE}
          pie={
            morosidadAlerta
              ? `${entero(finanzas.cuotasVencidas)} cuotas vencidas · ${dinero(
                  finanzas.montoVencido
                )} en mora`
              : "Sin morosidad vigente"
          }
        >
          <div style={styles.kpiProgressRow}>
            <BarraProgreso
              porcentaje={finanzas.porcentajeCobranza}
              color="#059669"
            />
            <span style={styles.kpiProgressLabel}>
              {sinCuotasPeriodo
                ? "Sin emisión"
                : `${Number(finanzas.porcentajeCobranza || 0).toFixed(1)}%`}
            </span>
          </div>
          <div style={styles.kpiCaption}>
            {sinCuotasPeriodo
              ? `Sin cuotas emitidas en ${textoPeriodo(finanzas.periodo) || "el período"}`
              : `${Number(finanzas.porcentajeCumplimiento || 0).toFixed(
                  1
                )}% de cumplimiento · ${dinero(finanzas.montoPorValidar)} por validar`}
          </div>
          <div
            style={{
              ...styles.alertPill,
              backgroundColor: morosidadAlerta ? "#FEF3C7" : "#DCFCE7",
              color: morosidadAlerta ? "#92400E" : "#15803D",
            }}
          >
            {morosidadAlerta ? (
              <AlertTriangle size={13} />
            ) : (
              <CheckCircle2 size={13} />
            )}
            {morosidadAlerta
              ? `${entero(finanzas.cuotasPendientes)} cuotas con saldo · ${dinero(
                  finanzas.montoPendiente
                )}`
              : "Cartera al día"}
          </div>
        </TarjetaKPI>

        {/* 3. Pulso de Garita */}
        <TarjetaKPI
          icon={ShieldCheck}
          titulo="Pulso de Garita"
          valor={entero(operacion.visitasDentro)}
          unidad="visitas dentro"
          tono={TONO_CIEN}
          pie={`${entero(
            operacion.ingresosEsperadosHoy
          )} ingresos esperados hoy`}
        >
          <div style={styles.miniGrid}>
            <MiniEstadistica
              etiqueta="Autorizadas hoy"
              valor={entero(operacion.autorizadasHoy)}
            />
            <MiniEstadistica
              etiqueta="Pendientes hoy"
              valor={entero(operacion.pendientesHoy)}
              alerta={Number(operacion.pendientesHoy || 0) > 0}
            />
            <MiniEstadistica
              etiqueta="Entradas hoy"
              valor={entero(operacion.entradasHoy)}
            />
            <MiniEstadistica
              etiqueta="Servicios vigentes"
              valor={entero(operacion.serviciosVigentes)}
            />
          </div>
        </TarjetaKPI>

        {/* 4. Atención Requerida */}
        <TarjetaKPI
          icon={AlertTriangle}
          titulo="Atención Requerida"
          valor={entero(pendientes.total)}
          unidad="accionables"
          tono={hayPendientes ? TONO_ROJO : TONO_VERDE_CLARO}
          pie={
            hayPendientes
              ? `${entero(pendientes.totalEventos)} eventos por aprobar · ${entero(
                  pendientes.totalQuejas
                )} quejas sin resolver`
              : "No hay pendientes críticos"
          }
        >
          <div style={styles.attentionRow}>
            <span
              style={{
                ...styles.attentionChip,
                backgroundColor: "#FEF3C7",
                color: "#92400E",
              }}
            >
              {entero(pendientes.totalEventos)} eventos
            </span>
            <span
              style={{
                ...styles.attentionChip,
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
              }}
            >
              {entero(pendientes.totalQuejas)} quejas
            </span>
          </div>
        </TarjetaKPI>
      </section>

      {/* ------------------- Fila 2: Paneles de acción rápida (2 columnas) */}
      <section style={styles.twoColumnGrid}>
        {/* Eventos Masivos por Aprobar */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitleRow}>
              <CalendarDays size={16} color="#1B4B82" />
              <h2 style={styles.panelTitle}>Eventos Masivos por Aprobar</h2>
            </div>
            <span style={styles.panelBadge}>{entero(pendientes.totalEventos)}</span>
          </div>

          {!pendientes.eventos?.length ? (
            <p style={styles.emptyText}>
              No hay eventos pendientes de aprobación. Todo está al día.
            </p>
          ) : (
            <ul style={styles.list}>
              {pendientes.eventos.map((evento) => (
                <li key={evento.idEvento} style={styles.listItem}>
                  <div style={styles.itemMain}>
                    <span style={styles.itemTitle}>{evento.nombreEvento}</span>
                    <span style={styles.itemMeta}>
                      Casa {evento.numeroCasa || "s/n"} · {evento.solicitante}
                    </span>
                    <span style={styles.itemMeta}>
                      Evento: {evento.fechaEvento || "sin fecha"} · Solicitado:{" "}
                      {evento.fechaSolicitud || "—"}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={styles.btnSmall}
                    onClick={() => navigate("/visitas")}
                    title="Gestionar el evento en el módulo de Visitas"
                  >
                    Gestionar
                    <ArrowRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div style={styles.panelFooter}>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => navigate("/visitas")}
            >
              Ir a Visitas y Eventos
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Últimas Quejas y Sugerencias */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitleRow}>
              <AlertTriangle size={16} color="#B45309" />
              <h2 style={styles.panelTitle}>Últimas Quejas y Sugerencias</h2>
            </div>
            <span style={styles.panelBadge}>{entero(pendientes.totalQuejas)}</span>
          </div>

          {!pendientes.quejas?.length ? (
            <p style={styles.emptyText}>
              No hay quejas ni sugerencias pendientes de atención.
            </p>
          ) : (
            <ul style={styles.list}>
              {pendientes.quejas.map((queja) => (
                <li key={queja.idQueja} style={styles.listItem}>
                  <div style={styles.itemMain}>
                    <span style={styles.itemTitle}>{queja.asunto}</span>
                    <span style={styles.itemMeta}>
                      {queja.numeroCasa ? `Casa ${queja.numeroCasa}` : "Sin casa"} ·{" "}
                      {queja.remitente}
                    </span>
                    <span style={styles.itemMeta}>
                      {queja.fechaCreacion || "—"} ·{" "}
                      {queja.estado === "EN_PROCESO" ? "En proceso" : "Pendiente"}
                      {queja.sinRespuesta ? " · Sin respuesta" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    style={styles.btnSmall}
                    onClick={() => navigate("/notificaciones")}
                    title="Abrir el buzón en el módulo de Comunicaciones"
                  >
                    Abrir
                    <ArrowRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div style={styles.panelFooter}>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => navigate("/notificaciones")}
            >
              Ir a Comunicaciones
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- Fila 3: Accesos directos operativos (atajos) */}
      <section style={styles.quickSection}>
        <div style={styles.quickHeader}>
          <h2 style={styles.sectionTitle}>Accesos Directos Operativos</h2>
          <span style={styles.sectionHint}>Atajos para las tareas más frecuentes</span>
        </div>

        <div style={styles.quickGrid}>
          {ACCESOS_DIRECTOS.map(({ icon: Icon, label, description, to }) => (
            <button
              key={`${to}-${label}`}
              type="button"
              style={styles.quickCard}
              onClick={() => navigate(to)}
            >
              <span style={styles.quickIcon}>
                <Icon size={18} />
              </span>
              <span style={styles.quickText}>
                <span style={styles.quickLabel}>{label}</span>
                <span style={styles.quickDescription}>{description}</span>
              </span>
              <ArrowRight size={16} style={styles.quickArrow} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    maxWidth: "1280px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  // ------------------------------------------------------------- Estados
  stateBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    minHeight: "340px",
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "32px",
    textAlign: "center",
  },
  stateText: {
    margin: 0,
    fontSize: "14px",
    color: "var(--color-text-muted, #667085)",
  },
  // ------------------------------------------------------------- Header
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "14px",
    marginBottom: "20px",
  },
  pageTitle: {
    margin: "0 0 4px 0",
    fontSize: "24px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
  },
  pageSubtitle: {
    margin: 0,
    fontSize: "14px",
    color: "var(--color-text-muted, #667085)",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  updatedAt: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    border: "1px solid #FCA5A5",
    padding: "10px 14px",
    borderRadius: "8px",
    marginBottom: "16px",
    fontSize: "13px",
  },
  // --------------------------------------------------------- Fila 1: KPI
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  kpiCard: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  },
  kpiHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  kpiIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    flexShrink: 0,
  },
  kpiTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--color-text-muted, #667085)",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  kpiValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    flexWrap: "wrap",
  },
  kpiValue: {
    fontSize: "26px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    lineHeight: 1.15,
  },
  kpiUnit: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text-muted, #667085)",
  },
  kpiProgressRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  kpiProgressLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    minWidth: "62px",
    textAlign: "right",
  },
  progressTrack: {
    flex: 1,
    height: "8px",
    backgroundColor: "#E5E7EB",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.4s ease",
  },
  kpiCaption: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    lineHeight: 1.5,
  },
  alertPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    alignSelf: "flex-start",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
  },
  kpiFoot: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    lineHeight: 1.5,
    borderTop: "1px solid var(--color-border, #E5E7EB)",
    paddingTop: "9px",
    marginTop: "auto",
  },
  miniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  miniStat: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    borderRadius: "8px",
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    border: "1px solid var(--color-border, #E5E7EB)",
  },
  miniStatLabel: {
    fontSize: "11px",
    color: "var(--color-text-muted, #667085)",
  },
  miniStatValue: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
  },
  miniStatValueAlerta: {
    color: "#B45309",
  },
  attentionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  attentionChip: {
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "700",
  },
  // -------------------------------------------------- Fila 2: Dos paneles
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    paddingBottom: "12px",
    marginBottom: "6px",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  panelTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  panelTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
  },
  panelBadge: {
    backgroundColor: "var(--color-bg, #F7F9FC)",
    border: "1px solid var(--color-border, #E5E7EB)",
    color: "var(--color-text, #101828)",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "12px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },
  emptyText: {
    margin: "18px 0",
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
    fontStyle: "italic",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: 1,
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    backgroundColor: "var(--color-bg, #F7F9FC)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "10px",
    padding: "10px 12px",
  },
  itemMain: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: 0,
  },
  itemTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemMeta: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  btnSmall: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    color: "var(--color-primary, #1B4B82)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "7px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  panelFooter: {
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
    display: "flex",
    justifyContent: "flex-end",
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--color-primary, #1B4B82)",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  // ------------------------------------------------ Fila 3: Atajos rápidos
  quickSection: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "18px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  },
  quickHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
  },
  sectionHint: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  quickCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textAlign: "left",
    backgroundColor: "var(--color-bg, #F7F9FC)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "10px",
    padding: "12px 14px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  quickIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    backgroundColor: "#EEF4FB",
    color: "var(--color-primary, #1B4B82)",
    flexShrink: 0,
  },
  quickText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
    minWidth: 0,
  },
  quickLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
  },
  quickDescription: {
    fontSize: "11px",
    color: "var(--color-text-muted, #667085)",
  },
  quickArrow: {
    color: "var(--color-text-muted, #667085)",
    flexShrink: 0,
  },
};
