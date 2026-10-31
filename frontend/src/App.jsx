import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import Home from "./components/Home";
import Login from "./modules/auth/Login";
import Registro from "./modules/auth/Registro";
import OlvideContrasena from "./modules/auth/OlvideContrasena";
import RestablecerContrasena from "./modules/auth/RestablecerContrasena";
import CasasList from "./modules/casas/CasasPage";
import Pagos from "./modules/pagos/Pagos";
import Notificaciones from "./modules/notificaciones/Notificaciones";
import Garita from "./modules/seguridad/Garita";
import ProtectedRoute from "./routes/ProtectedRoute";
import UsuariosPage from "./modules/usuarios/UsuariosPage";
import VisitasPage from "./modules/visitas/VisitasPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/olvide-contrasena" element={<OlvideContrasena />} />
        <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />

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
                <UsuariosPage />
              </ProtectedRoute>
            }
          />

          {/* Compartidas / Condómino / Garita */}
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
              <ProtectedRoute allowedRoles={["administrador", "condomino", "garita"]}>
                <VisitasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notificaciones"
            element={
              <ProtectedRoute allowedRoles={["administrador", "condomino", "garita"]}>
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