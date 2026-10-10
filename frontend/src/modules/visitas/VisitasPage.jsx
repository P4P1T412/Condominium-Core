import React, { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';

export default function VisitasPage() {
  const [activeTab, setActiveTab] = useState('registro');

  // Estado para el formulario de visitas
  const [formVisita, setFormVisita] = useState({
    nombreVisitante: '',
    dpi: '',
    placa: '',
    fechaVisita: ''
  });

  // Datos de prueba para el historial de visitas
  const [visitas, setVisitas] = useState([
    {
      codigo: 'QR-2792',
      visitante: 'Juan',
      dpi: '2307766390403',
      placa: 'p-230kcv',
      fecha: '2026-10-21',
      estado: 'Pendiente'
    },
    {
      codigo: 'QR-8801',
      visitante: 'Carlos Mendoza',
      dpi: '2456 78901 0101',
      placa: 'P-452GHT',
      fecha: '2026-10-09',
      estado: 'Pendiente'
    },
    {
      codigo: 'QR-8750',
      visitante: 'María Fernández',
      dpi: '1987 65432 0101',
      placa: 'M-110BKR',
      fecha: '2026-10-05',
      estado: 'Ingresado'
    }
  ]);

  const handleChange = (e) => {
    setFormVisita({
      ...formVisita,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formVisita.nombreVisitante || !formVisita.fechaVisita) return;

    const nuevaVisita = {
      codigo: `QR-${Math.floor(1000 + Math.random() * 9000)}`,
      visitante: formVisita.nombreVisitante,
      dpi: formVisita.dpi || 'N/A',
      placa: formVisita.placa || 'N/A',
      fecha: formVisita.fechaVisita,
      estado: 'Pendiente'
    };

    // Agregar la nueva visita al inicio de la lista
    setVisitas([nuevaVisita, ...visitas]);

    // Limpiar campos del formulario
    setFormVisita({
      nombreVisitante: '',
      dpi: '',
      placa: '',
      fechaVisita: ''
    });

    alert(`¡Pase generado con éxito! Código: ${nuevaVisita.codigo}`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>🚗 Mis Visitas</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Registra visitantes con anticipación para agilizar su ingreso en garita y consulta tus pases emitidos.
      </p>

      {/* Navegación de Pestañas Directa */}
      <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('registro')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '15px',
            fontWeight: activeTab === 'registro' ? 'bold' : 'normal',
            color: activeTab === 'registro' ? '#007bff' : '#6c757d',
            borderBottom: activeTab === 'registro' ? '3px solid #007bff' : '3px solid transparent',
            cursor: 'pointer'
          }}
        >
          Registrar Visita Anticipada
        </button>

        <button
          onClick={() => setActiveTab('historial')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            fontSize: '15px',
            fontWeight: activeTab === 'historial' ? 'bold' : 'normal',
            color: activeTab === 'historial' ? '#007bff' : '#6c757d',
            borderBottom: activeTab === 'historial' ? '3px solid #007bff' : '3px solid transparent',
            cursor: 'pointer'
          }}
        >
          Historial y Pases de Entrada ({visitas.length})
        </button>
      </div>

      {/* PESTAÑA 1: FORMULARIO */}
      {activeTab === 'registro' && (
        <div style={{ border: '1px solid #e0e0e0', padding: '24px', borderRadius: '8px', backgroundColor: '#fff', maxWidth: '600px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Generar Pase de Entrada Anticipado</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Nombre Completo del Visitante *</label>
              <input
                type="text"
                name="nombreVisitante"
                value={formVisita.nombreVisitante}
                onChange={handleChange}
                placeholder="Ej. Juan Pérez"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>DPI / Documento de Identidad</label>
              <input
                type="text"
                name="dpi"
                value={formVisita.dpi}
                onChange={handleChange}
                placeholder="Ej. 2307 76639 0403"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Placa de Vehículo (Opcional)</label>
              <input
                type="text"
                name="placa"
                value={formVisita.placa}
                onChange={handleChange}
                placeholder="Ej. P-230KCV"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Fecha Programada de Visita *</label>
              <input
                type="date"
                name="fechaVisita"
                value={formVisita.fechaVisita}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                required
              />
            </div>

            <button
              type="submit"
              style={{
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              Generar Pase Pre-autorizado
            </button>
          </form>
        </div>
      )}

      {/* PESTAÑA 2: HISTORIAL DE VISITAS */}
      {activeTab === 'historial' && (
        <div style={{ border: '1px solid #e0e0e0', padding: '20px', borderRadius: '8px', backgroundColor: '#fff' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Listado de Visitas Programadas e Historial</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px' }}>Código</th>
                <th style={{ padding: '12px' }}>Visitante</th>
                <th style={{ padding: '12px' }}>DPI</th>
                <th style={{ padding: '12px' }}>Placa</th>
                <th style={{ padding: '12px' }}>Fecha</th>
                <th style={{ padding: '12px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map((v) => (
                <tr key={v.codigo} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#007bff' }}>{v.codigo}</td>
                  <td style={{ padding: '12px' }}>{v.visitante}</td>
                  <td style={{ padding: '12px' }}>{v.dpi}</td>
                  <td style={{ padding: '12px' }}>{v.placa}</td>
                  <td style={{ padding: '12px' }}>{v.fecha}</td>
                  <td style={{ padding: '12px' }}>
                    <StatusBadge status={v.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}