import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

export default function Notificaciones() {
  const { user } = useAuth(); // { id, nombre, rol, casaId }

  const [activeTab, setActiveTab] = useState("avisos");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [filterAudience, setFilterAudience] = useState("Todas");
  const [filterEstadoAviso, setFilterEstadoAviso] = useState("ACTIVO");
  const [filterPrioridad, setFilterPrioridad] = useState("Todas");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchAvisos, setSearchAvisos] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todas");
  const [showModal, setShowModal] = useState(false);
  const [quejaActiva, setQuejaActiva] = useState(null);
  const [respuestaForm, setRespuestaForm] = useState({ respuesta: "", estado: "EN_PROCESO" });
  const [errorRespuesta, setErrorRespuesta] = useState("");
  const [guardandoRespuesta, setGuardandoRespuesta] = useState(false);
  const [quejaActualizandoId, setQuejaActualizandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [casasDisponibles, setCasasDisponibles] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [loadingDestinatarios, setLoadingDestinatarios] = useState(false);
  const [errorDestinatarios, setErrorDestinatarios] = useState("");
  const [mensajeAlert, setMensajeAlert] = useState(null);

  // Listas de datos desde backend
  const [comunicados, setComunicados] = useState([]);
  const [quejas, setQuejas] = useState([]);

  // Formulario de creación
  const [formData, setFormData] = useState({
    titulo: "",
    contenido: "",
    origen: "PORTAL",
    reportanteId: "",
    idCasaReportada: "",
    categoria: "General",
    prioridad: "NORMAL",
    fechaVencimiento: "",
    tipoDestino: "GLOBAL",
    idCasaDestino: "",
    idUsuarioDestino: "",
    idUsuariosDestino: [],
    idRolesDestino: [],
    canalEnvio: "TODOS",
  });

  useEffect(() => {
    cargarDatos();
  }, [activeTab]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Evitar cache de respuestas 304 adjuntando timestamp
      const timestamp = new Date().getTime();

      if (activeTab === "avisos") {
        const res = await api.get(`/notificaciones?t=${timestamp}`);
        
        // Extracción defensiva del arreglo de comunicados
        let lista = [];
        if (Array.isArray(res.data)) {
          lista = res.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          lista = res.data.data;
        } else if (res.data && Array.isArray(res.data.rows)) {
          lista = res.data.rows;
        }
        
        setComunicados(lista);
      } else {
        const res = await api.get(`/quejas?t=${timestamp}`);
        
        // Extracción defensiva del arreglo de quejas
        let lista = [];
        if (Array.isArray(res.data)) {
          lista = res.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          lista = res.data.data;
        } else if (res.data && Array.isArray(res.data.rows)) {
          lista = res.data.rows;
        }

        setQuejas(lista);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const cargarOpcionesDestinatarios = async () => {
    setLoadingDestinatarios(true);
    setErrorDestinatarios("");
    try {
      const [casasRes, usuariosRes, rolesRes] = await Promise.all([
        api.get("/casas"),
        api.get("/usuarios"),
        api.get("/usuarios/roles"),
      ]);
      setCasasDisponibles(Array.isArray(casasRes.data?.data) ? casasRes.data.data : []);
      const usuarios = Array.isArray(usuariosRes.data?.data) ? usuariosRes.data.data : [];
      setUsuariosDisponibles(usuarios);
      setRolesDisponibles(Array.isArray(rolesRes.data?.data) ? rolesRes.data.data : []);
    } catch (err) {
      setErrorDestinatarios(err.response?.data?.message || "No fue posible cargar las casas y usuarios.");
    } finally {
      setLoadingDestinatarios(false);
    }
  };

  const abrirModalPublicacion = () => {
    setShowModal(true);
    setBusquedaUsuario("");
    if (activeTab === "avisos" || esAdmin) cargarOpcionesDestinatarios();
  };

  const toggleDestinatario = (campo, id, seleccionado) => {
    const idNumerico = Number(id);
    setFormData((actual) => ({
      ...actual,
      [campo]: seleccionado
        ? [...new Set([...actual[campo], idNumerico])]
        : actual[campo].filter((valor) => Number(valor) !== idNumerico),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo || !formData.contenido) return;
    if (activeTab === "avisos" && formData.tipoDestino === "USUARIOS" && formData.idUsuariosDestino.length === 0) {
      setMensajeAlert({ tipo: "error", texto: "Selecciona al menos un usuario destinatario." });
      return;
    }
    if (activeTab === "avisos" && formData.tipoDestino === "ROLES" && formData.idRolesDestino.length === 0) {
      setMensajeAlert({ tipo: "error", texto: "Selecciona al menos un rol destinatario." });
      return;
    }

    try {
      if (activeTab === "avisos") {
        const payload = {
          titulo: formData.titulo,
          contenido: formData.contenido,
          categoria: formData.categoria,
          prioridad: formData.prioridad,
          fechaVencimiento: formData.fechaVencimiento || null,
          tipoDestino: formData.tipoDestino,
          idCasaDestino: formData.tipoDestino === "CASA" ? Number(formData.idCasaDestino) : null,
          idUsuarioDestino: null,
          idUsuariosDestino: formData.tipoDestino === "USUARIOS" ? formData.idUsuariosDestino : [],
          idRolesDestino: formData.tipoDestino === "ROLES" ? formData.idRolesDestino : [],
          canalEnvio: formData.canalEnvio,
        };

        const res = await api.post("/notificaciones", payload);
        setMensajeAlert({ tipo: "exito", texto: res.data?.message || "Comunicado emitido correctamente." });
      } else {
        const payload = {
          asunto: formData.titulo,
          descripcion: formData.contenido,
          origen: esAdmin ? formData.origen : "PORTAL",
          reportanteId: esAdmin && formData.reportanteId !== "NO_IDENTIFICADO" && formData.reportanteId
            ? Number(formData.reportanteId)
            : null,
          idCasa: esAdmin && formData.reportanteId === "NO_IDENTIFICADO"
            ? Number(formData.idCasaReportada)
            : user?.casaId || user?.id_casa,
        };

        await api.post("/quejas", payload);
        setMensajeAlert({ tipo: "exito", texto: "Queja o sugerencia registrada correctamente." });
      }

      setShowModal(false);
      setFormData({
        titulo: "",
        contenido: "",
        origen: "PORTAL",
        reportanteId: "",
        idCasaReportada: "",
        categoria: "General",
        prioridad: "NORMAL",
        fechaVencimiento: "",
        tipoDestino: "GLOBAL",
        idCasaDestino: "",
        idUsuarioDestino: "",
        idUsuariosDestino: [],
        idRolesDestino: [],
        canalEnvio: "TODOS",
      });
      setBusquedaUsuario("");

      // Recarga obligatoria de datos tras publicar
      await cargarDatos();
    } catch (err) {
      setMensajeAlert({
        tipo: "error",
        texto: err.response?.data?.message || "Error al procesar la solicitud.",
      });
    }
  };

  const abrirModalRespuesta = (queja) => {
    setQuejaActiva(queja);
    setRespuestaForm({ respuesta: "", estado: "EN_PROCESO" });
    setErrorRespuesta("");
  };

  const guardarRespuesta = async (e) => {
    e.preventDefault();
    const idQueja = quejaActiva?.ID_QUEJA || quejaActiva?.id_queja || quejaActiva?.id;
    const respuesta = respuestaForm.respuesta.trim();
    if (!idQueja || !respuesta) return;

    setGuardandoRespuesta(true);
    setErrorRespuesta("");
    try {
      await api.post(`/quejas/${idQueja}/responder`, {
        respuesta,
        estado: respuestaForm.estado,
      });

      setQuejas((lista) => lista.map((item) => {
        const itemId = item.ID_QUEJA || item.id_queja || item.id;
        return String(itemId) === String(idQueja)
          ? { ...item, respuesta, RESPUESTA: respuesta, estado: respuestaForm.estado, ESTADO: respuestaForm.estado }
          : item;
      }));
      setMensajeAlert({ tipo: "exito", texto: "Respuesta registrada correctamente." });
      setQuejaActiva(null);
    } catch (err) {
      setErrorRespuesta(err.response?.data?.message || "No fue posible guardar la respuesta.");
    } finally {
      setGuardandoRespuesta(false);
    }
  };

  const marcarQuejaResuelta = async (item) => {
    const idQueja = item.ID_QUEJA || item.id_queja || item.id;
    if (!idQueja) return;

    setQuejaActualizandoId(idQueja);
    try {
      await api.put(`/quejas/${idQueja}/responder`, {
        respuesta: item.RESPUESTA || item.respuesta || "",
        estado: "RESUELTA",
      });
      const fechaRespuesta = new Date().toISOString();
      setQuejas((lista) => lista.map((queja) => {
        const quejaId = queja.ID_QUEJA || queja.id_queja || queja.id;
        return String(quejaId) === String(idQueja)
          ? { ...queja, estado: "RESUELTA", ESTADO: "RESUELTA", fechaRespuesta, FECHA_RESPUESTA: fechaRespuesta }
          : queja;
      }));
      setMensajeAlert({ tipo: "exito", texto: "La queja se marcó como resuelta." });
    } catch (err) {
      setMensajeAlert({ tipo: "error", texto: err.response?.data?.message || "No fue posible resolver la queja." });
    } finally {
      setQuejaActualizandoId(null);
    }
  };

  const marcarComunicadoLeido = async (item) => {
    const id = item.ID_COMUNICADO || item.id_comunicado || item.id;
    if (!id || item.FECHA_LECTURA || item.fecha_lectura) return;
    try {
      await api.post(`/notificaciones/${id}/lectura`);
      const fechaLectura = new Date().toISOString();
      setComunicados((lista) => lista.map((comunicado) => {
        const comunicadoId = comunicado.ID_COMUNICADO || comunicado.id_comunicado || comunicado.id;
        return String(comunicadoId) === String(id)
          ? { ...comunicado, fecha_lectura: fechaLectura, FECHA_LECTURA: fechaLectura, total_lecturas: Number(comunicado.total_lecturas || comunicado.TOTAL_LECTURAS || 0) + 1 }
          : comunicado;
      }));
    } catch (err) {
      setMensajeAlert({ tipo: "error", texto: err.response?.data?.message || "No fue posible confirmar la recepción." });
    }
  };

  const archivarComunicado = async (item) => {
    const id = item.ID_COMUNICADO || item.id_comunicado || item.id;
    try {
      await api.put(`/notificaciones/${id}/desactivar`);
      setComunicados((lista) => lista.map((comunicado) => {
        const comunicadoId = comunicado.ID_COMUNICADO || comunicado.id_comunicado || comunicado.id;
        return String(comunicadoId) === String(id) ? { ...comunicado, estado: "INACTIVO", ESTADO: "INACTIVO" } : comunicado;
      }));
      setMensajeAlert({ tipo: "exito", texto: "Aviso archivado correctamente." });
    } catch (err) {
      setMensajeAlert({ tipo: "error", texto: err.response?.data?.message || "No fue posible archivar el aviso." });
    }
  };

  // Filtrado de comunicados insensible a diferencias de mayúsculas/minúsculas de Oracle DB
  const normalizarCategoria = (categoria) => String(categoria || "").trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const comunicadosFiltrados = comunicados.filter((item) => {
    const estado = String(item.ESTADO || item.estado || "ACTIVO").toUpperCase();
    const audiencia = String(item.TIPO_DESTINO || item.tipo_destino || (item.ID_CASA_DESTINO || item.id_casa_destino ? "CASA" : item.ID_USUARIO_DESTINO || item.id_usuario_destino ? "INDIVIDUAL" : "GLOBAL")).toUpperCase();
    const prioridad = String(item.PRIORIDAD || item.prioridad || "NORMAL").toUpperCase();
    const fecha = item.FECHA_PUBLICACION || item.fecha_publicacion || item.FECHA || item.fecha;
    const fechaDia = fecha && !Number.isNaN(new Date(fecha).getTime()) ? new Date(fecha).toISOString().slice(0, 10) : "";
    const termino = searchAvisos.trim().toLocaleLowerCase("es");
    const textoAviso = `${item.TITULO || item.titulo || ""} ${item.CONTENIDO || item.contenido || item.MENSAJE || item.mensaje || ""}`.toLocaleLowerCase("es");

    if (filterEstadoAviso !== "Todas" && estado !== filterEstadoAviso) return false;
    if (filterAudience !== "Todas" && audiencia !== filterAudience) return false;
    if (filterPrioridad !== "Todas" && prioridad !== filterPrioridad) return false;
    if (termino && !textoAviso.includes(termino)) return false;
    if (filterDateFrom && (!fechaDia || fechaDia < filterDateFrom)) return false;
    if (filterDateTo && (!fechaDia || fechaDia > filterDateTo)) return false;
    if (filterCategory === "Todas") return true;
    const catItem = item.CATEGORIA || item.categoria || item.TIPO || item.tipo || "General";
    return normalizarCategoria(catItem) === normalizarCategoria(filterCategory);
  });
  const usuariosFiltrados = usuariosDisponibles.filter((usuario) => {
    const nombre = usuario.persona?.nombreCompleto || usuario.nombreCompleto || usuario.nombreUsuario || "";
    const correo = usuario.persona?.correo || usuario.correo || "";
    const criterio = busquedaUsuario.trim().toLocaleLowerCase("es");
    return !criterio || `${nombre} ${correo}`.toLocaleLowerCase("es").includes(criterio);
  });
  const reportantesDisponibles = usuariosDisponibles.filter((usuario) => {
    const rol = String(usuario.rol?.nombre || "").toUpperCase();
    return ["CONDOMINO", "CONDÓMINO", "RESIDENTE"].includes(rol) && Number(usuario.idCasa) > 0;
  });
  const quejasFiltradas = quejas.filter((item) => {
    if (filterEstado === "Todas") return true;
    const estado = item.ESTADO || item.estado || "PENDIENTE";
    return String(estado).toUpperCase() === filterEstado;
  });

  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const esAdmin = rolUpper.includes("ADMIN");
  const esResidente = ["RESIDENTE", "CONDOMINO", "CONDÓMINO"].includes(rolUpper);

  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Comunicaciones del Condominio</h1>
          <p style={styles.subtitle}>
            Entérate de las novedades oficiales del residencial o envía tus inquietudes a la administración.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={cargarDatos}>
            Actualizar lista
          </button>
          {(activeTab === "quejas" ? esAdmin || esResidente : esAdmin) && (
            <button style={styles.btnPrimary} onClick={abrirModalPublicacion}>
              {activeTab === "avisos" ? "+ Publicar Comunicado" : "+ Nueva Queja / Sugerencia"}
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {mensajeAlert && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            backgroundColor: mensajeAlert.tipo === "exito" ? "#DCFCE7" : "#FEE2E2",
            color: mensajeAlert.tipo === "exito" ? "#166534" : "#991B1B",
          }}
        >
          {mensajeAlert.texto}
        </div>
      )}

      {/* Pestañas con contador sincronizado */}
      <div style={styles.tabsContainer}>
        <button
          style={{ ...styles.tab, ...(activeTab === "avisos" ? styles.tabActive : {}) }}
          onClick={() => setActiveTab("avisos")}
        >
          📢 Avisos y Circulares
        </button>
        {(esAdmin || esResidente) && (
          <button
            style={{ ...styles.tab, ...(activeTab === "quejas" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("quejas")}
          >
            ✍️ Buzón de Quejas y Sugerencias ({quejas.length})
          </button>
        )}
      </div>

      {/* Contenido Pestaña Avisos */}
      {activeTab === "avisos" ? (
        <>
          <div style={styles.noticeFilters}>
            <input
              type="search"
              aria-label="Buscar avisos"
              placeholder="Buscar avisos"
              value={searchAvisos}
              onChange={(e) => setSearchAvisos(e.target.value)}
              style={styles.selectInput}
            />
            <select
              aria-label="Filtrar por categoría"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Todas">Todas</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Seguridad">Seguridad</option>
              <option value="Eventos">Eventos</option>
              <option value="Administración">Administración</option>
              <option value="General">General</option>
            </select>
            <select
              aria-label="Filtrar por estado"
              value={filterEstadoAviso}
              onChange={(e) => setFilterEstadoAviso(e.target.value)}
              style={styles.selectInput}
            >
              <option value="ACTIVO">Vigentes</option>
              {esAdmin && <option value="INACTIVO">Archivados</option>}
              {esAdmin && <option value="Todas">Todos los estados</option>}
            </select>
            {esAdmin && (
              <select
                aria-label="Filtrar por audiencia"
                value={filterAudience}
                onChange={(e) => setFilterAudience(e.target.value)}
                style={styles.selectInput}
              >
                <option value="Todas">Todas las audiencias</option>
                <option value="GLOBAL">Global</option>
                <option value="CASA">Por casa</option>
                <option value="USUARIOS">Usuarios</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="ROLES">Roles</option>
              </select>
            )}
            <select
              aria-label="Filtrar por prioridad"
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Todas">Todas las prioridades</option>
              <option value="NORMAL">Normal</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
            <label style={styles.dateFilter}>
              Desde
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={styles.selectInput} />
            </label>
            <label style={styles.dateFilter}>
              Hasta
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={styles.selectInput} />
            </label>
          </div>

          {loading ? (
            <p style={{ color: "#64748B" }}>Cargando avisos...</p>
          ) : comunicadosFiltrados.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                color: "#64748B",
              }}
            >
              No hay comunicados disponibles en esta categoría.
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {comunicadosFiltrados.map((item, idx) => {
                const canal = item.CANAL_ENVIO || item.canal_envio || "APP";
                const titulo = item.TITULO || item.titulo || "Aviso Oficial";
                const estadoAviso = String(item.ESTADO || item.estado || "ACTIVO").toUpperCase();
                const fecha = item.FECHA_PUBLICACION || item.fecha_publicacion || item.FECHA_CREACION || item.fecha_creacion;
                const contenido = item.CONTENIDO || item.contenido || item.MENSAJE || item.mensaje;
                const idCasaDest = item.ID_CASA_DESTINO || item.id_casa_destino;
                const numCasa = item.NUMERO_CASA || item.numero_casa;
                const idUserDest = item.ID_USUARIO_DESTINO || item.id_usuario_destino;
                const tipoDestino = String(item.TIPO_DESTINO || item.tipo_destino || (idCasaDest ? "CASA" : idUserDest ? "INDIVIDUAL" : "GLOBAL")).toUpperCase();
                const rolesDestino = item.ROLES_DESTINO || item.roles_destino;
                const prioridad = String(item.PRIORIDAD || item.prioridad || "NORMAL").toUpperCase();
                const vencimiento = item.FECHA_VENCIMIENTO || item.fecha_vencimiento;
                const totalLecturas = Number(item.TOTAL_LECTURAS ?? item.total_lecturas ?? 0);
                const totalDestinatarios = Number(item.TOTAL_DESTINATARIOS ?? item.total_destinatarios ?? 0);
                const yaLeido = Boolean(item.FECHA_LECTURA || item.fecha_lectura);
                const audienciaLabel = tipoDestino === "CASA"
                  ? `Casa #${numCasa || idCasaDest}`
                  : tipoDestino === "ROLES"
                  ? `Roles: ${rolesDestino || "seleccionados"}`
                  : tipoDestino === "USUARIOS"
                  ? `Usuarios (${totalDestinatarios})`
                  : tipoDestino === "INDIVIDUAL"
                  ? "Individual"
                  : "Global";

                return (
                  <div
                    key={item.ID_COMUNICADO || item.id_comunicado || item.id || idx}
                    style={{
                      ...styles.card,
                      borderLeft: `4px solid ${
                        canal === "WHATSAPP"
                          ? "#22C55E"
                          : canal === "EMAIL"
                          ? "#3B82F6"
                          : canal === "AMBOS" || canal === "TODOS"
                          ? "#8B5CF6"
                          : "#1B4B82"
                      }`,
                    }}
                  >
                    <div style={styles.cardHeader}>
                      <h3 style={styles.cardTitle}>{titulo}</h3>
                      <span style={styles.cardDate}>
                        {fecha ? new Date(fecha).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div style={styles.noticeMeta}>
                      <span style={{ ...styles.priorityBadge, ...(prioridad === "URGENTE" ? styles.priorityUrgent : prioridad === "ALTA" ? styles.priorityHigh : {}) }}>
                        {prioridad === "URGENTE" ? "Urgente" : prioridad === "ALTA" ? "Alta" : "Normal"}
                      </span>
                      {vencimiento && <span style={styles.cardDate}>Vigente hasta {new Date(vencimiento).toLocaleDateString()}</span>}
                    </div>
                    <p style={styles.cardContent}>{contenido}</p>
                    <div style={styles.cardFooterSpace}>
                      <span style={styles.categoryBadge}>Canal: {canal}</span>
                      <span style={styles.destinatarioText}>{audienciaLabel}</span>
                    </div>
                    <div style={styles.noticeReceiptRow}>
                      {esAdmin ? (
                        <>
                          <span style={styles.cardDate}>Leído: {totalLecturas}/{totalDestinatarios || "—"}</span>
                          {estadoAviso === "ACTIVO" && (
                            <button type="button" style={styles.btnActionSmall} onClick={() => archivarComunicado(item)}>
                              Archivar
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          style={styles.btnActionSmall}
                          onClick={() => marcarComunicadoLeido(item)}
                          disabled={yaLeido}
                        >
                          {yaLeido ? "Recibido" : "Confirmar recibido"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Contenido Pestaña Quejas */
        <>
          <div style={styles.filterBar}>
            <label htmlFor="filtro-estado-quejas" style={styles.filterLabel}>Filtrar por estado:</label>
            <select
              id="filtro-estado-quejas"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Todas">Todas</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="EN_PROCESO">EN_PROCESO</option>
              <option value="RESUELTA">RESUELTA</option>
            </select>
          </div>
          {loading ? (
            <p style={{ color: "#64748B" }}>Cargando quejas y sugerencias...</p>
          ) : quejas.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                color: "#64748B",
              }}
            >
              No hay quejas o sugerencias registradas actualmente.
            </div>
          ) : quejasFiltradas.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                color: "#64748B",
              }}
            >
              No hay quejas con el estado seleccionado.
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {quejasFiltradas.map((item, idx) => {
                const idQueja = item.ID_QUEJA || item.id_queja || item.id;
                const asunto = item.ASUNTO || item.asunto;
                const numCasa = item.NUMERO_CASA || item.numero_casa || item.NUMEROCASA || item.casa || item.ID_CASA || item.id_casa;
                const estado = item.ESTADO || item.estado || "PENDIENTE";
                const descripcion = item.DESCRIPCION || item.descripcion;
                const fecha = item.FECHA_CREACION || item.fecha_creacion || item.FECHACREACION || item.fechaCreacion;
                const respuesta = item.RESPUESTA || item.respuesta;
                const origen = String(item.ORIGEN || item.origen || "PORTAL").toUpperCase();
                const origenLabel = {
                  PORTAL: "Portal",
                  PRESENCIAL: "Presencial",
                  TELEFONO: "Teléfono",
                  CORREO: "Correo electrónico",
                  WHATSAPP: "WhatsApp",
                  OTRO: "Otro",
                }[origen] || "Portal";
                const reportante = item.REPORTANTE || item.reportante || item.AUTOR || item.autor || "Residente no identificado";
                const registradoPor = item.REGISTRADOPOR || item.registradoPor;
                const fechaRespuesta = item.FECHA_RESPUESTA || item.fecha_respuesta || item.fechaRespuesta;
                const estadoNormalizado = String(estado).toUpperCase();
                const estiloEstado = {
                  ...styles.statusBadge,
                  backgroundColor:
                    estadoNormalizado === "RESUELTA"
                      ? "#DCFCE7"
                      : estadoNormalizado === "EN_PROCESO"
                      ? "#DBEAFE"
                      : "#FEF3C7",
                  color:
                    estadoNormalizado === "RESUELTA"
                      ? "#166534"
                      : estadoNormalizado === "EN_PROCESO"
                      ? "#1E40AF"
                      : "#92400E",
                };

                return (
                  <div key={idQueja || idx} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.cardTitle}>{asunto}</h3>
                        <span style={styles.cardSub}>
                          Casa: {typeof numCasa === "string" && numCasa.includes("Casa") ? numCasa : `#${numCasa || "General"}`}
                        </span>
                        <span style={styles.cardSub}>Reportante: {reportante}</span>
                      </div>
                      {!respuesta && <span style={estiloEstado}>{estado}</span>}
                    </div>
                    <p style={styles.cardContent}>{descripcion}</p>
                    <div style={styles.noticeMeta}>
                      <span style={styles.categoryBadge}>Origen: {origenLabel}</span>
                      {esAdmin && registradoPor && <span style={styles.cardDate}>Registrado por: {registradoPor}</span>}
                    </div>
                    
                    {respuesta && (
                      <div style={styles.responseBox}>
                        <div style={styles.responseHeader}>
                          <strong style={styles.responseTitle}>Respuesta de Administración</strong>
                          <span style={estiloEstado}>{estado}</span>
                        </div>
                        <p style={styles.responseText}>{respuesta}</p>
                        <span style={styles.responseDate}>
                          Fecha de respuesta: {fechaRespuesta ? new Date(fechaRespuesta).toLocaleDateString() : "No disponible"}
                        </span>
                      </div>
                    )}

                    <div style={styles.cardFooterSpace}>
                      <span style={styles.cardDate}>
                        Fecha: {fecha ? new Date(fecha).toLocaleDateString() : ""}
                      </span>
                      {esAdmin && estadoNormalizado === "PENDIENTE" ? (
                        <button type="button" style={styles.btnActionSmall} onClick={() => abrirModalRespuesta(item)}>
                          Responder
                        </button>
                      ) : esAdmin && estadoNormalizado === "EN_PROCESO" ? (
                        <button
                          type="button"
                          style={styles.btnActionSmall}
                          onClick={() => marcarQuejaResuelta(item)}
                          disabled={String(quejaActualizandoId) === String(idQueja)}
                        >
                          {String(quejaActualizandoId) === String(idQueja) ? "Guardando..." : "Marcar resuelta"}
                        </button>
                      ) : (
                        <button type="button" style={styles.btnActionSmall}>
                          {respuesta ? "Ver Respuesta" : "Sin Respuesta"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {quejaActiva && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="respuesta-modal-title">
            <h2 id="respuesta-modal-title" style={styles.modalTitle}>Responder queja</h2>
            <form onSubmit={guardarRespuesta} style={styles.form}>
              <div style={styles.formGroup}>
                <label htmlFor="respuesta-queja" style={styles.label}>Respuesta</label>
                <textarea
                  id="respuesta-queja"
                  required
                  maxLength={2000}
                  rows="4"
                  value={respuestaForm.respuesta}
                  onChange={(e) => setRespuestaForm({ ...respuestaForm, respuesta: e.target.value })}
                  style={{ ...styles.input, resize: "vertical" }}
                />
              </div>
              <div style={styles.formGroup}>
                <label htmlFor="estado-queja" style={styles.label}>Nuevo estado</label>
                <select
                  id="estado-queja"
                  value={respuestaForm.estado}
                  onChange={(e) => setRespuestaForm({ ...respuestaForm, estado: e.target.value })}
                  style={styles.input}
                >
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="RESUELTA">Resuelta</option>
                </select>
              </div>
              {errorRespuesta && <p role="alert" style={styles.responseError}>{errorRespuesta}</p>}
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setQuejaActiva(null)} style={styles.btnSecondary} disabled={guardandoRespuesta}>
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary} disabled={guardandoRespuesta}>
                  {guardandoRespuesta ? "Guardando..." : "Guardar respuesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              {activeTab === "avisos" ? "Publicar Nuevo Comunicado" : "Registrar Queja o Sugerencia"}
            </h2>
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {activeTab === "avisos" ? "Título del Comunicado" : "Asunto / Título"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "avisos" ? "Ej: Mantenimiento de pozos" : "Ej: Ruido en área común"}
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  style={styles.input}
                />
              </div>

              {activeTab === "quejas" && esAdmin && (
                <div style={styles.formGroup}>
                  <label htmlFor="origen-queja" style={styles.label}>Origen de la queja</label>
                  <select
                    id="origen-queja"
                    value={formData.origen}
                    onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
                    style={styles.input}
                    required
                  >
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="TELEFONO">Teléfono</option>
                    <option value="CORREO">Correo electrónico</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              )}

              {activeTab === "quejas" && esAdmin && (
                <>
                  <div style={styles.formGroup}>
                    <label htmlFor="reportante-queja" style={styles.label}>¿Quién reportó la queja?</label>
                    <select
                      id="reportante-queja"
                      required
                      value={formData.reportanteId}
                      onChange={(e) => {
                        const reportanteId = e.target.value;
                        const reportante = reportantesDisponibles.find((usuario) => String(usuario.idUsuario) === reportanteId);
                        setFormData({
                          ...formData,
                          reportanteId,
                          idCasaReportada: reportante ? String(reportante.idCasa) : "",
                        });
                      }}
                      style={styles.input}
                      disabled={loadingDestinatarios}
                    >
                      <option value="">Selecciona un reportante</option>
                      <option value="NO_IDENTIFICADO">Residente no identificado</option>
                      {reportantesDisponibles.map((usuario) => {
                        const casa = usuario.numeroCasa ? `Casa #${usuario.numeroCasa}` : "Casa asociada";
                        const bloque = usuario.bloque ? ` - Manzana ${usuario.bloque}` : "";
                        return (
                          <option key={usuario.idUsuario} value={usuario.idUsuario}>
                            {usuario.persona?.nombreCompleto} - {casa}{bloque}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {formData.reportanteId === "NO_IDENTIFICADO" && (
                    <div style={styles.formGroup}>
                      <label htmlFor="casa-reportante" style={styles.label}>Casa relacionada</label>
                      <select
                        id="casa-reportante"
                        required
                        value={formData.idCasaReportada}
                        onChange={(e) => setFormData({ ...formData, idCasaReportada: e.target.value })}
                        style={styles.input}
                      >
                        <option value="">Selecciona una casa</option>
                        {casasDisponibles.map((casa) => {
                          const idCasa = casa.idCasa ?? casa.id_casa ?? casa.ID_CASA ?? casa.id;
                          const numeroCasa = casa.numeroCasa ?? casa.numero_casa ?? casa.NUMERO_CASA ?? idCasa;
                          const bloque = casa.bloque ?? casa.BLOQUE;
                          return (
                            <option key={idCasa} value={idCasa}>
                              Casa #{numeroCasa}{bloque ? ` - Manzana ${bloque}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </>
              )}

              {activeTab === "avisos" && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Categoría</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      style={styles.input}
                    >
                      <option value="General">General</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Seguridad">Seguridad</option>
                      <option value="Eventos">Eventos</option>
                      <option value="Administración">Administración</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label htmlFor="prioridad-aviso" style={styles.label}>Prioridad</label>
                    <select
                      id="prioridad-aviso"
                      value={formData.prioridad}
                      onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                      style={styles.input}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="ALTA">Alta</option>
                      <option value="URGENTE">Urgente</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label htmlFor="vencimiento-aviso" style={styles.label}>Vigente hasta (opcional)</label>
                    <input
                      id="vencimiento-aviso"
                      type="date"
                      value={formData.fechaVencimiento}
                      onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Alcance del Destinatario</label>
                    <select
                      value={formData.tipoDestino}
                      onChange={(e) => setFormData({ ...formData, tipoDestino: e.target.value })}
                      style={styles.input}
                    >
                      <option value="GLOBAL">Todos los Residentes (Global)</option>
                      <option value="CASA">Por Casa Específica</option>
                      <option value="USUARIOS">A Usuarios Específicos</option>
                      <option value="ROLES">A Roles Específicos</option>
                    </select>
                  </div>

                  {formData.tipoDestino === "CASA" && (
                    <div style={styles.formGroup}>
                      <label htmlFor="casa-destino" style={styles.label}>Casa destino</label>
                      <select
                        id="casa-destino"
                        required
                        value={formData.idCasaDestino}
                        onChange={(e) => setFormData({ ...formData, idCasaDestino: e.target.value })}
                        style={styles.input}
                        disabled={loadingDestinatarios || casasDisponibles.length === 0}
                      >
                        <option value="">
                          {loadingDestinatarios ? "Cargando casas..." : casasDisponibles.length ? "Selecciona una casa" : "No hay casas disponibles"}
                        </option>
                        {casasDisponibles.map((casa) => {
                          const idCasa = casa.idCasa ?? casa.id_casa ?? casa.ID_CASA ?? casa.id;
                          const numeroCasa = casa.numeroCasa ?? casa.numero_casa ?? casa.NUMERO_CASA ?? idCasa;
                          const bloque = casa.bloque ?? casa.BLOQUE;
                          return (
                            <option key={idCasa} value={idCasa}>
                              Casa #{numeroCasa}{bloque ? ` - Manzana ${bloque}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {formData.tipoDestino === "USUARIOS" && (
                    <div style={styles.formGroup}>
                      <label htmlFor="busqueda-usuarios" style={styles.label}>
                        Usuarios destinatarios ({formData.idUsuariosDestino.length} seleccionados)
                      </label>
                      <input
                        id="busqueda-usuarios"
                        type="search"
                        value={busquedaUsuario}
                        onChange={(e) => setBusquedaUsuario(e.target.value)}
                        style={styles.input}
                        placeholder="Buscar por nombre o correo"
                      />
                      <div style={styles.recipientList}>
                        {usuariosFiltrados.map((usuario) => {
                          const idUsuario = usuario.idUsuario ?? usuario.id_usuario ?? usuario.ID_USUARIO ?? usuario.id;
                          const nombre = usuario.persona?.nombreCompleto || usuario.nombreCompleto || usuario.nombreUsuario || usuario.NOMBRE_USUARIO || `Usuario ${idUsuario}`;
                          const nombreVisible = String(nombre).toLocaleLowerCase("es").replace(/(^|\s)\S/g, (letra) => letra.toLocaleUpperCase("es"));
                          const numeroCasa = usuario.numeroCasa ?? usuario.numero_casa;
                          return (
                            <label key={idUsuario} style={styles.recipientOption}>
                              <input
                                type="checkbox"
                                checked={formData.idUsuariosDestino.includes(Number(idUsuario))}
                                onChange={(e) => toggleDestinatario("idUsuariosDestino", idUsuario, e.target.checked)}
                                disabled={loadingDestinatarios}
                              />
                              <span>{numeroCasa ? `${nombreVisible} - Casa #${numeroCasa}` : nombreVisible}</span>
                            </label>
                          );
                        })}
                        {!loadingDestinatarios && usuariosFiltrados.length === 0 && (
                          <span style={styles.recipientEmpty}>No se encontraron usuarios.</span>
                        )}
                        {loadingDestinatarios && <span style={styles.recipientEmpty}>Cargando usuarios...</span>}
                      </div>
                    </div>
                  )}

                  {formData.tipoDestino === "ROLES" && (
                    <div style={styles.formGroup}>
                      <span style={styles.label}>Roles destinatarios ({formData.idRolesDestino.length} seleccionados)</span>
                      <div style={styles.recipientList}>
                        {rolesDisponibles.map((rol) => (
                          <label key={rol.idRol} style={styles.recipientOption}>
                            <input
                              type="checkbox"
                              checked={formData.idRolesDestino.includes(Number(rol.idRol))}
                              onChange={(e) => toggleDestinatario("idRolesDestino", rol.idRol, e.target.checked)}
                              disabled={loadingDestinatarios}
                            />
                            <span>{rol.nombre}</span>
                          </label>
                        ))}
                        {!loadingDestinatarios && rolesDisponibles.length === 0 && (
                          <span style={styles.recipientEmpty}>No hay roles disponibles.</span>
                        )}
                        {loadingDestinatarios && <span style={styles.recipientEmpty}>Cargando roles...</span>}
                      </div>
                    </div>
                  )}

                  {errorDestinatarios && <p role="alert" style={styles.responseError}>{errorDestinatarios}</p>}

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Canal de Despacho</label>
                    <select
                      value={formData.canalEnvio}
                      onChange={(e) => setFormData({ ...formData, canalEnvio: e.target.value })}
                      style={styles.input}
                    >
                      <option value="APP">Solo App</option>
                      <option value="EMAIL">Correo Electrónico</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="AMBOS">Email + WhatsApp</option>
                      <option value="TODOS">Todos los Canales (App + Email + WhatsApp)</option>
                    </select>
                  </div>
                </>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {activeTab === "avisos" ? "Contenido / Mensaje" : "Descripción detallada"}
                </label>
                <textarea
                  required
                  rows="4"
                  placeholder="Escribe el detalle aquí..."
                  value={formData.contenido}
                  onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                  style={{ ...styles.input, resize: "none" }}
                ></textarea>
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  Guardar y Publicar
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
  container: { width: "100%", maxWidth: "1100px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "24px", fontWeight: "700", color: "#0F172A", margin: "0 0 6px 0" },
  subtitle: { fontSize: "14px", color: "#64748B", margin: 0 },
  headerActions: { display: "flex", gap: "10px" },
  btnPrimary: { backgroundColor: "#1B4B82", color: "#FFFFFF", border: "none", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  btnSecondary: { backgroundColor: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  tabsContainer: { display: "flex", gap: "32px", borderBottom: "1px solid #E2E8F0", marginBottom: "24px" },
  tab: { background: "none", border: "none", padding: "12px 0", fontSize: "15px", fontWeight: "600", color: "#64748B", cursor: "pointer", borderBottom: "3px solid transparent" },
  tabActive: { color: "#1B4B82", borderBottom: "3px solid #1B4B82" },
  filterBar: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" },
  noticeFilters: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "20px" },
  dateFilter: { display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontSize: "12px" },
  noticeMeta: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
  priorityBadge: { fontSize: "11px", fontWeight: "700", textTransform: "uppercase", padding: "4px 8px", borderRadius: "6px", color: "#334155", backgroundColor: "#F1F5F9" },
  priorityHigh: { color: "#9A3412", backgroundColor: "#FFEDD5" },
  priorityUrgent: { color: "#991B1B", backgroundColor: "#FEE2E2" },
  noticeReceiptRow: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", marginTop: "10px" },
  filterLabel: { fontSize: "14px", fontWeight: "600", color: "#334155" },
  selectInput: { padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", fontSize: "14px", color: "#1E293B" },
  cardsGrid: { display: "flex", flexDirection: "column", gap: "16px" },
  card: { backgroundColor: "#FFFFFF", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #E2E8F0" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" },
  cardTitle: { fontSize: "16px", fontWeight: "700", color: "#0F172A", margin: "0 0 4px 0" },
  cardSub: { fontSize: "12px", color: "#64748B" },
  cardDate: { fontSize: "12px", color: "#94A3B8" },
  cardContent: { fontSize: "14px", color: "#475569", lineHeight: "1.5", margin: "0 0 14px 0" },
  responseBox: { backgroundColor: "#F8FAFC", padding: "12px", borderRadius: "6px", marginBottom: "12px", borderLeft: "3px solid #1B4B82" },
  responseHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  responseTitle: { fontSize: "12px", color: "#1B4B82" },
  responseText: { margin: "6px 0", fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap" },
  responseDate: { fontSize: "12px", color: "#64748B" },
  cardFooterSpace: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9", paddingTop: "12px" },
  categoryBadge: { fontSize: "12px", fontWeight: "500", backgroundColor: "#F1F5F9", color: "#475569", padding: "4px 10px", borderRadius: "6px" },
  destinatarioText: { fontSize: "12px", color: "#64748B", fontWeight: "500" },
  statusBadge: { fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "12px", textTransform: "uppercase" },
  btnActionSmall: { backgroundColor: "#F8FAFC", color: "#1B4B82", border: "1px solid #CBD5E1", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "12px", cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px", boxSizing: "border-box", zIndex: 1000 },
  modalContent: { backgroundColor: "#FFFFFF", padding: "28px", borderRadius: "12px", width: "100%", maxWidth: "500px", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxSizing: "border-box", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 20px 0" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#334155" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none" },
  recipientList: { maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", padding: "8px", border: "1px solid #CBD5E1", borderRadius: "6px" },
  recipientOption: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px", fontSize: "13px", color: "#334155", cursor: "pointer" },
  recipientEmpty: { padding: "6px 4px", fontSize: "13px", color: "#64748B" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" },
  responseError: { color: "#991B1B", fontSize: "13px", margin: 0 },
};