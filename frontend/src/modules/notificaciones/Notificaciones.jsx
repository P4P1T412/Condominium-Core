import React, { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';

export default function Notificaciones() {
  const [activeTab, setActiveTab] = useState('avisos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');

  // Estado para el formulario de quejas / sugerencias
  const [formQueja, setFormQueja] = useState({
    asunto: '',
    categoria: 'Mantenimiento',
    descripcion: ''
  });

  // Datos de prueba para Avisos Generales del Condominio (RF-10)
  const [avisos] = useState([
    {
      id: 'AV-101',
      titulo: 'Mantenimiento Programado de Piscinas',
      categoria: 'Mantenimiento',
      fecha: '2026-10-06',
      mensaje: 'Estimados vecinos, la piscina principal estará cerrada este jueves de 8:00 AM a 2:00 PM por limpieza profunda.',
      importante: true
    },
    {
      id: 'AV-102',
      titulo: 'Asamblea General Ordinaria de Condóminos',
      categoria: 'Administración',
      fecha: '2026-10-01',
      mensaje: 'Se les convoca a la reunión anual en el Salón Social el próximo 15 de Octubre a las 18:00 hrs.',
      importante: true
    },
    {
      id: 'AV-103',
      titulo: 'Recordatorio sobre horarios de recolección de basura',
      categoria: 'General',
      fecha: '2026-09-28',
      mensaje: 'Favor colocar sus contenedores antes de las 7:00 AM los días martes, jueves y sábados.',
      importante: false
    }
  ]);

  // Datos de prueba para Buzón de Quejas / Sugerencias (RF-11)
  const [quejas, setQuejas] = useState([
    {
      id: 'QJ-501',
      asunto: 'Ruido excesivo en casa 42',
      categoria: 'Seguridad',
      fecha: '2026-10-04',
      estado: 'En Proceso',
      descripcion: 'Fiesta con volumen muy alto fuera del horario permitido el fin de semana.'
    },
    {
      id: 'QJ-488',
      asunto: 'Fuga de agua en área verde central',
      categoria: 'Mantenimiento',
      fecha: '2026-09-20',
      estado: 'Resuelto',
      descripcion: 'Hay un aspersor roto botando agua en el parque infantil.'
    }
  ]);

  // Manejar inputs del formulario
  const handleChangeQueja = (e) => {
    setFormQueja({
      ...formQueja,
      [e.target.name]: e.target.value
    });
  };

  // Enviar nueva queja
  const handleSubmitQueja = (e) => {
    e.preventDefault();
    if (!formQueja.asunto || !formQueja.descripcion) return;

    const nuevaQueja = {
      id: `QJ-${Math.floor(1000 + Math.random() * 9000)}`,
      asunto: formQueja.asunto,
      categoria: formQueja.categoria,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'Pendiente',
      descripcion: formQueja.descripcion
    };

    setQuejas([nuevaQueja, ...quejas]);
    setFormQueja({
      asunto: '',
      categoria: 'Mantenimiento',
      descripcion: ''
    });

    alert('¡Tu reporte ha sido enviado a la administración con éxito!');
  };

  // Filtrar avisos por categoría
  const avisosFiltrados = categoriaFiltro === 'Todas' 
    ? avisos 
    : avisos.filter(a => a.categoria === categoriaFiltro);

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>🔔 Comunicaciones del Condominio</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Entérate de las novedades oficiales del residencial o envía tus inquietudes a la administración.
      </p>

      {/* Navegación de Pestañas Directa */}
      <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('avisos')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '15px',
            fontWeight: activeTab === 'avisos' ? 'bold' : 'normal',
            color: activeTab === 'avisos' ? '#007bff' : '#6c757d',
            borderBottom: activeTab === 'avisos' ? '3px solid #007bff' : '3px solid transparent',
            cursor: 'pointer'
          }}
        >
          📢 Avisos y Circulares
        </button>

        <button
          onClick={() => setActiveTab('quejas')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '15px',
            fontWeight: activeTab === 'quejas' ? 'bold' : 'normal',
            color: activeTab === 'quejas' ? '#007bff' : '#6c757d',
            borderBottom: activeTab === 'quejas' ? '3px solid #007bff' : '3px solid transparent',
            cursor: 'pointer'
          }}
        >
          ✍️ Buzón de Quejas y Sugerencias ({quejas.length})
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        {/* PESTAÑA 1: AVISOS GENERALES */}
        {activeTab === 'avisos' && (
          <div>
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: 'bold' }}>Filtrar por categoría:</label>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="Todas">Todas</option>
                <option value="Administración">Administración</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="General">General</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {avisosFiltrados.map((aviso) => (
                <div
                  key={aviso.id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderLeft: aviso.importante ? '5px solid #dc3545' : '5px solid #007bff',
                    borderRadius: '6px',
                    padding: '16px',
                    backgroundColor: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
                      {aviso.importante && <span style={{ color: '#dc3545', marginRight: '6px' }}>[IMPORTANTE]</span>}
                      {aviso.titulo}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#888' }}>{aviso.fecha}</span>
                  </div>
                  <p style={{ margin: '8px 0', color: '#555', lineHeight: '1.5' }}>{aviso.mensaje}</p>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '8px',
                      padding: '3px 8px',
                      fontSize: '12px',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '4px',
                      color: '#666'
                    }}
                  >
                    Categoría: {aviso.categoria}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: BUZÓN DE QUEJAS */}
        {activeTab === 'quejas' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
            {/* Formulario */}
            <div style={{ border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', backgroundColor: '#fff' }}>
              <h3 style={{ marginTop: 0 }}>Enviar Reporte o Sugerencia</h3>
              <form onSubmit={handleSubmitQueja}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Asunto *</label>
                  <input
                    type="text"
                    name="asunto"
                    value={formQueja.asunto}
                    onChange={handleChangeQueja}
                    placeholder="Ej. Luminaria fundida en calle B"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Categoría</label>
                  <select
                    name="categoria"
                    value={formQueja.categoria}
                    onChange={handleChangeQueja}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Seguridad">Seguridad</option>
                    <option value="Convivencia">Convivencia / Ruidos</option>
                    <option value="Sugerencia">Sugerencia General</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Detalle del Reporte *</label>
                  <textarea
                    name="descripcion"
                    rows="4"
                    value={formQueja.descripcion}
                    onChange={handleChangeQueja}
                    placeholder="Describe los detalles de la situación..."
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    width: '100%'
                  }}
                >
                  Enviar a Administración
                </button>
              </form>
            </div>

            {/* Historial de Reportes */}
            <div>
              <h3 style={{ marginTop: 0 }}>Mis Reportes Enviados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {quejas.map((q) => (
                  <div key={q.id} style={{ border: '1px solid #e0e0e0', padding: '12px', borderRadius: '6px', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px' }}>{q.asunto}</strong>
                      <StatusBadge status={q.estado} />
                    </div>
                    <p style={{ fontSize: '13px', color: '#666', margin: '6px 0' }}>{q.descripcion}</p>
                    <div style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Ticket: {q.id}</span>
                      <span>Fecha: {q.fecha}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}