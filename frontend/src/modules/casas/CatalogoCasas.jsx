import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

const CAMPOS_PLANTILLA = [
  { columna: "Numero", obligatoria: "Sí", ejemplo: "A-101" },
  { columna: "Bloque", obligatoria: "Recomendada", ejemplo: "BLOQUE A" },
  { columna: "Direccion", obligatoria: "Recomendada", ejemplo: "Calle Principal Casa 1" },
  { columna: "Tipo", obligatoria: "No", ejemplo: "CASA" },
  { columna: "Estado", obligatoria: "No", ejemplo: "DISPONIBLE" },
  { columna: "Observaciones", obligatoria: "No", ejemplo: "Notas internas" },
  { columna: "DPI / Id Propietario", obligatoria: "No", ejemplo: "1234567890101" },
];

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

  // Estado del módulo de carga masiva desde Excel
  const fileInputRef = useRef(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);

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

  // ---------------------------------------------------------------------------
  // Carga masiva desde Excel
  // ---------------------------------------------------------------------------
  function abrirModalCargaMasiva() {
    setBulkFile(null);
    setBulkResult(null);
    setBulkError("");
    setBulkOwnerId("");
    setBulkDragging(false);
    setShowTemplate(false);
    setShowBulkModal(true);
  }

  function cerrarModalCargaMasiva() {
    if (bulkUploading) return;
    setShowBulkModal(false);
    setBulkFile(null);
    setBulkResult(null);
    setBulkError("");
    setBulkOwnerId("");
    setBulkDragging(false);
    setShowTemplate(false);
    // Refresca el catálogo al cerrar el modal
    cargarDatosIniciales();
  }

  function seleccionarArchivoExcel(file) {
    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(extension)) {
      setBulkFile(null);
      setBulkResult(null);
      setBulkError("Formato no válido. Seleccione un archivo .xlsx o .xls.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setBulkFile(null);
      setBulkResult(null);
      setBulkError("El archivo supera el tamaño máximo permitido de 10 MB.");
      return;
    }

    setBulkFile(file);
    setBulkResult(null);
    setBulkError("");
  }

  function handleArchivoChange(event) {
    seleccionarArchivoExcel(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDropExcel(event) {
    event.preventDefault();
    setBulkDragging(false);
    if (bulkUploading) return;
    seleccionarArchivoExcel(event.dataTransfer.files?.[0]);
  }

  async function handleCargaMasiva() {
    if (!bulkFile) {
      setBulkError("Seleccione un archivo Excel antes de procesar la carga.");
      return;
    }

    setBulkUploading(true);
    setBulkError("");
    setBulkResult(null);

    const payload = new FormData();
    payload.append("archivo", bulkFile);
    if (bulkOwnerId) payload.append("idPropietario", bulkOwnerId);

    try {
      const response = await api.post("/casas/carga-masiva", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data?.success) {
        setBulkResult(response.data.data);
      } else {
        setBulkError(response.data?.message || "No se pudo procesar el archivo.");
      }
    } catch (err) {
      setBulkError(
        err.response?.data?.message || "Error de comunicación al procesar el archivo Excel."
      );
    } finally {
      setBulkUploading(false);
    }
  }

  async function descargarPlantilla() {
    try {
      const response = await api.get("/casas/carga-masiva/plantilla", {
        responseType: "blob",
      });

      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla-carga-casas.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBulkError("No se pudo descargar la plantilla. Intente nuevamente.");
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
          <button onClick={abrirModalCargaMasiva} style={styles.btnExcel}>
            <FileSpreadsheet size={15} />
            Carga Masiva Excel
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
          {casas.map((casa) => {
            // El censo es la fuente de verdad: si hay habitantes activos la
            // vivienda se muestra ocupada aunque el estado persistido esté viejo.
            const estadoVisual = casa.estado === "INACTIVA"
              ? "INACTIVA"
              : Number(casa.totalHabitantes) > 0
                ? "OCUPADA"
                : "DISPONIBLE";

            return (
            <div key={casa.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Casa {casa.numeroCasa}</h3>
                  <span style={styles.cardSubtitle}>Bloque {casa.bloque}</span>
                </div>
                <StatusBadge status={estadoVisual} />
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
            );
          })}
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

      {/* Modal: Carga masiva desde Excel */}
      {showBulkModal && (
        <div style={styles.modalOverlay} onClick={cerrarModalCargaMasiva}>
          <div
            style={{ ...styles.modalContent, maxWidth: "680px" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div style={styles.bulkHeader}>
                <div style={styles.bulkIconBadge}>
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h2 style={styles.modalTitle}>Carga Masiva de Casas</h2>
                  <p style={styles.modalSubtitle}>
                    Importe varias viviendas desde un archivo Excel (.xlsx / .xls)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cerrarModalCargaMasiva}
                style={styles.modalClose}
                disabled={bulkUploading}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.bulkTemplateBar}>
              <span style={styles.bulkTemplateText}>
                Plantilla recomendada: <strong>Numero, Bloque, Direccion, Tipo</strong>
              </span>
              <div style={styles.bulkTemplateActions}>
                <button
                  type="button"
                  onClick={() => setShowTemplate((visible) => !visible)}
                  style={styles.linkButton}
                >
                  {showTemplate ? "Ocultar estructura" : "Ver estructura"}
                </button>
                <button type="button" onClick={descargarPlantilla} style={styles.linkButton}>
                  <Download size={14} />
                  Descargar plantilla
                </button>
              </div>
            </div>

            {showTemplate && (
              <div style={styles.templateBox}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Columna</th>
                      <th style={styles.th}>Obligatoria</th>
                      <th style={styles.th}>Ejemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAMPOS_PLANTILLA.map((campo) => (
                      <tr key={campo.columna} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{campo.columna}</strong>
                        </td>
                        <td style={styles.td}>{campo.obligatoria}</td>
                        <td style={styles.td}>{campo.ejemplo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={styles.templateNote}>
                  También se aceptan variaciones como "Número", "No.", "Manzana" o
                  "Dirección". Las columnas Estado, Observaciones y DPI son opcionales;
                  si no se indica propietario, la casa se asigna a un titular pendiente.
                </p>
              </div>
            )}

            <div style={styles.bulkField}>
              <label style={styles.label}>Propietario por defecto (opcional)</label>
              <select
                value={bulkOwnerId}
                onChange={(event) => setBulkOwnerId(event.target.value)}
                style={styles.select}
                disabled={bulkUploading}
              >
                <option value="">-- Propietario pendiente de asignación --</option>
                {personas.map((persona) => (
                  <option key={persona.idPersona} value={persona.idPersona}>
                    {persona.nombreCompleto} {persona.dpi ? `(DPI: ${persona.dpi})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!bulkUploading) fileInputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (!bulkUploading && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!bulkUploading) setBulkDragging(true);
              }}
              onDragLeave={() => setBulkDragging(false)}
              onDrop={handleDropExcel}
              style={{
                ...styles.dropzone,
                ...(bulkDragging ? styles.dropzoneActive : {}),
                ...(bulkUploading ? styles.dropzoneDisabled : {}),
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleArchivoChange}
                style={{ display: "none" }}
              />

              {bulkFile ? (
                <>
                  <FileSpreadsheet size={32} color="var(--color-primary, #1B4B82)" />
                  <strong style={styles.dropzoneFileName}>{bulkFile.name}</strong>
                  <span style={styles.dropzoneHint}>
                    {(bulkFile.size / 1024).toFixed(1)} KB · Clic para reemplazar el archivo
                  </span>
                </>
              ) : (
                <>
                  <Upload size={30} color="var(--color-primary, #1B4B82)" />
                  <strong style={styles.dropzoneFileName}>
                    Arrastre y suelte el archivo Excel aquí
                  </strong>
                  <span style={styles.dropzoneHint}>
                    o haga clic para seleccionarlo (.xlsx / .xls, máx. 10 MB)
                  </span>
                </>
              )}
            </div>

            {bulkError && (
              <div style={{ ...styles.alertError, marginTop: "14px" }}>{bulkError}</div>
            )}

            {bulkResult && (
              <div
                style={{
                  ...styles.bulkResult,
                  ...(bulkResult.creados === 0 ? styles.bulkResultWarning : {}),
                }}
              >
                <div style={styles.bulkResultSummary}>
                  {bulkResult.creados > 0 ? (
                    <CheckCircle2 size={24} color="#15803D" />
                  ) : (
                    <AlertTriangle size={24} color="#B45309" />
                  )}
                  <div>
                    <strong
                      style={{
                        ...styles.bulkResultTitle,
                        ...(bulkResult.creados === 0 ? styles.bulkResultTitleWarning : {}),
                      }}
                    >
                      {bulkResult.creados > 0
                        ? `${bulkResult.creados} casa(s) creada(s) exitosamente`
                        : "No se pudo crear ninguna casa"}
                    </strong>
                    <p style={styles.bulkResultText}>
                      {bulkResult.totalProcesados} fila(s) procesada(s) ·{" "}
                      {bulkResult.omitidos} omitida(s) por duplicado ·{" "}
                      {bulkResult.errores.length} con error
                    </p>
                  </div>
                </div>

                {bulkResult.omitidosDetalle?.length > 0 && (
                  <details style={styles.bulkDetails}>
                    <summary style={styles.bulkSummaryWarning}>
                      Ver detalle de duplicados omitidos ({bulkResult.omitidosDetalle.length})
                    </summary>
                    <ul style={styles.bulkList}>
                      {bulkResult.omitidosDetalle.map((item, index) => (
                        <li key={`omitido-${index}`}>
                          Fila {item.fila}: Casa {item.numero} ({item.bloque}) — {item.motivo}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {bulkResult.errores.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <p style={styles.bulkErrorTitle}>
                      <AlertTriangle size={14} />
                      Filas con errores ({bulkResult.errores.length})
                    </p>
                    <div style={styles.bulkErrorTableWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, width: "70px" }}>Fila</th>
                            <th style={styles.th}>Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkResult.errores.map((error, index) => (
                            <tr key={`error-${index}`} style={styles.tr}>
                              <td style={styles.td}>{error.fila}</td>
                              <td style={styles.td}>{error.motivo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={cerrarModalCargaMasiva}
                style={styles.btnSecondary}
                disabled={bulkUploading}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleCargaMasiva}
                style={styles.btnPrimaryWithIcon}
                disabled={bulkUploading || !bulkFile}
              >
                {bulkUploading ? (
                  <>
                    <Loader2 size={15} className="spin" />
                    Procesando archivo...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Procesar carga
                  </>
                )}
              </button>
            </div>
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
    flexWrap: "wrap",
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
  btnExcel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#ECFDF5",
    color: "#047857",
    border: "1px solid #A7F3D0",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  btnPrimaryWithIcon: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  bulkHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    minWidth: 0,
  },
  bulkIconBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    backgroundColor: "#EEF4FB",
    color: "var(--color-primary, #1B4B82)",
    flexShrink: 0,
  },
  bulkTemplateBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    backgroundColor: "var(--color-bg, #F7F9FC)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "14px",
  },
  bulkTemplateText: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  bulkTemplateActions: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: 0,
    background: "none",
    border: "none",
    color: "var(--color-primary, #1B4B82)",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  templateBox: {
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "14px",
    overflowX: "auto",
  },
  templateNote: {
    fontSize: "11px",
    lineHeight: 1.5,
    color: "var(--color-text-muted, #667085)",
    margin: "10px 0 0 0",
  },
  bulkField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "14px",
  },
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textAlign: "center",
    padding: "26px 18px",
    borderRadius: "10px",
    border: "2px dashed #C7D7EA",
    backgroundColor: "#F8FBFF",
    cursor: "pointer",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
  },
  dropzoneActive: {
    borderColor: "var(--color-primary, #1B4B82)",
    backgroundColor: "#EEF4FB",
  },
  dropzoneDisabled: {
    opacity: 0.65,
    cursor: "wait",
  },
  dropzoneFileName: {
    fontSize: "13px",
    color: "var(--color-text, #101828)",
    wordBreak: "break-word",
  },
  dropzoneHint: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  bulkResult: {
    marginTop: "14px",
    border: "1px solid #BBF7D0",
    backgroundColor: "#F0FDF4",
    borderRadius: "10px",
    padding: "14px",
  },
  bulkResultWarning: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  bulkResultSummary: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  bulkResultTitle: {
    display: "block",
    fontSize: "14px",
    color: "#166534",
  },
  bulkResultTitleWarning: {
    color: "#92400E",
  },
  bulkResultText: {
    margin: "3px 0 0 0",
    fontSize: "12px",
    color: "#15803D",
  },
  bulkDetails: {
    marginTop: "10px",
    fontSize: "12px",
    color: "#92400E",
  },
  bulkSummaryWarning: {
    cursor: "pointer",
    fontWeight: "600",
  },
  bulkList: {
    margin: "8px 0 0 0",
    paddingLeft: "20px",
    lineHeight: 1.6,
  },
  bulkErrorTitle: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    margin: "0 0 8px 0",
    fontSize: "12px",
    fontWeight: "700",
    color: "#991B1B",
  },
  bulkErrorTableWrapper: {
    maxHeight: "170px",
    overflowY: "auto",
    backgroundColor: "#FFFFFF",
    border: "1px solid #FECACA",
    borderRadius: "6px",
  },
};