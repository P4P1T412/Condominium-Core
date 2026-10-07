import { useState } from "react";
import "./Tabs.css";

/**
 * Componente reutilizable de navegación por pestañas.
 * 
 * Permite cambiar entre vistas secundarias dentro de un mismo módulo
 * sin alterar la ruta principal de la URL ni recargar el estado global.
 *
 * @param {Array<{id: string, label: string, content: React.ReactNode}>} tabs - Lista de pestañas a renderizar.
 * @param {string} [defaultTab] - ID de la pestaña que se mostrará inicialmente.
 */
export default function Tabs({ tabs, defaultTab }) {
  // Inicializa con la pestaña indicada o toma la primera por defecto
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  // Ubica el nodo correspondiente a la pestaña seleccionada
  const current = tabs.find((t) => t.id === activeTab) || tabs[0];

  if (!tabs || tabs.length === 0) return null;

  return (
    <div className="tabs-container">
      {/* Barra superior de pestañas */}
      <div className="tabs-bar" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`tabs-bar__item ${isActive ? "tabs-bar__item--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenedor dinámico del contenido activo */}
      <div className="tabs-content" role="tabpanel">
        {current?.content}
      </div>
    </div>
  );
}