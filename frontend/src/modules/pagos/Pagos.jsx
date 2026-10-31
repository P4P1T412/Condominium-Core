import { useAuth } from "../../context/AuthContext";
import AdminFinance from "./AdminFinance";
import ResidentPayments from "./ResidentPayments";

export default function Pagos() {
  const { user } = useAuth();
  const isAdmin = (user?.role || user?.rol || "").toLowerCase() === "administrador";
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 4px", color: "var(--color-text, #101828)" }}>
          {isAdmin ? "Finanzas" : "Mis Pagos y Cuenta"}
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted, #667085)" }}>
          {isAdmin ? "Valida comprobantes, revisa cuentas y gestiona la morosidad." : "Consulta tus cuotas y reporta tus pagos."}
        </p>
      </header>
      {isAdmin ? <AdminFinance /> : <ResidentPayments />}
    </div>
  );
}
