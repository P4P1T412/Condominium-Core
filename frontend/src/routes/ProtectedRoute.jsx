import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Uso: <ProtectedRoute allowedRoles={['administrador']}><Panel /></ProtectedRoute>
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles) {
    const userRole = (user.rol || user.role || "").toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}