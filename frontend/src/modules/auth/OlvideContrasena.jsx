import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import api from "../../api/axios";

export default function OlvideContrasena() {
  const [correo, setCorreo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/olvide-contrasena", {
        correo: correo.trim(),
      });

      // El backend responde con un mensaje genérico de éxito.
      if (res.data?.success) {
        setEnviado(true);
      } else {
        setError(res.data?.message || "No fue posible procesar la solicitud.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Error de conexión con el servidor. Intente nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  // Vista de éxito: se envió (o se procesó) la solicitud
  if (enviado) {
    return (
      <div style={styles.container}>
        <div style={styles.cardSuccess}>
          <div style={styles.mailIconWrapperSuccess}>
            <CheckCircle2 size={40} color="#166534" />
          </div>
          <h2 style={styles.titleSuccess}>Revise su correo</h2>
          <p style={styles.descSuccess}>
            Si <strong style={{ color: "#101828" }}>{correo.trim()}</strong> está
            registrado en el sistema, recibirá un enlace para restablecer su
            contraseña. El enlace caduca en <strong>1 hora</strong>.
          </p>
          <p style={styles.hintSuccess}>
            Si no lo encuentra, revise su carpeta de spam o correo no deseado.
          </p>
          <Link to="/login" style={styles.btnPrimaryLink}>
            Volver al Inicio de Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.mailIconWrapper}>
            <Mail size={40} color="#1B4B82" />
          </div>
          <h1 style={styles.title}>Recuperar Contraseña</h1>
          <p style={styles.subtitle}>
            Ingrese el correo asociado a su cuenta y le enviaremos un enlace para
            restablecer su contraseña.
          </p>
        </div>

        {error && <div style={styles.alertError}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="correo" style={styles.label}>
              Correo Electrónico
            </label>
            <div style={styles.inputContainer}>
              <div style={styles.iconLeft}>
                <Mail size={20} color="#1B4B82" />
              </div>
              <input
                id="correo"
                type="email"
                name="correo"
                placeholder="ej. juan.perez@email.com"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  setError("");
                }}
                required
                autoFocus
                disabled={loading}
                style={styles.inputElement}
              />
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
            {loading ? "Enviando..." : "Enviar enlace de recuperación"}
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
  descSuccess: {
    fontSize: "14px",
    color: "#4B5563",
    margin: "0 0 12px 0",
    lineHeight: "1.5",
  },
  hintSuccess: {
    fontSize: "13px",
    color: "#98A2B3",
    margin: "0 0 24px 0",
    lineHeight: "1.5",
  },
  mailIconWrapper: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#EEF4FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px auto",
  },
  mailIconWrapperSuccess: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: "#DCFCE7",
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
    padding: "10px 36px 10px 40px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
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
