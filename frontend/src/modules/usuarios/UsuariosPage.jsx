import Tabs from "../../components/Tabs";
import DirectorioCuentas from "./DirectorioCuentas";
import AsignacionRoles from "./AsignacionRoles";

/**
 * Módulo 3: Usuarios y Roles
 * Orquesta el directorio de accesos al sistema y el control de roles.
 */
export default function UsuariosPage() {
  const tabs = [
    {
      id: "directorio",
      label: "Directorio de Cuentas",
      content: <DirectorioCuentas />,
    },
    {
      id: "roles",
      label: "Asignación de Roles",
      content: <AsignacionRoles />,
    },
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Usuarios y Accesos al Sistema</h1>
        <p style={styles.subtitle}>
          Administración de cuentas con credenciales, suspensión de accesos y asignación de roles.
        </p>
      </header>

      <Tabs tabs={tabs} defaultTab="directorio" />
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