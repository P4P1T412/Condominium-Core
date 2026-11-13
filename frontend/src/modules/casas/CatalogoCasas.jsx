import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import StatusBadge from "../../components/StatusBadge";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Search,
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

// ---------------------------------------------------------------------------
// Doble vista (Tarjetas / Lista) y reglas de paginación
// ---------------------------------------------------------------------------
const CLAVE_VISTA = "casas_view_mode";
const VISTA_TARJETAS = "tarjetas";
const VISTA_LISTA = "lista";

// 9 tarjetas = cuadrícula de 3 × 3 · 15 filas = tabla compacta
const LIMITE_POR_VISTA = { [VISTA_TARJETAS]: 9, [VISTA_LISTA]: 15 };
const ESTADOS_CASA = ["OCUPADA", "DISPONIBLE", "INACTIVA"];

/** Lee la preferencia de vista persistida por el administrador. */
function leerVistaGuardada() {
  try {
    return localStorage.getItem(CLAVE_VISTA) === VISTA_LISTA ? VISTA_LISTA : VISTA_TARJETAS;
  } catch {
    return VISTA_TARJETAS;
  }
}

/**
 * Estado visual calculado a partir del censo: la cantidad de residentes
 * activos es la fuente de verdad de la ocupación de la vivienda.
 */
function estadoVisualCasa(casa) {
  if (casa.estado === "INACTIVA") return "INACTIVA";
  return Number(casa.totalHabitantes) > 0 ? "OCUPADA" : "DISPONIBLE";
}

/** Evita subtítulos redundantes como "Bloque BLOQUE A". */
function formatearBloque(bloque) {
  const texto = String(bloque || "").trim();
  if (!texto) return "Sin bloque";
  return /^bloque/i.test(texto) ? texto : `Bloque ${texto}`;
}

/**
 * Ventana inteligente de números de página:
 * ej. 1 ... 4 5 6 ... 45
 */
function obtenerPaginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const candidatas = new Set([1, total, actual - 1, actual, actual + 1]);
  const paginas = [...candidatas]
    .filter((pagina) => pagina >= 1 && pagina <= total)
    .sort((a, b) => a - b);

  const resultado = [];
  let anterior = 0;
  paginas.forEach((pagina) => {
    if (pagina - anterior > 1) resultado.push("...");
    resultado.push(pagina);
    anterior = pagina;
  });
  return resultado;
}

export default function CatalogoCasas() {
  const [casas, setCasas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Paginación real del lado del servidor y filtros dinámicos
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [bloqueFilter, setBloqueFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [bloques, setBloques] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 9, totalPages: 1 });
  const [refreshKey, setRefreshKey] = useState(0);

  // Doble vista: tarjetas o lista (persistida en localStorage)
  const [viewMode, setViewMode] = useState(leerVistaGuardada);
  const limit = LIMITE_POR_VISTA[viewMode] ?? 9;

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

  // Debounce del buscador (400 ms): evita una petición por cada tecla y
  // reinicia automáticamente a la página 1 cuando el texto cambia.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Catálogo de personas para los selectores de propietario (solo al montar)
  useEffect(() => {
    cargarPersonas();
  }, []);

  // Listado de casas según página, vista y filtros activos.
  // La función vive dentro del efecto para declarar las dependencias de
  // forma explícita; la bandera "cancelado" descarta las respuestas
  // obsoletas cuando el usuario cambia de página o de filtro.
  useEffect(() => {
    let cancelado = false;

    async function cargarCasas() {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit };
        if (debouncedSearch) params.search = debouncedSearch;
        if (bloqueFilter) params.bloque = bloqueFilter;
        if (estadoFilter) params.estado = estadoFilter;

        const response = await api.get("/casas", { params });
        if (cancelado) return;

        if (response.data?.success) {
          setCasas(response.data.data || []);
          setBloques(response.data.bloques || []);

          const paginacion = response.data.pagination;
          if (paginacion) {
            // Si el backend recortó la página (ej. tras guardar o eliminar),
            // se sincroniza el estado para no mostrar una página vacía.
            if (paginacion.page !== page) setPage(paginacion.page);
            setPagination(paginacion);
          } else {
            const total = response.data.data?.length || 0;
            setPagination({ total, page: 1, limit: total || 1, totalPages: 1 });
          }
        } else {
          setError("No fue posible cargar el listado de casas.");
        }
      } catch {
        if (!cancelado) setError("Error de comunicación al consultar el servidor.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    cargarCasas();

    return () => {
      cancelado = true;
    };
  }, [page, debouncedSearch, bloqueFilter, estadoFilter, limit, refreshKey]);

  /**
   * Recarga el catálogo de personas para los dropdowns de propietario.
   */
  async function cargarPersonas() {
    try {
      const response = await api.get("/casas/personas");
      if (response.data?.success) setPersonas(response.data.data || []);
    } catch {
      // El padrón de personas es secundario: no bloquea el listado de casas.
    }
  }

  /**
   * Recarga la página actual conservando búsqueda y filtros.
   * Lo usan los modales de Crear, Editar y Carga Masiva tras guardar.
   */
  function recargarCatalogo() {
    setRefreshKey((clave) => clave + 1);
  }

  function cambiarBusqueda(evento) {
    setSearchText(evento.target.value);
  }

  function limpiarBusqueda() {
    setSearchText("");
  }

  function cambiarBloque(evento) {
    setBloqueFilter(evento.target.value);
    setPage(1);
  }

  function cambiarEstado(evento) {
    setEstadoFilter(evento.target.value);
    setPage(1);
  }

  function cambiarVista(modo) {
    if (modo === viewMode) return;
    setViewMode(modo);
    setPage(1);
    try {
      localStorage.setItem(CLAVE_VISTA, modo);
    } catch {
      // localStorage no disponible: la vista se mantiene solo en memoria.
    }
  }

  function hayFiltrosActivos() {
    return Boolean(debouncedSearch || bloqueFilter || estadoFilter);
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
        // Recarga la página actual (conservando filtros) para ver el cambio
        recargarCatalogo();
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
    // Refresca la página actual del catálogo al cerrar el modal
    recargarCatalogo();
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

  // Valores derivados para el pie de paginación
  const desde = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const hasta = Math.min(pagination.page * pagination.limit, pagination.total);
  const paginasVisibles = obtenerPaginasVisibles(pagination.page, pagination.totalPages);

  return (
    <div style={styles.container}>
      {/* Barra de herramientas */}
      <div style={styles.toolbar}>
        <span style={styles.counter}>
          Total de viviendas registradas: <strong>{pagination.total}</strong>
        </span>
        <div style={styles.actions}>
          <button
            onClick={() => {
              recargarCatalogo();
              cargarPersonas();
            }}
            style={styles.btnSecondary}
          >
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

      {/* Barra unificada: buscador con debounce, filtros y selector de vista */}
      <div style={styles.filterBar}>
        <div style={styles.searchWrapper}>
          <Search size={15} style={styles.searchIcon} />
          <input
            type="text"
            value={searchText}
            onChange={cambiarBusqueda}
            placeholder="Buscar por número de casa, propietario o DPI..."
            aria-label="Buscar viviendas"
            style={styles.searchInput}
          />
          {searchText && (
            <button
              type="button"
              onClick={limpiarBusqueda}
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
              style={styles.searchClear}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={bloqueFilter}
          onChange={cambiarBloque}
          aria-label="Filtrar por bloque"
          style={styles.filterSelect}
        >
          <option value="">Todos los bloques</option>
          {bloques.map((bloque) => (
            <option key={bloque} value={bloque}>
              {bloque}
            </option>
          ))}
        </select>

        <select
          value={estadoFilter}
          onChange={cambiarEstado}
          aria-label="Filtrar por estado"
          style={styles.filterSelect}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_CASA.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>

        <div style={styles.viewToggle} role="group" aria-label="Selector de vista">
          <button
            type="button"
            onClick={() => cambiarVista(VISTA_TARJETAS)}
            title="Vista de tarjetas"
            style={{
              ...styles.viewBtn,
              ...(viewMode === VISTA_TARJETAS ? styles.viewBtnActive : {}),
            }}
          >
            <LayoutGrid size={15} />
            Tarjetas
          </button>
          <button
            type="button"
            onClick={() => cambiarVista(VISTA_LISTA)}
            title="Vista de lista"
            style={{
              ...styles.viewBtn,
              ...(viewMode === VISTA_LISTA ? styles.viewBtnActive : {}),
            }}
          >
            <List size={15} />
            Lista
          </button>
        </div>
      </div>

      {error && <div style={styles.alertError}>{error}</div>}

      {loading ? (
        <div style={styles.emptyState}>Cargando catálogo residencial...</div>
      ) : casas.length === 0 ? (
        <div style={styles.emptyState}>
          {hayFiltrosActivos()
            ? "No se encontraron viviendas que coincidan con los filtros aplicados."
            : "No hay viviendas registradas en el sistema."}
        </div>
      ) : viewMode === VISTA_LISTA ? (
        /* ------------------------- VISTA LISTA ------------------------- */
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Casa / Número</th>
                <th style={styles.th}>Bloque</th>
                <th style={styles.th}>Dirección</th>
                <th style={styles.th}>Propietario Titular</th>
                <th style={styles.th}>Habitantes</th>
                <th style={styles.th}>Estado</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {casas.map((casa) => (
                <tr key={casa.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 700 }}>{casa.numeroCasa}</td>
                  <td style={styles.td}>{casa.bloque || "—"}</td>
                  <td style={{ ...styles.td, ...styles.cellEllipsis }}>
                    {casa.direccion || "—"}
                  </td>
                  <td style={styles.td}>
                    {casa.propietario?.nombre || "Sin propietario asignado"}
                  </td>
                  <td style={styles.td}>
                    {casa.totalHabitantes}{" "}
                    {Number(casa.totalHabitantes) === 1 ? "residente" : "residentes"}
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={estadoVisualCasa(casa)} />
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => verExpediente(casa.id)}
                      title="Ver Expediente"
                      aria-label="Ver Expediente"
                      style={styles.btnIconAction}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => abrirModalEditar(casa)}
                      title="Editar Casa"
                      aria-label="Editar Casa"
                      style={styles.btnIconAction}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ------------------------ VISTA TARJETAS ----------------------- */
        <div style={styles.grid}>
          {casas.map((casa) => (
            <div key={casa.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>Casa {casa.numeroCasa}</h3>
                  <span style={styles.cardSubtitle}>{formatearBloque(casa.bloque)}</span>
                </div>
                <StatusBadge status={estadoVisualCasa(casa)} />
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

      {/* Controles de paginación al pie de la vista */}
      {!loading && pagination.total > 0 && (
        <div style={styles.paginationBar}>
          <span style={styles.paginationInfo}>
            Mostrando {desde}–{hasta} de {pagination.total} viviendas
          </span>
          <div style={styles.paginationControls}>
            <button
              type="button"
              onClick={() => setPage((pagina) => Math.max(pagina - 1, 1))}
              disabled={pagination.page <= 1}
              style={{
                ...styles.paginationNavBtn,
                ...(pagination.page <= 1 ? styles.paginationNavBtnDisabled : {}),
              }}
            >
              Anterior
            </button>

            {paginasVisibles.map((item, indice) =>
              item === "..." ? (
                <span key={`gap-${indice}`} style={styles.pageGap}>
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  style={item === pagination.page ? styles.pageBtnActive : styles.pageBtn}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage((pagina) => pagina + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                ...styles.paginationNavBtn,
                ...(pagination.page >= pagination.totalPages
                  ? styles.paginationNavBtnDisabled
                  : {}),
              }}
            >
              Siguiente
            </button>
          </div>
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
                  {formatearBloque(selectedCasa.bloque)} — {selectedCasa.direccion}
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
  filterBar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "18px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
    boxSizing: "border-box",
  },
  searchWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    flex: "1 1 260px",
    minWidth: "220px",
  },
  searchIcon: {
    position: "absolute",
    left: "10px",
    color: "var(--color-text-muted, #667085)",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "8px 32px 8px 32px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    color: "var(--color-text, #101828)",
    outline: "none",
    boxSizing: "border-box",
  },
  searchClear: {
    position: "absolute",
    right: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    background: "none",
    border: "none",
    color: "var(--color-text-muted, #667085)",
    cursor: "pointer",
  },
  filterSelect: {
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    minWidth: "160px",
    maxWidth: "220px",
    cursor: "pointer",
    boxSizing: "border-box",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  viewToggle: {
    display: "flex",
    marginLeft: "auto",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  viewBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    border: "none",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text-muted, #667085)",
    cursor: "pointer",
  },
  viewBtnActive: {
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
  },
  tableWrapper: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    overflowX: "auto",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  cellEllipsis: {
    maxWidth: "260px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  btnIconAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    marginLeft: "6px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    cursor: "pointer",
  },
  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "18px",
    paddingTop: "14px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
  },
  paginationInfo: {
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
  },
  paginationNavBtn: {
    padding: "7px 14px",
    fontSize: "13px",
    fontWeight: "600",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    cursor: "pointer",
  },
  paginationNavBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  pageBtn: {
    minWidth: "32px",
    padding: "7px 0",
    fontSize: "13px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #E5E7EB)",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    cursor: "pointer",
  },
  pageBtnActive: {
    minWidth: "32px",
    padding: "7px 0",
    fontSize: "13px",
    fontWeight: "700",
    borderRadius: "6px",
    border: "1px solid var(--color-primary, #1B4B82)",
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    cursor: "pointer",
  },
  pageGap: {
    padding: "0 4px",
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
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
    // Fija 3 columnas para mantener la cuadrícula de 3 × 3 con limit=9
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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