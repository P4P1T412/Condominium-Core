import { useState, useEffect, useMemo } from "react";
import api from "../../api/axios";
import {
  Search,
  UserPlus,
  UserMinus,
  Home,
  MapPin,
  Users,
  Building2,
  DoorOpen,
  Phone,
  IdCard,
  Plus,
  X,
  RefreshCw,
  UserRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

/**
 * Pestaña 2: Censo y Núcleo Familiar
 *
 * Diseño maestro-detalle centrado en la vivienda:
 *   1. Panel izquierdo: directorio de casas navegable y filtrable.
 *   2. Panel derecho: núcleo familiar de la casa seleccionada y
 *      vinculación contextual de habitantes (buscar existente o
 *      registrar una persona nueva y vincularla en un solo paso).
 */

// Catálogo de tipos de residente permitidos por la BD (ck_residente_tipo).
const TIPOS_RESIDENTE = [
  { value: "PROPIETARIO", label: "Titular / Propietario" },
  { value: "FAMILIAR", label: "Familiar (cónyuge, hijo, pariente)" },
  { value: "INQUILINO", label: "Inquilino (arrendatario)" },
  { value: "OTRO", label: "Otro" },
];

// Etiquetas y colores por tipo de residente (insignias).
const BADGE_POR_TIPO = {
  PROPIETARIO: { text: "Propietario", bg: "#DBEAFE", color: "#1E40AF" },
  FAMILIAR: { text: "Familiar", bg: "#DCFCE7", color: "#166534" },
  INQUILINO: { text: "Inquilino", bg: "#FEF3C7", color: "#92400E" },
  OTRO: { text: "Otro", bg: "#F1F5F9", color: "#475569" },
};

const BADGE_TITULAR = { text: "Titular", bg: "#DBEAFE", color: "#1E40AF" };

/** Devuelve la insignia (texto + colores) de un residente. */
function obtenerBadge(residente) {
  if (residente.esPrincipal) return BADGE_TITULAR;
  return BADGE_POR_TIPO[residente.tipoResidente] || {
    text: residente.tipoResidente,
    bg: "#F1F5F9",
    color: "#475569",
  };
}

/** Iniciales para el avatar de una persona. */
function iniciales(nombre) {
  return String(nombre || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() || "")
    .join("");
}

export default function CensoFamiliar() {
  const [casas, setCasas] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [selectedHouseId, setSelectedHouseId] = useState(null);
  const [selectedCasa, setSelectedCasa] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingCasas, setLoadingCasas] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Vinculación contextual
  const [isAddingResident, setIsAddingResident] = useState(false);
  const [addMode, setAddMode] = useState("search"); // "search" | "new"
  const [tipoResidente, setTipoResidente] = useState("PROPIETARIO");
  const [esPrincipal, setEsPrincipal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tipo: "success" | "error", texto }

  // Desvinculación de residentes
  const [residenteAQuitar, setResidenteAQuitar] = useState(null);
  const [removiendo, setRemoviendo] = useState(false);

  // Modo "Buscar existente"
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);

  // Modo "Nuevo registro"
  const [personaForm, setPersonaForm] = useState({
    nombres: "",
    apellidos: "",
    dpi: "",
    telefono: "",
    correo: "",
  });

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    if (selectedHouseId) cargarDetalle(selectedHouseId);
  }, [selectedHouseId]);

  async function cargarInicial() {
    setLoadingCasas(true);
    try {
      const [resCasas, resPersonas] = await Promise.allSettled([
        api.get("/casas"),
        api.get("/casas/personas"),
      ]);

      let listaCasas = [];
      if (resCasas.status === "fulfilled" && resCasas.value.data?.success) {
        listaCasas = resCasas.value.data.data || [];
        setCasas(listaCasas);
      } else {
        setFeedback({
          tipo: "error",
          texto: "No fue posible cargar el directorio de viviendas.",
        });
      }

      if (resPersonas.status === "fulfilled" && resPersonas.value.data?.success) {
        setPersonas(resPersonas.value.data.data || []);
      }

      if (listaCasas.length > 0) {
        setSelectedHouseId(listaCasas[0].id);
      }
    } catch (err) {
      setFeedback({
        tipo: "error",
        texto: "Error de comunicación con el servidor al cargar el censo.",
      });
    } finally {
      setLoadingCasas(false);
    }
  }

  async function cargarCasas() {
    try {
      const res = await api.get("/casas");
      if (res.data?.success) setCasas(res.data.data || []);
    } catch (err) {
      /* silencioso: el detalle ya muestra el error principal */
    }
  }

  async function cargarPersonas() {
    try {
      const res = await api.get("/casas/personas");
      if (res.data?.success) setPersonas(res.data.data || []);
    } catch (err) {
      /* silencioso */
    }
  }

  async function cargarDetalle(idCasa) {
    setLoadingDetalle(true);
    try {
      const res = await api.get(`/casas/${idCasa}`);
      if (res.data?.success) setSelectedCasa(res.data.data);
    } catch (err) {
      setSelectedCasa(null);
      setFeedback({
        tipo: "error",
        texto:
          err.response?.data?.message ||
          "No se pudo obtener el expediente de la vivienda.",
      });
    } finally {
      setLoadingDetalle(false);
    }
  }

  // Refresca directorio, padrón de personas y expediente de la casa activa.
  async function refrescar() {
    await Promise.all([
      cargarCasas(),
      cargarPersonas(),
      selectedHouseId ? cargarDetalle(selectedHouseId) : Promise.resolve(),
    ]);
  }

  // ----- Derivados -----

  const filteredCasas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return casas;
    return casas.filter((c) =>
      `${c.numeroCasa} ${c.bloque} ${c.propietario?.nombre || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [casas, searchQuery]);

  const tieneTitular = Boolean(
    selectedCasa?.residentes?.some((r) => r.esPrincipal)
  );

  const personasDisponibles = useMemo(() => {
    const idsResidentes = new Set(
      (selectedCasa?.residentes || []).map((r) => String(r.idPersona))
    );
    const q = personSearch.trim().toLowerCase();
    return personas
      .filter((p) => !idsResidentes.has(String(p.idPersona)))
      .filter(
        (p) =>
          !q ||
          `${p.nombreCompleto || ""} ${p.dpi || ""}`.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [personas, personSearch, selectedCasa]);

  const notificacion = useMemo(() => {
    const texto = feedback?.texto || "";
    if (/duplicad|ya existe|ORA-00001/i.test(texto)) {
      return "Esa persona ya figura vinculada a una vivienda o el DPI ya está registrado.";
    }
    return texto;
  }, [feedback]);

  // Contador global del censo (a partir del resumen de cada vivienda).
  const stats = useMemo(() => {
    const totalCasas = casas.length;
    const habitantes = casas.reduce(
      (suma, c) => suma + (Number(c.totalHabitantes) || 0),
      0
    );
    const ocupadas = casas.filter((c) => Number(c.totalHabitantes) > 0).length;
    return {
      totalCasas,
      habitantes,
      ocupadas,
      vacantes: totalCasas - ocupadas,
    };
  }, [casas]);

  // ----- Acciones -----

  function abrirPanelVinculacion() {
    setIsAddingResident(true);
    setAddMode("search");
    setPersonSearch("");
    setSelectedPersonaId(null);
    // Si la casa aún no tiene titular, se sugiere registrar uno principal.
    setTipoResidente(tieneTitular ? "FAMILIAR" : "PROPIETARIO");
    setEsPrincipal(!tieneTitular);
    setFeedback(null);
  }

  function cerrarPanelVinculacion() {
    setIsAddingResident(false);
    setSelectedPersonaId(null);
    setPersonSearch("");
    setPersonaForm({ nombres: "", apellidos: "", dpi: "", telefono: "", correo: "" });
  }

  function seleccionarCasa(id) {
    if (String(id) === String(selectedHouseId)) return;
    setSelectedHouseId(id);
    setSelectedCasa(null);
    setFeedback(null);
    cerrarPanelVinculacion();
  }

  // Vincula una persona ya registrada en el padrón.
  async function handleVincularExistente() {
    if (!selectedPersonaId) {
      setFeedback({ tipo: "error", texto: "Seleccione una persona de la lista." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.post(`/casas/${selectedCasa.id}/residentes`, {
        idPersona: Number(selectedPersonaId),
        tipoResidente,
        esPrincipal: esPrincipal && !tieneTitular,
      });

      if (res.data?.success) {
        const persona = personas.find(
          (p) => String(p.idPersona) === String(selectedPersonaId)
        );
        setFeedback({
          tipo: "success",
          texto: `${persona?.nombreCompleto || "La persona"} fue vinculada a Casa ${selectedCasa.numeroCasa}.`,
        });
        cerrarPanelVinculacion();
        await refrescar();
      }
    } catch (err) {
      setFeedback({
        tipo: "error",
        texto:
          err.response?.data?.message ||
          "No se pudo vincular a la persona en la vivienda.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Registra una persona nueva y la vincula en un solo paso.
  async function handleCrearYVincular(e) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const resPersona = await api.post("/casas/personas", personaForm);
      if (!resPersona.data?.success) {
        throw new Error(resPersona.data?.message || "No se pudo registrar la persona.");
      }

      const nueva = resPersona.data.data;

      const resVinculo = await api.post(`/casas/${selectedCasa.id}/residentes`, {
        idPersona: Number(nueva.idPersona),
        tipoResidente,
        esPrincipal: esPrincipal && !tieneTitular,
      });

      if (resVinculo.data?.success) {
        setFeedback({
          tipo: "success",
          texto: `${nueva.nombreCompleto} fue registrada y vinculada a Casa ${selectedCasa.numeroCasa}.`,
        });
        cerrarPanelVinculacion();
        await refrescar();
      }
    } catch (err) {
      setFeedback({
        tipo: "error",
        texto:
          err.response?.data?.message ||
          err.message ||
          "No se pudo registrar ni vincular a la persona.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Desvincula (baja lógica) a un residente de la vivienda activa.
  async function handleDesvincular(residente) {
    setRemoviendo(true);
    setFeedback(null);
    try {
      const res = await api.delete(
        `/casas/${selectedCasa.id}/residentes/${residente.idResidente}`
      );
      if (res.data?.success) {
        setFeedback({
          tipo: "success",
          texto: `${residente.nombreCompleto} fue desvinculado de Casa ${selectedCasa.numeroCasa}.`,
        });
        setResidenteAQuitar(null);
        await refrescar();
      }
    } catch (err) {
      setFeedback({
        tipo: "error",
        texto:
          err.response?.data?.message ||
          "No se pudo desvincular al residente.",
      });
    } finally {
      setRemoviendo(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      {/* ============ CONTADOR GLOBAL DEL CENSO ============ */}
      <div style={styles.statsBar}>
        <StatItem
          icon={<Building2 size={18} color="#1B4B82" />}
          label="Viviendas"
          value={stats.totalCasas}
        />
        <StatItem
          icon={<Home size={18} color="#166534" />}
          label="Ocupadas"
          value={stats.ocupadas}
        />
        <StatItem
          icon={<DoorOpen size={18} color="#B45309" />}
          label="Vacantes"
          value={stats.vacantes}
        />
        <StatItem
          icon={<Users size={18} color="#1B4B82" />}
          label="Habitantes registrados"
          value={stats.habitantes}
        />
      </div>

      <div style={styles.container}>
      {/* ============ PANEL IZQUIERDO: DIRECTORIO DE VIVIENDAS ============ */}
      <aside style={styles.masterPanel}>
        <div style={styles.masterHeader}>
          <div style={styles.masterHeaderTop}>
            <div>
              <h3 style={styles.masterTitle}>Directorio de Viviendas</h3>
              <p style={styles.masterSubtitle}>
                {casas.length} vivienda{casas.length === 1 ? "" : "s"} en el residencial
              </p>
            </div>
            <button
              type="button"
              onClick={refrescar}
              title="Actualizar directorio"
              style={styles.iconButton}
            >
              <RefreshCw size={16} color="#667085" />
            </button>
          </div>

          <div style={styles.searchWrapper}>
            <Search size={16} color="#98A2B3" style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por casa, bloque o propietario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        <div style={styles.houseList}>
          {loadingCasas ? (
            <div style={styles.listEmpty}>Cargando viviendas...</div>
          ) : filteredCasas.length === 0 ? (
            <div style={styles.listEmpty}>
              No se encontraron viviendas con ese criterio.
            </div>
          ) : (
            filteredCasas.map((casa) => {
              const activa = String(casa.id) === String(selectedHouseId);
              const ocupada = Number(casa.totalHabitantes) > 0;
              return (
                <button
                  key={casa.id}
                  type="button"
                  onClick={() => seleccionarCasa(casa.id)}
                  style={{
                    ...styles.houseItem,
                    ...(activa ? styles.houseItemActive : {}),
                  }}
                >
                  <div style={styles.houseItemLeft}>
                    <div
                      style={{
                        ...styles.houseIconBox,
                        ...(activa ? styles.houseIconBoxActive : {}),
                      }}
                    >
                      <Home size={18} color={activa ? "#1B4B82" : "#667085"} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          ...styles.houseName,
                          color: activa ? "#1B4B82" : "#101828",
                        }}
                      >
                        Casa {casa.numeroCasa}
                      </div>
                      <div style={styles.houseMeta}>
                        <MapPin size={12} color="#98A2B3" />
                        <span>{casa.bloque}</span>
                      </div>
                      <div style={styles.houseOwner}>
                        {casa.propietario?.nombre || "Sin propietario"}
                      </div>
                    </div>
                  </div>

                  {ocupada ? (
                    <span style={styles.countPill}>
                      <Users size={12} /> {casa.totalHabitantes}
                    </span>
                  ) : (
                    <span style={styles.vacantPill}>
                      <span style={styles.vacantDot} /> Vacante
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ============ PANEL DERECHO: DETALLE Y NÚCLEO FAMILIAR ============ */}
      <section style={styles.detailPanel}>
        {loadingDetalle && !selectedCasa ? (
          <div style={styles.detailEmpty}>Cargando expediente de la vivienda...</div>
        ) : !selectedCasa ? (
          <div style={styles.detailEmpty}>
            <Home size={32} color="#98A2B3" />
            <p style={styles.detailEmptyText}>
              {!loadingCasas && casas.length === 0
                ? "Aún no hay viviendas registradas en el sistema. Créalas desde el Catálogo de Casas."
                : "Seleccione una vivienda del directorio para ver su núcleo familiar."}
            </p>
          </div>
        ) : (
          <>
            {/* Encabezado de la vivienda */}
            <div style={styles.houseHeader}>
              <div style={styles.houseHeaderInfo}>
                <div style={styles.houseTitleRow}>
                  <h2 style={styles.houseTitle}>Casa {selectedCasa.numeroCasa}</h2>
                  <span
                    style={
                      selectedCasa.residentes?.length > 0
                        ? styles.statusOcupada
                        : styles.statusVacante
                    }
                  >
                    {selectedCasa.residentes?.length > 0 ? "Ocupada" : "Vacante"}
                  </span>
                </div>
                <p style={styles.houseHeaderMeta}>
                  <MapPin size={14} color="#667085" />
                  {selectedCasa.bloque} &bull; {selectedCasa.direccion}
                </p>
                <p style={styles.houseHeaderMeta}>
                  <UserRound size={14} color="#667085" />
                  Propietario: {selectedCasa.propietario?.nombre || "Sin asignar"}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  isAddingResident ? cerrarPanelVinculacion : abrirPanelVinculacion
                }
                style={
                  isAddingResident ? styles.btnGhost : styles.btnPrimary
                }
              >
                {isAddingResident ? <X size={16} /> : <Plus size={16} />}
                {isAddingResident ? "Cancelar" : "Vincular Persona"}
              </button>
            </div>

            {/* Mensaje de retroalimentación */}
            {feedback && (
              <div
                style={
                  feedback.tipo === "success"
                    ? styles.alertSuccess
                    : styles.alertError
                }
              >
                {feedback.tipo === "success" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>{notificacion}</span>
              </div>
            )}

            {/* Panel contextual de vinculación */}
            {isAddingResident && (
              <div style={styles.addPanel}>
                <div style={styles.addPanelHeader}>
                  <div style={styles.addPanelIcon}>
                    <UserPlus size={18} color="#1B4B82" />
                  </div>
                  <div>
                    <h3 style={styles.addPanelTitle}>
                      Añadir habitante a Casa {selectedCasa.numeroCasa}
                    </h3>
                    <p style={styles.addPanelSubtitle}>
                      Busque a una persona existente o registre una nueva
                    </p>
                  </div>
                </div>

                <div style={styles.addPanelBody}>
                  {/* Conmutador de modo */}
                  <div style={styles.modeToggle}>
                    <button
                      type="button"
                      onClick={() => setAddMode("search")}
                      style={{
                        ...styles.modeBtn,
                        ...(addMode === "search" ? styles.modeBtnActive : {}),
                      }}
                    >
                      <Search size={14} /> Buscar Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode("new")}
                      style={{
                        ...styles.modeBtn,
                        ...(addMode === "new" ? styles.modeBtnActive : {}),
                      }}
                    >
                      <UserPlus size={14} /> Nuevo Registro
                    </button>
                  </div>

                  {addMode === "search" ? (
                    <>
                      <div style={styles.field}>
                        <label style={styles.label}>
                          Buscar persona (DPI o nombre)
                        </label>
                        <div style={styles.searchWrapper}>
                          <Search
                            size={16}
                            color="#98A2B3"
                            style={styles.searchIcon}
                          />
                          <input
                            type="text"
                            placeholder="Ej: 2345678900101"
                            value={personSearch}
                            onChange={(e) => {
                              setPersonSearch(e.target.value);
                              setSelectedPersonaId(null);
                            }}
                            style={styles.searchInput}
                          />
                        </div>
                      </div>

                      <div style={styles.personResults}>
                        {personasDisponibles.length === 0 ? (
                          <div style={styles.listEmpty}>
                            {personSearch
                              ? "Sin coincidencias. Pruebe con 'Nuevo Registro'."
                              : "No hay personas disponibles para vincular."}
                          </div>
                        ) : (
                          personasDisponibles.map((p) => {
                            const activa =
                              String(selectedPersonaId) === String(p.idPersona);
                            return (
                              <button
                                key={p.idPersona}
                                type="button"
                                onClick={() => setSelectedPersonaId(p.idPersona)}
                                style={{
                                  ...styles.personResult,
                                  ...(activa ? styles.personResultActive : {}),
                                }}
                              >
                                <span style={styles.avatar}>
                                  {iniciales(p.nombreCompleto)}
                                </span>
                                <span style={styles.personResultInfo}>
                                  <span style={styles.personResultName}>
                                    {p.nombreCompleto}
                                  </span>
                                  <span style={styles.personResultMeta}>
                                    {p.dpi ? `DPI: ${p.dpi}` : "Sin DPI"}
                                    {p.telefono ? ` • ${p.telefono}` : ""}
                                  </span>
                                </span>
                                {activa && <CheckCircle2 size={18} color="#1B4B82" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    <form onSubmit={handleCrearYVincular} style={styles.personForm}>
                      <div style={styles.formRow}>
                        <div style={styles.field}>
                          <label style={styles.label}>Nombres *</label>
                          <input
                            type="text"
                            required
                            placeholder="ej. María Elena"
                            value={personaForm.nombres}
                            onChange={(e) =>
                              setPersonaForm({ ...personaForm, nombres: e.target.value })
                            }
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Apellidos *</label>
                          <input
                            type="text"
                            required
                            placeholder="ej. Morales Gómez"
                            value={personaForm.apellidos}
                            onChange={(e) =>
                              setPersonaForm({ ...personaForm, apellidos: e.target.value })
                            }
                            style={styles.input}
                          />
                        </div>
                      </div>

                      <div style={styles.formRow}>
                        <div style={styles.field}>
                          <label style={styles.label}>DPI / Identificación</label>
                          <input
                            type="text"
                            placeholder="ej. 2345678900101"
                            value={personaForm.dpi}
                            onChange={(e) =>
                              setPersonaForm({ ...personaForm, dpi: e.target.value })
                            }
                            style={styles.input}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Teléfono</label>
                          <input
                            type="text"
                            placeholder="ej. 5555-1234"
                            value={personaForm.telefono}
                            onChange={(e) =>
                              setPersonaForm({ ...personaForm, telefono: e.target.value })
                            }
                            style={styles.input}
                          />
                        </div>
                      </div>

                      <div style={styles.field}>
                        <label style={styles.label}>Correo Electrónico</label>
                        <input
                          type="email"
                          placeholder="ej. maria.morales@correo.com"
                          value={personaForm.correo}
                          onChange={(e) =>
                            setPersonaForm({ ...personaForm, correo: e.target.value })
                          }
                          style={styles.input}
                        />
                      </div>

                      <RoleAndPrincipal
                        tipoResidente={tipoResidente}
                        setTipoResidente={setTipoResidente}
                        esPrincipal={esPrincipal}
                        setEsPrincipal={setEsPrincipal}
                        tieneTitular={tieneTitular}
                      />

                      <div style={styles.addPanelFooter}>
                        <button
                          type="button"
                          onClick={cerrarPanelVinculacion}
                          style={styles.btnGhost}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                        <button type="submit" style={styles.btnPrimary} disabled={saving}>
                          {saving ? "Guardando..." : "Registrar y Vincular"}
                        </button>
                      </div>
                    </form>
                  )}

                  {addMode === "search" && (
                    <>
                      <RoleAndPrincipal
                        tipoResidente={tipoResidente}
                        setTipoResidente={setTipoResidente}
                        esPrincipal={esPrincipal}
                        setEsPrincipal={setEsPrincipal}
                        tieneTitular={tieneTitular}
                      />

                      <div style={styles.addPanelFooter}>
                        <button
                          type="button"
                          onClick={cerrarPanelVinculacion}
                          style={styles.btnGhost}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleVincularExistente}
                          style={styles.btnPrimary}
                          disabled={saving || !selectedPersonaId}
                        >
                          {saving ? "Guardando..." : "Confirmar Asignación"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Núcleo familiar */}
            <div style={styles.residentsSection}>
              <div style={styles.residentsHeader}>
                <h3 style={styles.sectionTitle}>
                  <Users size={18} color="#1B4B82" />
                  Núcleo Familiar y Habitantes
                </h3>
                <span style={styles.residentsCount}>
                  {selectedCasa.residentes?.length || 0} registrado
                  {(selectedCasa.residentes?.length || 0) === 1 ? "" : "s"}
                </span>
              </div>

              {(selectedCasa.residentes?.length || 0) === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIconBox}>
                    <Users size={30} color="#98A2B3" />
                  </div>
                  <h4 style={styles.emptyTitle}>No hay habitantes registrados</h4>
                  <p style={styles.emptyText}>
                    Esta vivienda figura como vacante. Comience vinculando a su
                    primer habitante.
                  </p>
                  {!isAddingResident && (
                    <button
                      type="button"
                      onClick={abrirPanelVinculacion}
                      style={styles.linkButton}
                    >
                      <Plus size={16} /> Vincular primer habitante
                    </button>
                  )}
                </div>
              ) : (
                <div style={styles.residentsGrid}>
                  {selectedCasa.residentes.map((res) => {
                    const badge = obtenerBadge(res);
                    return (
                      <div key={res.idResidente} style={styles.residentCard}>
                        <div style={styles.residentCardTop}>
                          <span
                            style={{
                              ...styles.badge,
                              backgroundColor: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.text}
                          </span>
                          <div style={styles.residentCardActions}>
                            <span style={styles.avatarSmall}>
                              {iniciales(res.nombreCompleto)}
                            </span>
                            <button
                              type="button"
                              title="Desvincular de la vivienda"
                              onClick={() => setResidenteAQuitar(res.idResidente)}
                              style={styles.iconDangerButton}
                            >
                              <UserMinus size={15} color="#B91C1C" />
                            </button>
                          </div>
                        </div>

                        <h4 style={styles.residentName}>{res.nombreCompleto}</h4>

                        <div style={styles.residentData}>
                          <span style={styles.residentDataRow}>
                            <IdCard size={14} color="#98A2B3" />
                            {res.identificacion || "Menor de edad"}
                          </span>
                          <span style={styles.residentDataRow}>
                            <Phone size={14} color="#98A2B3" />
                            {res.telefono || res.correo || "No registrado"}
                          </span>
                        </div>

                        {residenteAQuitar === res.idResidente && (
                          <div style={styles.confirmBox}>
                            <p style={styles.confirmText}>
                              ¿Desvincular a {res.nombreCompleto} de esta vivienda?
                            </p>
                            <div style={styles.confirmActions}>
                              <button
                                type="button"
                                onClick={() => setResidenteAQuitar(null)}
                                style={styles.btnMiniGhost}
                                disabled={removiendo}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDesvincular(res)}
                                style={styles.btnMiniDanger}
                                disabled={removiendo}
                              >
                                {removiendo ? (
                                  <>
                                    <Loader2 size={14} className="spin" /> Quitando...
                                  </>
                                ) : (
                                  <>
                                    <UserMinus size={14} /> Desvincular
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
      </div>
    </div>
  );
}

/**
 * Subcomponente reutilizable: tarjeta de indicador para el contador global
 * del censo (viviendas, ocupadas, vacantes y habitantes).
 */
function StatItem({ icon, label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIconBox}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

/**
 * Subcomponente reutilizable: selector de rol en la vivienda y marca de
 * titular principal. Se usa tanto en "Buscar Existente" como en "Nuevo Registro".
 */
function RoleAndPrincipal({
  tipoResidente,
  setTipoResidente,
  esPrincipal,
  setEsPrincipal,
  tieneTitular,
}) {
  return (
    <div style={styles.roleGroup}>
      <div style={styles.field}>
        <label style={styles.label}>Rol en la vivienda</label>
        <select
          value={tipoResidente}
          onChange={(e) => setTipoResidente(e.target.value)}
          style={styles.select}
        >
          {TIPOS_RESIDENTE.map((tipo) => (
            <option key={tipo.value} value={tipo.value}>
              {tipo.label}
            </option>
          ))}
        </select>
      </div>

      <label
        style={{
          ...styles.checkboxRow,
          opacity: tieneTitular ? 0.6 : 1,
          cursor: tieneTitular ? "not-allowed" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={esPrincipal && !tieneTitular}
          disabled={tieneTitular}
          onChange={(e) => setEsPrincipal(e.target.checked)}
        />
        <span style={styles.checkboxLabel}>
          Es el titular o responsable principal de la vivienda
        </span>
      </label>

      {tieneTitular && (
        <small style={styles.warningNote}>
          Esta vivienda ya cuenta con un titular principal registrado.
        </small>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  // ---- Contador global del censo ----
  statsBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "14px 16px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  statIconBox: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    backgroundColor: "#EEF4FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    marginTop: "2px",
  },

  container: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 340px) 1fr",
    gap: "20px",
    alignItems: "start",
    boxSizing: "border-box",
  },

  // ---- Panel maestro ----
  masterPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  masterHeader: {
    padding: "16px",
    borderBottom: "1px solid var(--color-border, #E5E7EB)",
  },
  masterHeaderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  masterTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 2px 0",
  },
  masterSubtitle: {
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
    margin: 0,
  },
  iconButton: {
    background: "none",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  searchWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  searchIcon: {
    position: "absolute",
    left: "10px",
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px 8px 32px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  houseList: {
    maxHeight: "600px",
    overflowY: "auto",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  houseItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    width: "100%",
    textAlign: "left",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid transparent",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  houseItemActive: {
    backgroundColor: "#EEF4FB",
    border: "1px solid #B7CDE8",
  },
  houseItemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  houseIconBox: {
    width: "36px",
    height: "36px",
    borderRadius: "9px",
    backgroundColor: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  houseIconBoxActive: {
    backgroundColor: "#DCE9F7",
  },
  houseName: {
    fontSize: "13px",
    fontWeight: "600",
  },
  houseMeta: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    fontSize: "11px",
    color: "var(--color-text-muted, #667085)",
    marginTop: "1px",
  },
  houseOwner: {
    fontSize: "11px",
    color: "#98A2B3",
    marginTop: "1px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "150px",
  },
  countPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#475569",
    backgroundColor: "#F1F5F9",
    padding: "2px 8px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  vacantPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#92400E",
    flexShrink: 0,
  },
  vacantDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#F59E0B",
  },
  listEmpty: {
    textAlign: "center",
    padding: "24px 12px",
    color: "var(--color-text-muted, #667085)",
    fontSize: "12px",
  },

  // ---- Panel de detalle ----
  detailPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
  detailEmpty: {
    backgroundColor: "#FFFFFF",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "60px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    color: "var(--color-text-muted, #667085)",
    fontSize: "13px",
  },
  detailEmptyText: {
    margin: 0,
    textAlign: "center",
  },
  houseHeader: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    padding: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  houseHeaderInfo: {
    minWidth: 0,
  },
  houseTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "6px",
  },
  houseTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: 0,
  },
  statusOcupada: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#166534",
    backgroundColor: "#DCFCE7",
    padding: "3px 10px",
    borderRadius: "999px",
  },
  statusVacante: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    padding: "3px 10px",
    borderRadius: "999px",
  },
  houseHeaderMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
    margin: "2px 0",
  },

  // ---- Botones ----
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: "none",
    color: "var(--color-primary, #1B4B82)",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },

  // ---- Alertas ----
  alertSuccess: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#DCFCE7",
    color: "#166534",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  alertError: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
  },

  // ---- Panel contextual de vinculación ----
  addPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid #B7CDE8",
    boxShadow: "0 4px 12px rgba(27, 75, 130, 0.08)",
    overflow: "hidden",
  },
  addPanelHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 18px",
    backgroundColor: "#EEF4FB",
    borderBottom: "1px solid #DCE9F7",
  },
  addPanelIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "9px",
    backgroundColor: "#DCE9F7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addPanelTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#1B4B82",
    margin: "0 0 2px 0",
  },
  addPanelSubtitle: {
    fontSize: "12px",
    color: "#3B5B85",
    margin: 0,
  },
  addPanelBody: {
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  modeToggle: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "4px",
    backgroundColor: "#F1F5F9",
    padding: "4px",
    borderRadius: "9px",
  },
  modeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "8px",
    border: "none",
    background: "none",
    borderRadius: "7px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748B",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  modeBtnActive: {
    backgroundColor: "#FFFFFF",
    color: "#1B4B82",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    boxSizing: "border-box",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
    color: "var(--color-text, #101828)",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  personForm: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  roleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingTop: "12px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  checkboxLabel: {
    fontSize: "12px",
    color: "var(--color-text, #101828)",
  },
  warningNote: {
    fontSize: "11px",
    color: "#D97706",
  },
  personResults: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxHeight: "260px",
    overflowY: "auto",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "10px",
    padding: "6px",
  },
  personResult: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    textAlign: "left",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid transparent",
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  personResultActive: {
    backgroundColor: "#EEF4FB",
    border: "1px solid #B7CDE8",
  },
  avatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    backgroundColor: "#DCE9F7",
    color: "#1B4B82",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  personResultInfo: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: 1,
  },
  personResultName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  personResultMeta: {
    fontSize: "11px",
    color: "var(--color-text-muted, #667085)",
  },
  addPanelFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    paddingTop: "14px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
  },

  // ---- Núcleo familiar ----
  residentsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid var(--color-border, #E5E7EB)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    padding: "20px",
  },
  residentsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "12px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "15px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: 0,
  },
  residentsCount: {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--color-text-muted, #667085)",
    backgroundColor: "#F1F5F9",
    padding: "3px 10px",
    borderRadius: "999px",
  },
  residentsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
    gap: "12px",
  },
  residentCard: {
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  },
  residentCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  residentCardActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  iconDangerButton: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    backgroundColor: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  badge: {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: "7px",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  avatarSmall: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    backgroundColor: "#F1F5F9",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
  },
  residentName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
    margin: "0 0 12px 0",
  },
  residentData: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  residentDataRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "var(--color-text-muted, #667085)",
  },
  confirmBox: {
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid var(--color-border, #E5E7EB)",
  },
  confirmText: {
    fontSize: "12px",
    color: "#991B1B",
    margin: "0 0 10px 0",
    lineHeight: 1.4,
  },
  confirmActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  btnMiniGhost: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "#FFFFFF",
    color: "var(--color-text, #101828)",
    border: "1px solid var(--color-border, #E5E7EB)",
    borderRadius: "7px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnMiniDanger: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "7px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  emptyState: {
    border: "2px dashed var(--color-border, #E5E7EB)",
    borderRadius: "12px",
    padding: "40px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  emptyIconBox: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    backgroundColor: "#F7F9FC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
  },
  emptyTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
    margin: "0 0 4px 0",
  },
  emptyText: {
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
    margin: "0 0 16px 0",
    maxWidth: "360px",
  },
};
