import { useEffect, useState } from "react";
import Tabs from "../../components/Tabs";
import api from "../../api/axios";
import "./FinanceStyles.css";

const money = (value) => `Q ${Number(value || 0).toFixed(2)}`;

function ValidationTab() {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [rejectingPayment, setRejectingPayment] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");

  async function load() {
    try {
      const response = await api.get("/pagos/pendientes");
      setPayments(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "No se pudieron cargar los comprobantes.");
    }
  }

  useEffect(() => { load(); }, []);

  async function validate(idPago, estado, observacion = "") {
    try {
      await api.put(`/pagos/${idPago}/validar`, { estado, observacion });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo actualizar el pago.");
    }
  }

  async function openPreview(payment) {
    try {
      const response = await api.get(`/pagos/${payment.idPago}/comprobante`, { responseType: "blob" });
      setPreviewUrl(URL.createObjectURL(response.data));
      setPreviewType(response.headers["content-type"] || "");
      setSelectedPayment(payment);
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo cargar el comprobante.");
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewType("");
    setSelectedPayment(null);
  }

  return (
    <div className="finance-card">
      {error && <p className="finance-error">{error}</p>}
      {!payments.length ? <p className="finance-empty">No hay comprobantes pendientes de validación.</p> : (
        <div className="finance-list">
          {payments.map((payment) => (
            <div className="finance-row" key={payment.idPago}>
              <div>
                <div className="finance-strong">Casa {payment.casa} · {payment.periodo}</div>
                <div className="finance-muted">{payment.propietario} · {payment.metodo}</div>
                <div className="finance-muted">Ref. {payment.referencia || "Sin referencia"}</div>
              </div>
              <div className="finance-strong">{money(payment.monto)}</div>
              <div className="finance-muted">
                {payment.comprobanteUrl ? (
                  <button className="finance-button secondary" onClick={() => openPreview(payment)}>Ver comprobante</button>
                ) : "Sin archivo"}
              </div>
              <div className="finance-actions">
                <button className="finance-button" onClick={() => validate(payment.idPago, "VALIDO")}>Aceptar</button>
                <button className="finance-button danger" onClick={() => { setRejectingPayment(payment); setRejectionReason(""); }}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedPayment && (
        <div className="finance-modal-backdrop" role="presentation" onClick={closePreview}>
          <div className="finance-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title" onClick={(event) => event.stopPropagation()}>
            <div className="finance-modal-header">
              <div>
                <h3 id="receipt-title">Comprobante de pago</h3>
                <p className="finance-muted">Casa {selectedPayment.casa} · {selectedPayment.periodo} · {money(selectedPayment.monto)}</p>
              </div>
              <button className="finance-close" onClick={closePreview} aria-label="Cerrar">×</button>
            </div>
            {previewType.includes("pdf") ? (
              <iframe className="finance-modal-preview" src={previewUrl} title="Comprobante PDF" />
            ) : (
              <img className="finance-modal-preview" src={previewUrl} alt="Comprobante de pago" />
            )}
            <div className="finance-modal-footer">
              <button className="finance-button" onClick={() => { const payment = selectedPayment; closePreview(); validate(payment.idPago, "VALIDO"); }}>Aceptar</button>
              <button className="finance-button danger" onClick={() => { const payment = selectedPayment; closePreview(); setRejectingPayment(payment); setRejectionReason(""); }}>Rechazar</button>
            </div>
          </div>
        </div>
      )}
      {rejectingPayment && (
        <div className="finance-modal-backdrop" role="presentation" onClick={() => setRejectingPayment(null)}>
          <form className="finance-modal finance-form" role="dialog" aria-modal="true" onSubmit={async (event) => {
            event.preventDefault();
            if (!rejectionReason.trim()) return;
            await validate(rejectingPayment.idPago, "RECHAZADO", rejectionReason.trim());
            setRejectingPayment(null);
          }} onClick={(event) => event.stopPropagation()}>
            <div className="finance-modal-header">
              <h3>Rechazar comprobante</h3>
              <button type="button" className="finance-close" onClick={() => setRejectingPayment(null)} aria-label="Cerrar">×</button>
            </div>
            <p className="finance-muted">Indique el motivo que verá el condómino.</p>
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Motivo del rechazo" required />
            <div className="finance-modal-footer">
              <button type="button" className="finance-button secondary" onClick={() => setRejectingPayment(null)}>Cancelar</button>
              <button className="finance-button danger" type="submit">Confirmar rechazo</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function GeneralStatementTab() {
  const [rows, setRows] = useState([]);
  const [houses, setHouses] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ desde: "", hasta: "", idCasa: "" });

  async function load(nextFilters = filters) {
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const response = await api.get("/pagos/estado-cuenta-general", { params });
      setRows(response.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo cargar el estado general.");
    }
  }

  useEffect(() => {
    load();
    api.get("/casas").then((response) => setHouses(response.data.data || []));
  }, []);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    const emptyFilters = { desde: "", hasta: "", idCasa: "" };
    setFilters(emptyFilters);
    load(emptyFilters);
  }

  return (
    <div className="finance-card">
      <div className="finance-filter-section finance-form">
        <div className="finance-filter-bar">
          <label>Desde
            <input type="date" value={filters.desde} onChange={(event) => updateFilter("desde", event.target.value)} />
          </label>
          <label>Hasta
            <input type="date" value={filters.hasta} onChange={(event) => updateFilter("hasta", event.target.value)} />
          </label>
          <label>Casa
            <select value={filters.idCasa} onChange={(event) => updateFilter("idCasa", event.target.value)}>
              <option value="">Todas las casas</option>
              {houses.map((house) => <option key={house.id} value={house.id}>{house.numeroCasa} - {house.propietario?.nombre}</option>)}
            </select>
          </label>
          <div className="finance-actions">
            <button className="finance-button" type="button" onClick={() => load()}>Filtrar</button>
            <button className="finance-button secondary" type="button" onClick={clearFilters}>Limpiar</button>
          </div>
        </div>
      </div>
      {error && <p className="finance-error">{error}</p>}
      {!rows.length ? <p className="finance-empty">No hay cuotas para los filtros seleccionados.</p> : (
        <div className="finance-list">
          {rows.map((row) => (
            <div className="finance-row" key={row.idCasa}>
              <div><div className="finance-strong">Casa {row.casa}</div><div className="finance-muted">{row.propietario}</div></div>
              <div>Cargos: <strong>{money(row.cargos)}</strong></div>
              <div>Pagado: <strong>{money(row.pagado)}</strong><br />Saldo: <strong>{money(row.saldo)}</strong></div>
              <span className={`finance-badge ${row.estado === "MOROSO" ? "danger" : row.estado === "PENDIENTE" ? "warning" : ""}`}>{row.estado}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DelinquentTab() {
  const [rows, setRows] = useState([]);
  const [houses, setHouses] = useState([]);
  const [filters, setFilters] = useState({ desde: "", hasta: "", idCasa: "" });
  const [error, setError] = useState("");
  const [form, setForm] = useState({ idCasa: "", motivo: "Recargo por mora", monto: "", fechaVencimiento: "" });
  const [message, setMessage] = useState("");
  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  async function load(nextFilters = filters) {
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const response = await api.get("/pagos/multas", { params });
      setRows(response.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "No se pudieron cargar las moras.");
    }
  }
  useEffect(() => {
    load();
    api.get("/casas").then((response) => setHouses(response.data.data || []));
  }, []);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    const emptyFilters = { desde: "", hasta: "", idCasa: "" };
    setFilters(emptyFilters);
    load(emptyFilters);
  }

  async function submit(event) {
    event.preventDefault();
    try {
      await api.post("/pagos/multas", form);
      setMessage("Recargo registrado correctamente.");
      setForm({ ...form, monto: "" });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "No se pudo registrar el recargo.");
    }
  }

  return (
    <div className="finance-form-grid">
      <div className="finance-card">
        <h3>Moras actuales</h3>
        <div className="finance-form">
          <div className="finance-form-grid">
            <label>Desde<input type="date" value={filters.desde} onChange={(e) => updateFilter("desde", e.target.value)} /></label>
            <label>Hasta<input type="date" value={filters.hasta} onChange={(e) => updateFilter("hasta", e.target.value)} /></label>
          </div>
          <label>Casa
            <select value={filters.idCasa} onChange={(e) => updateFilter("idCasa", e.target.value)}>
              <option value="">Todas las casas</option>
              {houses.map((house) => <option key={house.id} value={house.id}>{house.numeroCasa} - {house.propietario?.nombre}</option>)}
            </select>
          </label>
          <div className="finance-actions">
            <button className="finance-button" type="button" onClick={() => load()}>Filtrar</button>
            <button className="finance-button secondary" type="button" onClick={clearFilters}>Limpiar</button>
          </div>
        </div>
        {error && <p className="finance-error">{error}</p>}
        {!rows.length ? <p className="finance-empty">No hay moras actuales para los filtros seleccionados.</p> : rows.map((row) => (
          <div className="finance-row" key={row.idMulta}>
            <div>
              <div className="finance-strong">Casa {row.casa}</div>
              <div className="finance-muted">{row.motivo}</div>
            </div>
            <div className="finance-strong">{money(row.monto)}</div>
            <div className="finance-muted">
              Emisión: {new Date(row.fechaMulta).toLocaleDateString("es-GT")}<br />
              Vence: {new Date(row.fechaVencimiento).toLocaleDateString("es-GT")}
            </div>
            <span className="finance-badge danger">{row.estado}</span>
          </div>
        ))}
      </div>
      <form className="finance-card finance-form" onSubmit={submit}>
        <h3>Aplicar recargo por mora</h3>
        {message && <p className="finance-muted">{message}</p>}
        <label>Casa
          <select value={form.idCasa} onChange={(e) => setForm({ ...form, idCasa: e.target.value })} required>
            <option value="">Seleccione una casa</option>
            {houses.map((house) => <option key={house.id} value={house.id}>{house.numeroCasa} - {house.propietario?.nombre}</option>)}
          </select>
        </label>
        <label>Motivo<input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required /></label>
        <div className="finance-form-grid">
          <label>Monto (Q)<input type="number" min="0.01" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required /></label>
          <label>Vence<input type="date" min={todayString} value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} required /></label>
        </div>
        <button className="finance-button" type="submit">Emitir recargo</button>
      </form>
    </div>
  );
}

export default function AdminFinance() {
  const tabs = [
    { id: "validation", label: "Validación de Comprobantes", content: <ValidationTab /> },
    { id: "general", label: "Estado de Cuenta General", content: <GeneralStatementTab /> },
    { id: "delinquent", label: "Reporte de Morosos", content: <DelinquentTab /> },
  ];
  return <Tabs tabs={tabs} defaultTab="validation" />;
}
