import Tabs from "../../components/Tabs";
import CatalogoCasas from "./CatalogoCasas";
import CensoFamiliar from "./CensoFamiliar";

/**
 * Vista contenedora del Módulo 2: Casas y Padrón Residencial.
 * 
 * Orquesta la navegación interna entre el catálogo de inmuebles y el
 * censo consolidado de habitantes mediante el componente global Tabs.
 */
export default function CasasPage() {
  const tabs = [
    {
      id: "catalogo",
      label: "Catálogo de Casas",
      content: <CatalogoCasas />,
    },
    {
      id: "censo",
      label: "Censo y Núcleo Familiar",
      content: <CensoFamiliar />,
    },
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Viviendas y Padrón Residencial</h1>
        <p style={styles.subtitle}>
          Administración del inventario de casas, asignación de titulares y censo de residentes.
        </p>
      </header>

      <Tabs tabs={tabs} defaultTab="catalogo" />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "20px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
    margin: "0 0 4px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--color-text-muted, #667085)",
    margin: 0,
  },
};