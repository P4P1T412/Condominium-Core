import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { Eye, EyeOff } from "lucide-react"; // Importamos los iconos de lucide-react

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para controlar la visibilidad de la contraseña

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Petición al backend desarrollado en Node/Oracle
      const response = await api.post("/auth/login", {
        username: username.trim(),
        password,
      });

      const { data } = response;

      if (data && data.success) {
        // CORRECCIÓN CLAVE: Extraer tanto el usuario como el token de la respuesta
        const userObj = data.data?.user || data.user;
        const tokenStr = data.token || data.data?.token || data.accessToken;

        // 2. Guardar en AuthContext Y en localStorage (Usuario + Token)
        login(userObj, tokenStr);

        // 3. Redirección inteligente según el rol obtenido de Oracle
        const userRole = (userObj?.role || userObj?.rol || "").toLowerCase();

        if (userRole === "administrador" || userRole === "admin") {
          navigate("/casas");
        } else if (userRole === "garita") {
          navigate("/garita");
        } else {
          navigate("/pagos");
        }
      } else {
        setError(data?.message || "No fue posible iniciar sesión.");
      }
    } catch (err) {
      // Manejo de errores controlados del backend o caída de BD (503)
      const errorMsg =
        err.response?.data?.message ||
        "Error de conexión con el servidor. Verifique si el servicio está activo.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Iniciar Sesión</h1>
          <p style={styles.subtitle}>Sistema de Gestión de Condominio</p>
        </div>

        {error && <div style={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="username" style={styles.label}>
              Usuario o Correo Electrónico
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. admin o jperez"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              Contraseña
            </label>
            <div style={styles.passwordContainer}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={styles.passwordInput}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.toggleButton}
                disabled={loading}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </button>
            </div>
            <div style={styles.forgotContainer}>
              <Link to="/olvide-contrasena" style={styles.forgotLink}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verificando..." : "Entrar al sistema"}
          </button>
        </form>

        <div style={styles.footer}>
          <Link to="/" style={styles.backLink}>
            ← Volver a la página principal
          </Link>
          <p style={styles.registerHint}>
            ¿No tienes cuenta?{" "}
            <Link to="/registro" style={styles.registerLink}>
              Solicita tu registro
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--color-bg, #F7F9FC)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "36px 32px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
    border: "1px solid var(--color-border, #E5E7EB)",
    boxSizing: "border-box",
  },
  header: {
    marginBottom: "24px",
    textAlign: "center",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "24px",
    fontWeight: "700",
    color: "var(--color-text, #101828)",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "var(--color-text-muted, #667085)",
  },
  errorMessage: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    border: "1px solid #FCA5A5",
    borderRadius: "6px",
    padding: "10px 14px",
    fontSize: "13px",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    textAlign: "left",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--color-text, #101828)",
  },
  input: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
    width: "100%",
  },
  passwordContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  passwordInput: {
    width: "100%",
    padding: "10px 40px 10px 14px",
    borderRadius: "8px",
    border: "1px solid var(--color-border, #E5E7EB)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  toggleButton: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  forgotContainer: {
    textAlign: "right",
    marginTop: "4px",
  },
  forgotLink: {
    fontSize: "13px",
    color: "var(--color-primary, #1B4B82)",
    fontWeight: "600",
    textDecoration: "none",
  },
  button: {
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "var(--color-primary, #1B4B82)",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: "600",
    marginTop: "8px",
    transition: "background-color 0.2s",
  },
  footer: {
    marginTop: "24px",
    textAlign: "center",
  },
  backLink: {
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
    textDecoration: "none",
  },
  registerHint: {
    margin: "14px 0 0 0",
    fontSize: "13px",
    color: "var(--color-text-muted, #667085)",
  },
  registerLink: {
    color: "var(--color-primary, #1B4B82)",
    fontWeight: "600",
    textDecoration: "none",
  },
};