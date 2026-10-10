# Guía de Frontend — Módulos, Pestañas y Componentes

Esta guía define cómo debe construirse cada pantalla del frontend: qué pestañas lleva,
qué debe mostrar cada una, y qué componentes compartidos hay que usar para que las 5
páginas del administrador se vean y se comporten de forma consistente.

Léela junto con el `README.md` del repositorio (estructura de carpetas y cómo levantar
el proyecto) y el documento de sprints/roles (quién construye qué).

---

## 1. Patrón general: toda página de módulo usa pestañas

Las 5 páginas del administrador, y algunas del condómino, se construyen con el mismo
esqueleto: un **encabezado de módulo** con pestañas arriba, y el contenido de la pestaña
activa debajo.

```
┌─────────────────────────────────────────────┐
│  SIDEBAR   │  CABECERA DEL MÓDULO             │
│            │  [ Pestaña 1 ] [ Pestaña 2 ] ... │
│ [Casas]    │  ─────────────────────────────── │
│ [Usuarios] │                                   │
│ [Finanzas] │       contenido de la pestaña     │
│ [Comunic.] │             activa                │
│ [Garita]   │                                   │
└─────────────────────────────────────────────┘
```

Para no repetir esta lógica 5 veces, **todos los módulos deben usar el mismo componente
de pestañas**, construido una sola vez y reutilizado. No se vale que cada desarrollador
invente su propia versión de tabs.

### Componente compartido: `src/components/Tabs.jsx`

```jsx
import { useState } from "react";
import "./Tabs.css";

// Uso:
// <Tabs tabs={[
//   { id: "catalogo", label: "Catálogo de Casas", content: <CatalogoCasas /> },
//   { id: "censo", label: "Censo y Núcleo Familiar", content: <CensoFamiliar /> },
// ]} />
export default function Tabs({ tabs, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0].id);
  const current = tabs.find((t) => t.id === activeTab);

  return (
    <div>
      <div className="tabs-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tabs-bar__item ${activeTab === tab.id ? "tabs-bar__item--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">{current.content}</div>
    </div>
  );
}
```

```css
/* src/components/Tabs.css */
.tabs-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 24px;
}

.tabs-bar__item {
  padding: 10px 16px;
  border: none;
  background: none;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tabs-bar__item--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
```

Cada módulo simplemente importa `Tabs` y le pasa sus propias pestañas como en el
ejemplo de arriba — ve el detalle de cada módulo en las secciones siguientes.

### Componente compartido: `src/components/StatusBadge.jsx`

Varios módulos muestran estados como `ACTIVO`/`INACTIVO`, `PENDIENTE`/`EN_PROCESO`/`RESUELTO`,
`HABITADA`/`DISPONIBLE`. Todos deben verse igual, así que usamos un solo componente:

```jsx
import "./StatusBadge.css";

const COLORS = {
  ACTIVO: "green",
  HABITADA: "green",
  RESUELTO: "green",
  DISPONIBLE: "blue",
  EN_PROCESO: "blue",
  PENDIENTE: "amber",
  INACTIVO: "gray",
  RECHAZADO: "red",
};

export default function StatusBadge({ status }) {
  const color = COLORS[status] || "gray";
  return <span className={`status-badge status-badge--${color}`}>{status}</span>;
}
```

```css
/* src/components/StatusBadge.css */
.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.status-badge--green  { background: #DCFCE7; color: #166534; }
.status-badge--blue   { background: #DBEAFE; color: #1E40AF; }
.status-badge--amber  { background: #FEF3C7; color: #92400E; }
.status-badge--gray   { background: #F1F5F9; color: #475569; }
.status-badge--red    { background: #FEE2E2; color: #991B1B; }
```

Úsalo así: `<StatusBadge status="PENDIENTE" />`.

---

## 2. Módulo: Casas y Padrón — `/casas`

**Responsable:** Dev 1

```
src/modules/casas/
├── CasasPage.jsx           → arma el <Tabs> con las 2 pestañas de abajo
├── CatalogoCasas.jsx       → pestaña 1
└── CensoFamiliar.jsx       → pestaña 2
```

### Pestaña 1 — Catálogo de Casas
- Tabla o cuadrícula de viviendas (`A-101`, `A-102`, etc.) con columnas: número de casa,
  dirección, propietario responsable, y `<StatusBadge status="HABITADA" />` o `DISPONIBLE`.
- Botón de acción principal arriba de la tabla: **`+ Registrar Nueva Casa`**, abre un
  formulario (modal o página aparte) para crear la vivienda.
- Datos vienen de `GET /api/casas`.

### Pestaña 2 — Censo y Núcleo Familiar
- Vista consolidada de todos los residentes: titulares, familiares, dependientes e
  inquilinos.
- Barra de búsqueda por nombre o DPI.
- Cada resultado debe permitir vincular rápidamente a esa persona a una casa existente
  (selector de casa + botón "Vincular").
- Datos vienen de `GET /api/casas/:id/residentes` (endpoint nuevo a definir con backend).

---

## 3. Módulo: Usuarios y Roles — `/usuarios`

**Responsable:** Dev 1

```
src/modules/usuarios/
├── UsuariosPage.jsx        → arma el <Tabs>
├── DirectorioCuentas.jsx   → pestaña 1
└── AsignacionRoles.jsx     → pestaña 2
```

### Pestaña 1 — Directorio de Cuentas
- Tabla con todos los usuarios registrados: usuario (`admin`, `jperez`...), correo,
  fecha de último ingreso, y `<StatusBadge status="ACTIVO" />` o `INACTIVO`.
- Cada fila lleva un switch o botón para activar/suspender el acceso de esa cuenta
  (`PUT /api/usuarios/:id/estado`).
- Botón de acción: **`+ Crear Usuario / Condómino`**.

### Pestaña 2 — Asignación de Roles
- Panel para cambiar o asignar el rol de una cuenta: `ADMINISTRADOR`, `CONDOMINO`,
  `GARITA` (selector desplegable).
- Al elegir un usuario, mostrar los permisos asociados a su rol actual como referencia
  antes de cambiarlo.

> ⚠️ Esta página maneja roles y credenciales — todas sus peticiones deben ir protegidas
> con `verifyJWT` + `checkRole(['administrador'])` en el backend, sin excepción.

---

## 4. Módulo: Finanzas — `/pagos`

**Responsable:** Dev 2

```
src/modules/pagos/
├── FinanzasPage.jsx         → arma el <Tabs> (vista administrador)
├── ValidacionComprobantes.jsx
├── EstadoCuentaGeneral.jsx
└── ReporteMorosos.jsx
```

### Pestaña 1 — Validación de Comprobantes
- Lista de comprobantes en estado `PENDIENTE`, con vista previa de la imagen/PDF subido.
- Cada fila lleva dos botones directos: **`Aprobar`** y **`Rechazar`**; al rechazar,
  debe pedir un campo de texto obligatorio con el motivo antes de confirmar.
- Datos de `GET /api/pagos?estado=pendiente`.

### Pestaña 2 — Estado de Cuenta General
- Consume la vista `VW_ESTADO_CUENTA` de la base de datos (pídele a DB Dev 1/2 que la
  agreguen en `database/views/` si aún no existe).
- Muestra el desglose por casa: cuotas emitidas, pagadas y saldo pendiente.

### Pestaña 3 — Reporte de Morosos
- Consume la vista `VW_CASAS_MOROSAS` (ya existe en `database/views/vw_casas_morosas.sql`).
- Tabla con indicador de días de mora y el total vencido por casa.

---

## 5. Módulo: Comunicaciones — `/notificaciones`

**Responsable:** Dev 3 — Sprint 3

```
src/modules/notificaciones/
├── ComunicacionesPage.jsx  → arma el <Tabs> (vista administrador)
├── AvisosCirculares.jsx
└── BuzonQuejas.jsx
```

### Pestaña 1 — Avisos y Circulares
- Lista de publicaciones ya emitidas por la administración (a todo el condominio o a
  una casa puntual).
- Formulario para crear un nuevo comunicado: título, contenido, y selector de
  destinatario (todo el condominio / una casa específica).

### Pestaña 2 — Buzón de Reportes / Quejas
- Lista de incidencias enviadas por condóminos.
- Selector de estado por fila: `<StatusBadge status="PENDIENTE" />` /
  `EN_PROCESO` / `RESUELTO`, editable por el administrador.

---

## 6. Módulo: Garita y Seguridad — `/garita`

**Responsable:** Dev 2

Nota: esta es la **vista del administrador** sobre garita (supervisión). La pantalla
que usa el personal de garita en la entrada es una vista aparte, más simple — ver nota
al final de esta sección.

```
src/modules/seguridad/
├── GaritaPage.jsx           → arma el <Tabs> (vista administrador)
├── TerminalAcceso.jsx
└── BitacoraDia.jsx
```

### Pestaña 1 — Terminal de Acceso (Fast-Track)
- Buscador de visitas autorizadas (por nombre o DPI).
- Botón de entrada/salida directo sobre el resultado encontrado.

### Pestaña 2 — Bitácora del Día
- Registro cronológico de todos los ingresos y salidas, cada uno con su timestamp.

> La pantalla que corre en la tablet de garita (rol `GARITA`, no `ADMINISTRADOR`) debe
> seguir siendo la versión simplificada que ya definimos antes: búsqueda grande +
> botones de Autorizar/Denegar, sin pestañas ni menús adicionales, para que el proceso
> en la caseta sea rápido. Esta página de `/garita` con pestañas es para cuando el
> **administrador** quiere supervisar, no para el guardia en turno.

---

## 7. Módulo: Mis Visitas (condómino) — `/visitas`

**Responsable:** Dev 3

Esta ruta todavía no existe en `App.jsx` — hay que agregarla:

```jsx
// src/App.jsx
import MisVisitas from "./modules/visitas/MisVisitas";

// dentro de <Route element={<Layout />}>
<Route
  path="/visitas"
  element={
    <ProtectedRoute allowedRoles={["condomino"]}>
      <MisVisitas />
    </ProtectedRoute>
  }
/>
```

```
src/modules/visitas/
├── MisVisitas.jsx           → arma el <Tabs>
├── RegistrarVisita.jsx
└── ListaVisitas.jsx
```

- **Pestaña Registrar nueva visita**: formulario con nombre del visitante, DPI y
  fecha/hora esperada.
- **Pestaña Mis visitas**: lista de visitas activas y concluidas, con su estado.

---

## 8. Checklist antes de dar una pestaña por terminada

Igual que las historias de usuario del documento de sprints, cada pestaña debe cumplir:

- [ ] Usa el componente `<Tabs>` y `<StatusBadge>` compartidos — no estilos propios para esto.
- [ ] Los datos vienen de la API (`src/services/api.js`), no están hardcodeados.
- [ ] Las rutas que requieren rol específico están envueltas en `<ProtectedRoute allowedRoles={[...]}>`.
- [ ] Se probó con al menos un dato de cada estado posible (ej. ver cómo se ve `INACTIVO` y no solo `ACTIVO`).
- [ ] Revisado por al menos otro integrante antes de hacer merge a `develop`.
