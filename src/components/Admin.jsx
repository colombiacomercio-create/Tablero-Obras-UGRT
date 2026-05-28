import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { parseExcelToDB } from '../utils/excelParser';
import { UploadCloud, CheckCircle, AlertTriangle, Loader2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().split('T')[0]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'ugrt2026') {
      setIsAuthenticated(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setStatus('Iniciando...');
      setProgress(5);
      
      const { frentes, alertas } = await parseExcelToDB(file, setStatus);
      setProgress(30);
      
      setStatus(`Borrando datos anteriores...`);
      // Delete old records
      await supabase.from('frentes_obra').delete().neq('id', 0);
      await supabase.from('alertas_obra').delete().neq('id', 0);
      await supabase.from('metadatos').delete().neq('id', 0);
      
      setProgress(40);
      
      setStatus('Guardando Fecha de Corte...');
      await supabase.from('metadatos').insert([{ fecha_corte: fechaCorte }]);
      
      setStatus(`Insertando Frentes de Obra (${frentes.length})...`);
      
      // Insert in batches of 1000
      const BATCH_SIZE = 1000;
      for (let i = 0; i < frentes.length; i += BATCH_SIZE) {
        const batch = frentes.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('frentes_obra').insert(batch);
        if (insertError) throw insertError;
        
        const currentProgress = 40 + Math.floor(((i + BATCH_SIZE) / frentes.length) * 40);
        setProgress(Math.min(currentProgress, 80));
        setStatus(`Insertados ${Math.min(i + BATCH_SIZE, frentes.length)} de ${frentes.length} frentes...`);
      }
      
      setStatus(`Insertando Alertas (${alertas.length})...`);
      for (let i = 0; i < alertas.length; i += BATCH_SIZE) {
        const batch = alertas.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('alertas_obra').insert(batch);
        if (insertError) throw insertError;
      }
      
      setStatus('¡Actualización completada con éxito!');
      setProgress(100);
      setTimeout(() => {
        setIsUploading(false);
      }, 3000);
      
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
      setIsUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%' }}>
        <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '24px', color: 'white' }}>Acceso Administrador</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              type="password" 
              placeholder="Contraseña" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Ingresar</button>
          </form>
          <div style={{ marginTop: '20px' }}>
            <Link to="/" style={{ color: 'var(--text-secondary)' }}>Volver al Tablero</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ color: 'white' }}>Administración del Tablero UGRT</h1>
        <Link to="/" style={{ color: 'var(--primary)' }}>Ver Tablero Público →</Link>
      </div>
      
      <div className="glass-panel" style={{ padding: '40px' }}>
        <h2 style={{ marginBottom: '16px' }}>Actualización de Datos</h2>
        
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px' }}>Fecha de Corte del Archivo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar color="var(--primary)" />
            <input 
              type="date" 
              value={fechaCorte} 
              onChange={(e) => setFechaCorte(e.target.value)} 
              style={{ flex: 1, maxWidth: '200px' }}
              disabled={isUploading}
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Esta fecha se usará para calcular todos los vencimientos y días de atraso en el tablero público.
          </p>
        </div>
        
        {!isUploading && progress !== 100 && (
          <label className="upload-zone" style={{ display: 'block' }}>
            <UploadCloud size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
            <h3 style={{ color: 'white', marginBottom: '8px' }}>Haz clic o arrastra tu archivo Excel</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Solo archivos .xlsm o .xlsx</p>
            <input 
              type="file" 
              accept=".xlsx, .xls, .xlsm" 
              style={{ display: 'none' }} 
              onChange={onFileChange} 
            />
          </label>
        )}
        
        {isUploading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Loader2 size={48} color="var(--primary)" className="spin" style={{ animation: 'spin 2s linear infinite', marginBottom: '16px' }} />
            <h3 style={{ color: 'white', marginBottom: '16px' }}>{status}</h3>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }}></div>
            </div>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>{progress}%</p>
          </div>
        )}
        
        {progress === 100 && !isUploading && (
          <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', border: '1px solid var(--success)' }}>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '16px' }} />
            <h3 style={{ color: 'var(--success)', marginBottom: '8px' }}>¡Datos Sincronizados!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Frentes de obra, alertas y fecha de corte guardados correctamente.
            </p>
            <button onClick={() => setProgress(0)}>Subir otra actualización</button>
          </div>
        )}
        
      </div>
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
