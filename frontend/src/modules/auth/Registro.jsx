import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Hash, Phone, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import api from "../../api/axios";

export default function Registro() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    dpi: "",
    telefono: "",
    correo: "",
    nombreUsuario: "",
    contrasena: "",
    confirmarContrasena: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  // Estados para mostrar u ocultar las contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(""); 
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError("");

    // Validar que las contraseñas coincidan
    if (formData.contrasena !== formData.confirmarContrasena) {
      setError("Las contraseñas no coinciden. Por favor, verifíquelas.");
      return;
    }

    if (formData.contrasena.length < 6) {
       setError("La contraseña debe tener al menos 6 caracteres.");
       return;
    }

    setLoading(true);
    try {
      // Excluir confirmarContrasena al enviar al backend
      const payload = {
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        dpi: formData.dpi,
        telefono: formData.telefono,
        correo: formData.correo,
        nombreUsuario: formData.nombreUsuario,
        contrasena: formData.contrasena
      };

      const res = await api.post("/auth/registro", payload);

      if (res.data?.success) {
        setSuccess(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al enviar la solicitud de registro.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.cardSuccess}>
          <CheckCircle2 size={48} color="#166534" style={{ marginBottom: "16px" }} />
          <h2 style={styles.titleSuccess}>¡Solicitud Enviada!</h2>
          <p style={styles.descSuccess}>
            Su registro ha sido recibido exitosamente. Un administrador validará sus datos y autorizará su acceso a la plataforma.
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
          <h1 style={styles.title}>Crear Solicitud de Cuenta</h1>
          <p style={styles.subtitle}>Sistema de Gestión de Condominio — Auto-registro</p>
        </div>

        {error && <div style={styles.alertError}>{error}</div>}

        <form onSubmit={handleRegistro} style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nombres *</label>
              <div style={styles.inputContainer}>
                <div style={styles.iconLeft}><User size={20} color="#1B4B82" /></div>
                <input
                  type="text"
                  name="nombres"
                  placeholder="ej. Juan Carlos"
                  value={formData.nombres}
                  onChange={handleChange}
                  required
                  style={styles.inputElement}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Apellidos *</label>
              <div style={styles.inputContainer}>
                <div style={styles.iconLeft}><User size={20} color="#1B4B82" /></div>
                <input
                  type="text"
                  name="apellidos"
                  placeholder="ej. Pérez López"
                  value={formData.apellidos}
                  onChange={handleChange}
                  required
                  style={styles.inputElement}
                />
              </div>
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>DPI *</label>
              <div style={styles.inputContainer}>
                <div style={styles.iconLeft}><Hash size={20} color="#1B4B82" /></div>
                <input
                  type="text"
                  name="dpi"
                  placeholder="13 dígitos"
                  value={formData.dpi}
                  onChange={handleChange}
                  required
                  style={styles.inputElement}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Teléfono *</label>
              <div style={styles.inputContainer}>
                <div style={styles.iconLeft}><Phone size={20} color="#1B4B82" /></div>
                <input
                  type="text"
                  name="telefono"
                  placeholder="ej. 5555-1234"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                  style={styles.inputElement}
                />
              </div>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Correo Electrónico *</label>
            <div style={styles.inputContainer}>
              <div style={styles.iconLeft}><Mail size={20} color="#1B4B82" /></div>
              <input
                type="email"
                name="correo"
                placeholder="ej. juan.perez@email.com"
                value={formData.correo}
                onChange={handleChange}
                required
                style={styles.inputElement}
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Nombre de Usuario *</label>
            <div style={styles.inputContainer}>
              <div style={styles.iconLeft}><User size={20} color="#1B4B82" /></div>
              <input
                type="text"
                name="nombreUsuario"
                placeholder="ej. jperez"
                value={formData.nombreUsuario}
                onChange={handleChange}
                required
                style={styles.inputElement}
              />
            </div>
          </div>

          {/* Fila de Contraseñas con botón de mostrar/ocultar */}
          <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Contraseña *</label>
                <div style={styles.inputContainer}>
                  <div style={styles.iconLeft}><Lock size={20} color="#1B4B82" /></div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="contrasena"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.contrasena}
                    onChange={handleChange}
                    required
                    style={styles.inputElement}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.btnTogglePassword}
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
                  </button>
                </div>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Confirmar Contraseña *</label>
                <div style={styles.inputContainer}>
                  <div style={styles.iconLeft}><Lock size={20} color="#1B4B82" /></div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmarContrasena"
                    placeholder="Repita su contraseña"
                    value={formData.confirmarContrasena}
                    onChange={handleChange}
                    required
                    style={styles.inputElement}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.btnTogglePassword}
                    tabIndex="-1"
                  >
                    {showConfirmPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
                  </button>
                </div>
              </div>
          </div>

          <button type="submit" style={styles.btnSubmit} disabled={loading}>
            {loading ? "Enviando solicitud..." : "Enviar solicitud de registro"}
          </button>

          <div style={styles.footerLink}>
            <Link to="/login" style={styles.link}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#F7F9FC", padding: "20px" },
  card: { backgroundColor: "#FFFFFF", padding: "32px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", width: "100%", maxWidth: "600px", boxSizing: "border-box" },
  cardSuccess: { backgroundColor: "#FFFFFF", padding: "40px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", width: "100%", maxWidth: "450px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" },
  header: { textAlign: "center", marginBottom: "24px" },
  title: { fontSize: "24px", fontWeight: "700", color: "#101828", margin: "0 0 8px 0" },
  subtitle: { fontSize: "14px", color: "#667085", margin: 0 },
  titleSuccess: { fontSize: "24px", fontWeight: "700", color: "#166534", margin: "0 0 12px 0" },
  descSuccess: { fontSize: "14px", color: "#4B5563", marginBottom: "24px", lineHeight: "1.5" },
  form: { display: "flex", flexDirection: "column" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", marginBottom: "16px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#101828", marginBottom: "6px" },
  
  // Estilos del contenedor de input y sus iconos
  inputContainer: { position: "relative", display: "flex", alignItems: "center", width: "100%" },
  iconLeft: { position: "absolute", left: "12px", display: "flex", alignItems: "center", pointerEvents: "none" },
  inputElement: { width: "100%", padding: "10px 36px 10px 40px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px", outline: "none", boxSizing: "border-box" },
  btnTogglePassword: { position: "absolute", right: "12px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 },
  
  btnSubmit: { backgroundColor: "#1B4B82", color: "#FFFFFF", border: "none", padding: "12px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginTop: "8px" },
  btnPrimaryLink: { backgroundColor: "#1B4B82", color: "#FFFFFF", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none" },
  footerLink: { textAlign: "center", marginTop: "24px" },
  link: { color: "#667085", fontSize: "14px", textDecoration: "none" },
  alertError: { backgroundColor: "#FEE2E2", color: "#991B1B", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", textAlign: "center" }
};