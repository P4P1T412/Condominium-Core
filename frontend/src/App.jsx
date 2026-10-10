import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Notificaciones from './modules/notificaciones/Notificaciones';
import VisitasPage from './modules/visitas/VisitasPage';

// Componente de diseño para la barra de navegación lateral / superior
function NavigationLayout({ children }) {
  const location = useLocation();

  const navItems = [
    { path: '/notificaciones', label: '🔔 Notificaciones' },
    { path: '/visitas', label: '🚗 Mis Visitas' }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Encabezado Principal */}
      <header style={{ backgroundColor: '#1a252f', color: '#fff', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>🏢 Condominio - Panel Residente</h1>
        <span style={{ fontSize: '14px', opacity: 0.8 }}>Dev 3 (Wendy)</span>
      </header>

      {/* Menú de Navegación */}
      <nav style={{ backgroundColor: '#2c3e50', padding: '0 30px', display: 'flex', gap: '10px' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                color: isActive ? '#fff' : '#bdc3c7',
                textDecoration: 'none',
                padding: '12px 20px',
                fontWeight: isActive ? 'bold' : 'normal',
                borderBottom: isActive ? '3px solid #3498db' : '3px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Contenido Principal */}
      <main style={{ padding: '20px' }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <NavigationLayout>
        <Routes>
          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/notificaciones" replace />} />

          {/* Rutas Módulos Dev 3 */}
          <Route path="/notificaciones" element={<Notificaciones />} />
          <Route path="/visitas" element={<VisitasPage />} />

          {/* Ruta comodín */}
          <Route path="*" element={<Navigate to="/notificaciones" replace />} />
        </Routes>
      </NavigationLayout>
    </Router>
  );
}