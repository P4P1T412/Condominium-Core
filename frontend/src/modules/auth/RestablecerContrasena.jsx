import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import api from "../../api/axios";

export default function RestablecerContrasena() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validación de coincidencia y longitud mínima
    if (nuevaContrasena.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nuevaContrasena !== confirmarContrasena) {
      setError("Las contraseñas no coinciden. Por favor, verifíquelas.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/restablecer-contrasena", {
        token,
        nuevaContrasena,
      });

      if (res.data?.success) {
        setExito(true);
      } else {
        setError(res.data?.message || "No fue posible restablecer la contraseña.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Token inválido o expirado. Solicite un nuevo enlace de recuperación."
      );
    } finally {
      setLoading(false);
    }
  };

  // Vista de éxito: contraseña restablecida
  if (exito) {
    return (
      <div style={styles.container}>
        <div style={styles.cardSuccess}>
          <div style={styles.iconWrapperSuccess}>
            <CheckCircle2 size={40} color="#166534" />
          </div>
          <h2 style={styles.titleSuccess}>¡Contraseña Restablecida!</h2>
          <p style={styles.descSuccess}>
            Su contraseña fue actualizada correctamente. Ya puede iniciar sesión
            con sus nuevas credenciales.
          </p>
          <Link to="/login" style={styles.btnPrimaryLink}>
            Ir al Inicio de Sesión
          </Link>
        </div>
      </div>
    );
  }

  // Token ausente en la URL: no tiene sentido mostrar el formulario
  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.cardSuccess}>
          <div style={styles.iconWrapperWarning}>
            <AlertTriangle size={40} color="#B45309" />
          </div>
          <h2 style={styles.titleWarning}>Enlace no válido</h2>
          <p style={styles.descSuccess}>
            El enlace de recuperación está incompleto o es incorrecto. Solicite
            un nuevo enlace para continuar.
          </p>
          <Link to="/olvide-contrasena" style={styles.btnPrimaryLink}>
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <Lock size={40} color="#1B4B82" />
          </div>
          <h1 style={styles.title}>Nueva Contraseña</h1>
          <p style={styles.subtitle}>
            Cree una nueva contraseña para su cuenta. Debe tener al menos 6
            caracteres.
          </p>
        </div>

        {error && <div style={styles.alertError}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="nuevaContrasena" style={styles.label}>
              Nueva Contraseña
            </label>
            <div style={styles.inputContainer}>
              <div style={styles.iconLeft}>
                <Lock size={20} color="#1B4B82" />
              </div>
              <input
                id="nuevaContrasena"
                type={showPassword ? "text" : "password"}
                name="nuevaContrasena"
                placeholder="Mínimo 6 caracteres"
                value={nuevaContrasena}
                onChange={(e) => {
                  setNuevaContrasena(e.target.value);
                  setError("");
                }}
                required
                autoFocus
                disabled={loading}
                style={styles.inputElement}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.btnTogglePassword}
                tabIndex="-1"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#6B7280" />
                ) : (
                  <Eye size={18} color="#6B7280" />
                )}
              </button>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="confirmarContrasena" style={styles.label}>
              Confirmar Nueva Contraseña
            </label>
            <div style={styles.inputContainer}>
              <div style={styles.iconLeft}>
                <Lock size={20} color="#1B4B82" />
              </div>
              <input
                id="confirmarContrasena"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmarContrasena"
                placeholder="Repita su nueva contraseña"
                value={confirmarContrasena}
                onChange={(e) => {
                  setConfirmarContrasena(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
                style={styles.inputElement}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.btnTogglePassword}
                tabIndex="-1"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} color="#6B7280" />
                ) : (
                  <Eye size={18} color="#6B7280" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.btnSubmit,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Actualizando..." : "Restablecer Contraseña"}
          </button>

          <div style={styles.footerLink}>
            <Link to="/login" style={styles.link}>
              <ArrowLeft size={16} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              Volver al inicio de sesión
            </Link>
          </div>
        </form>
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
    backgroundColor: "#F7F9FC",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "36px 32px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
    border: "1px solid #E5E7EB",
    boxSizing: "border-box",
  },
  cardSuccess: {
    width: "100%",
    maxWidth: "440px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "40px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
    border: "1px solid #E5E7EB",
    boxSizing: "border-box",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: {
    marginBottom: "24px",
    textAlign: "center",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "24px",
    fontWeight: "700",
    color: "#101828",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    color: "#667085",
    lineHeight: "1.5",
  },
  titleSuccess: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#166534",
    margin: "0 0 12px 0",
  },
  titleWarning: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#B45309",
    margin: "0 0 12px 0",
  },
  descSuccess: {
    fontSize: "14px",
    color: "#4B5563",
    margin: "0 0 24px 0",
    lineHeight: "1.5",
  },
  iconWrapper: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#EEF4FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px auto",
  },
  iconWrapperSuccess: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#DCFCE7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px auto",
  },
  iconWrapperWarning: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#FEF3C7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px auto",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "16px",
    textAlign: "left",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#101828",
    marginBottom: "6px",
  },
  inputContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  iconLeft: {
    position: "absolute",
    left: "12px",
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
  },
  inputElement: {
    width: "100%",
    padding: "10px 40px 10px 40px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  btnTogglePassword: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: 0,
  },
  btnSubmit: {
    backgroundColor: "#1B4B82",
    color: "#FFFFFF",
    border: "none",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    marginTop: "8px",
  },
  btnPrimaryLink: {
    backgroundColor: "#1B4B82",
    color: "#FFFFFF",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    textDecoration: "none",
  },
  footerLink: {
    textAlign: "center",
    marginTop: "24px",
  },
  link: {
    color: "#667085",
    fontSize: "14px",
    textDecoration: "none",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    border: "1px solid #FCA5A5",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "20px",
    fontSize: "13px",
    textAlign: "center",
  },
};
