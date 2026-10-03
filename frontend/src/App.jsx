import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Login from "./modules/auth/Login";
import CasasList from "./modules/casas/CasasPage";
import Pagos from "./modules/pagos/Pagos";
import Notificaciones from "./modules/notificaciones/Notificaciones";
import Garita from "./modules/seguridad/Garita";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas Protegidas en Layout con Sidebar */}
        <Route element={<Layout />}>
          {/* Administrador */}
          <Route
            path="/casas"
            element={
              <ProtectedRoute allowedRoles={["administrador"]}>
                <CasasList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute allowedRoles={["administrador"]}>
                <div style={{ padding: "20px" }}>
                  <h2>Usuarios y Roles</h2>
                  <p style={{ color: "#667085" }}>Módulo de administración de accesos y cuentas.</p>
                </div>
              </ProtectedRoute>
            }
          />

          {/* Compartidas / Condómino */}
          <Route
            path="/pagos"
            element={
              <ProtectedRoute allowedRoles={["administrador", "condomino"]}>
                <Pagos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitas"
            element={
              <ProtectedRoute allowedRoles={["condomino"]}>
                <div style={{ padding: "20px" }}>
                  <h2>Mis Visitas Anticipadas</h2>
                  <p style={{ color: "#667085" }}>Registro de visitas autorizadas para garita.</p>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <ProtectedRoute allowedRoles={["administrador", "condomino"]}>
                <Notificaciones />
              </ProtectedRoute>
            }
          />

          {/* Garita */}
          <Route
            path="/garita"
            element={
              <ProtectedRoute allowedRoles={["administrador", "garita"]}>
                <Garita />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}