import { useEffect, useState } from "react";
import Tabs from "../../components/Tabs";
import api from "../../api/axios";
import "./FinanceStyles.css";

const money = (value) => `Q ${Number(value || 0).toFixed(2)}`;
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatPeriod(periodo) {
  const match = String(periodo || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return periodo;
  return `${MONTHS[Number(match[2]) - 1] || match[2]} ${match[1]}`;
}

function StatementTab({ rows, loading, error, onApplyPayment, onViewRequest }) {
  function downloadReceipt(idPago) {
    api.get(`/pagos/${idPago}/recibo`, { responseType: "blob" }).then((response) => {
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recibo-pago-${idPago}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="finance-card">
      {error && <p className="finance-error">{error}</p>}
      {loading ? <p className="finance-empty">Cargando estado de cuenta...</p> : !rows.length ? (
        <p className="finance-empty">No hay cuotas asociadas a su cuenta.</p>
      ) : (
        <div className="finance-list finance-account-list">
          {rows.map((row) => (
            <div className="finance-row" key={`${row.tipo}-${row.idCuota || row.idMulta}`}>
              <div><div className="finance-strong">{row.concepto}</div><div className="finance-muted">Casa {row.casa} · {row.periodo}</div></div>
              <div>Cargos: <strong>{money(row.monto)}</strong></div>
              <div>Pagado: <strong>{money(row.pagado)}</strong><br />Saldo: <strong>{money(row.saldo)}</strong></div>
              <div className="finance-actions">
                <span className={`finance-badge ${row.estadoPago === "PENDIENTE" ? "warning" : row.estadoPago === "RECHAZADO" ? "danger" : row.estado === "VENCIDA" ? "danger" : row.estado === "PENDIENTE" ? "warning" : ""}`}>
                  {row.estadoPago === "PENDIENTE" ? "PENDIENTE DE AUTORIZACIÓN" : row.estadoPago === "RECHAZADO" ? "PAGO RECHAZADO" : row.estado}
                </span>
                {row.aplicable && row.saldo > 0 && <button className="finance-button" onClick={() => onApplyPayment(row)}>Aplicar pago</button>}
                {row.estadoPago && <button className="finance-button secondary" onClick={() => onViewRequest(row)}>Ver solicitud</button>}
                {row.idPago && <button className="finance-button secondary" onClick={() => downloadReceipt(row.idPago)}>Recibo</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentForm({ rows, selectedRow, onSubmitted }) {
  const [form, setForm] = useState({ idCuota: selectedRow?.idCuota || "", idMulta: selectedRow?.idMulta || "", monto: selectedRow?.saldo || "", fechaPago: new Date().toISOString().slice(0, 10), metodo: "TRANSFERENCIA", referencia: "" });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const applicable = rows
    .filter((row) => row.aplicable && row.saldo > 0)
    .sort((first, second) => String(first.periodo).localeCompare(String(second.periodo)));
  useEffect(() => {
    if (selectedRow) {
      setForm((current) => ({ ...current, idCuota: selectedRow.idCuota || "", idMulta: selectedRow.idMulta || "", monto: selectedRow.saldo }));
    }
  }, [selectedRow]);

  function selectPeriod(event) {
    const row = applicable.find((item) => String(item.idCuota || `multa-${item.idMulta}`) === event.target.value);
    setForm((current) => ({
      ...current,
      idCuota: row?.idCuota || "",
      idMulta: row?.idMulta || "",
      monto: row?.saldo || "",
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) {
      setMessage("Debe adjuntar el comprobante del depósito.");
      return;
    }
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    payload.append("comprobante", file);
    try {
      await api.post("/pagos/reportar", payload, { headers: { "Content-Type": "multipart/form-data" } });
      await onSubmitted();
      setMessage("Pago enviado. Queda pendiente de validación administrativa.");
      setForm({ ...form, monto: "", referencia: "" });
      setFile(null);
    } catch (err) {
      setMessage(err.response?.data?.message || "No se pudo reportar el pago.");
    }
  }

  return (
    <form className="finance-card finance-form" onSubmit={submit}>
      <h3>Reportar pago</h3>
      <p className="finance-muted">Adjunta tu comprobante para que administración lo valide.</p>
      {message && <p className="finance-muted">{message}</p>}
      <label>Cargo
        <select value={form.idCuota || (form.idMulta ? `multa-${form.idMulta}` : "")} onChange={selectPeriod} required>
          <option value="">Seleccione el cargo</option>
          {applicable.map((row) => {
            const value = row.idCuota || `multa-${row.idMulta}`;
            return <option key={value} value={value}>{row.casa} · {row.tipo === "MULTA" ? row.concepto : formatPeriod(row.periodo)} · saldo {money(row.saldo)}</option>;
          })}
        </select>
      </label>
      <div className="finance-form-grid">
        <label>Monto (Q)<input type="number" min="0.01" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required /></label>
        <label>Fecha de pago<input type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} required /></label>
        <label>Método<select value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}><option>TRANSFERENCIA</option><option>DEPOSITO</option><option>EFECTIVO</option><option>TARJETA</option><option>OTRO</option></select></label>
        <label>Referencia<input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></label>
      </div>
      <label>Comprobante (PDF, JPG o PNG)<input type="file" accept=".pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></label>
      <button className="finance-button" type="submit" disabled={!applicable.length}>Reportar pago</button>
    </form>
  );
}

export default function ResidentPayments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("statement");
  const [selectedRow, setSelectedRow] = useState(null);
  const [requestRow, setRequestRow] = useState(null);
  const [confirmation, setConfirmation] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await api.get("/pagos/estado-cuenta");
      setRows(response.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo cargar su estado de cuenta.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function applyPayment(row) {
    setSelectedRow(row);
    setActiveTab("payment");
  }

  function viewRequest(row) {
    setRequestRow(row);
  }

  async function handleSubmitted() {
    await load();
    setActiveTab("statement");
    setConfirmation("Pago enviado correctamente. Queda pendiente de autorización del administrador.");
  }

  const tabs = [
    { id: "statement", label: "Estado de Cuenta", content: <StatementTab rows={rows} loading={loading} error={error} onApplyPayment={applyPayment} onViewRequest={viewRequest} /> },
    { id: "payment", label: "Aplicar Pago", disabled: activeTab !== "payment", content: <PaymentForm rows={rows} selectedRow={selectedRow} onSubmitted={handleSubmitted} /> },
  ];
  return (
    <>
      {confirmation && <div className="finance-card"><p className="finance-muted">{confirmation}</p></div>}
      <Tabs tabs={tabs} defaultTab="statement" activeTab={activeTab} onTabChange={setActiveTab} />
      {requestRow && (
        <div className="finance-modal-backdrop" role="presentation" onClick={() => setRequestRow(null)}>
          <div className="finance-modal finance-form" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="finance-modal-header">
              <h3>Detalle de solicitud de pago</h3>
              <button className="finance-close" onClick={() => setRequestRow(null)} aria-label="Cerrar">×</button>
            </div>
            <p><strong>Casa:</strong> {requestRow.casa}</p>
            <p><strong>Periodo:</strong> {requestRow.periodo}</p>
            <p><strong>Monto:</strong> {money(requestRow.monto)}</p>
            <p><strong>Estado:</strong> {requestRow.estadoPago === "PENDIENTE" ? "Pendiente de autorización" : "Rechazado"}</p>
            {requestRow.estadoPago === "RECHAZADO" && <p className="finance-error"><strong>Motivo:</strong> {requestRow.observacionPago || "Sin comentario"}</p>}
            <p><strong>Monto reportado:</strong> {money(requestRow.pagoMonto)}</p>
            <p><strong>Fecha reportada:</strong> {requestRow.pagoFecha ? new Date(requestRow.pagoFecha).toLocaleDateString() : "No disponible"}</p>
            <p><strong>Método:</strong> {requestRow.pagoMetodo || "No disponible"}</p>
            <p><strong>Referencia:</strong> {requestRow.pagoReferencia || "Sin referencia"}</p>
            {requestRow.estadoPago === "RECHAZADO" && (
              <button className="finance-button" onClick={() => { setRequestRow(null); applyPayment(requestRow); }}>Volver a enviar solicitud</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
