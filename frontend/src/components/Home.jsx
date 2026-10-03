import { Link } from "react-router-dom";
import { Building2, CreditCard, Megaphone, ShieldCheck } from "lucide-react";
import "./Home.css";

const features = [
  {
    icon: Building2,
    title: "Casas y familias",
    description: "Expediente de cada vivienda con su responsable y sus residentes.",
  },
  {
    icon: CreditCard,
    title: "Pagos y morosidad",
    description: "Comprobantes en línea, validación del administrador y estado de cuenta.",
  },
  {
    icon: Megaphone,
    title: "Comunicados y quejas",
    description: "Avisos a todo el condominio o a una casa, con seguimiento de reportes.",
  },
  {
    icon: ShieldCheck,
    title: "Control de garita",
    description: "Verificación de visitas autorizadas y registro de entradas y salidas.",
  },
];

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-header__brand">
          <span className="landing-logo">
            <Building2 size={20} strokeWidth={2.2} />
          </span>
          <span className="landing-header__name">Condominio</span>
        </div>
        <Link to="/login" className="btn btn--primary btn--sm">
          Iniciar sesión
        </Link>
      </header>

      <main className="landing-hero">
        <p className="landing-eyebrow">Gestión residencial</p>
        <h1 className="landing-title">
          Sistema de Gestión de
          <br />
          Condominio
        </h1>
        <p className="landing-subtitle">
          Centraliza el control administrativo, financiero y de seguridad de tu
          residencial: casas, cuotas de mantenimiento, comunicados, quejas y
          acceso de visitantes.
        </p>
        <div className="landing-actions">
          <Link to="/login" className="btn btn--primary">
            Entrar al sistema
          </Link>
          <Link to="/registro" className="btn btn--secondary">
            Crear cuenta
          </Link>
        </div>

        <div className="landing-features">
          {features.map(({ icon: Icon, title, description }) => (
            <div className="feature-card" key={title}>
              <Icon size={22} strokeWidth={2} className="feature-card__icon" />
              <h3 className="feature-card__title">{title}</h3>
              <p className="feature-card__description">{description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}