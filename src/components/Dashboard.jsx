import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Clock, MapPin, Search, Calendar as CalendarIcon, TrendingDown, Target, Hammer, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';

const LOCALIDADES = [
  "ANTONIO NARIÑO", "BARRIOS UNIDOS", "BOSA", "CANDELARIA", "CHAPINERO", 
  "CIUDAD BOLÍVAR", "ENGATIVÁ", "FONTIBÓN", "KENNEDY", "LOS MÁRTIRES", 
  "PUENTE ARANDA", "RAFAEL URIBE URIBE", "SAN CRISTÓBAL", "SANTA FE", 
  "SUBA", "SUMAPAZ", "TEUSAQUILLO", "TUNJUELITO", "USAQUÉN", "USME"
];

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [fechaCorte, setFechaCorte] = useState('');
  const [loading, setLoading] = useState(true);
  const [localidadFilter, setLocalidadFilter] = useState('VISIÓN GLOBAL');
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: meta } = await supabase.from('metadatos').select('*').limit(1);
      if (meta && meta.length > 0) {
        setFechaCorte(meta[0].fecha_corte);
      } else {
        setFechaCorte(new Date().toISOString().split('T')[0]);
      }

      let allData = [];
      let fetchMore = true;
      let from = 0;
      let to = 999;
      while (fetchMore) {
        const { data: frentes } = await supabase.from('frentes_obra').select('*').range(from, to);
        if (frentes && frentes.length > 0) {
          allData = [...allData, ...frentes];
          if (frentes.length < 1000) fetchMore = false;
          else { from += 1000; to += 1000; }
        } else {
          fetchMore = false;
        }
      }
      setData(allData);

      let allAlertas = [];
      fetchMore = true;
      from = 0;
      to = 999;
      while (fetchMore) {
        const { data: al } = await supabase.from('alertas_obra').select('*').range(from, to);
        if (al && al.length > 0) {
          allAlertas = [...allAlertas, ...al];
          if (al.length < 1000) fetchMore = false;
          else { from += 1000; to += 1000; }
        } else {
          fetchMore = false;
        }
      }
      setAlertas(allAlertas);

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtro base: descartar consultorías y estudios
  const esIntervencionValida = (d) => {
    const tipo = d.tipo_intervencion ? String(d.tipo_intervencion).toUpperCase() : '';
    if (tipo === 'CONSULTORÍA' || tipo === 'ESTUDIOS Y DISEÑOS' || tipo.includes('MAQUINARIA')) return false;
    return true;
  };

  const filteredData = useMemo(() => {
    const validData = data.filter(esIntervencionValida);
    if (localidadFilter === 'VISIÓN GLOBAL') return validData;
    return validData.filter(d => d.localidad === localidadFilter);
  }, [data, localidadFilter]);

  const filteredAlertas = useMemo(() => {
    if (localidadFilter === 'VISIÓN GLOBAL') return alertas;
    return alertas.filter(a => a.localidad === localidadFilter);
  }, [alertas, localidadFilter]);

  // Main KPIs (Paridad Matemática 1:1 con Excel)
  const stats = useMemo(() => {
    let terminadas = 0, suspendidas = 0, incumplimiento = 0, programadas = 0;
    let kmTerm = 0, m2Term = 0, mlTerm = 0, huecosTerm = 0;
    let valorProg2026 = 0, valorTerm2026 = 0;

    filteredData.forEach(d => {
      const estado = d.estado ? String(d.estado).toUpperCase() : '';
      const val = Number(d.valor_final) || 0; // Valor de la intervención
      
      let es2026 = false;
      if (d.crono_fin) {
        const dFin = new Date(d.crono_fin);
        if (dFin.getFullYear() === 2026) es2026 = true;
      } else if (d.crono_inicio) {
        const dIni = new Date(d.crono_inicio);
        if (dIni.getFullYear() === 2026) es2026 = true;
      }

      // 1. SUSPENDIDAS e INCUMPLIMIENTOS
      if (estado === 'SUSPENDIDO') suspendidas++;
      if (estado === 'INCUMPLIMIENTO') incumplimiento++;
      
      // Universo 2026
      if (es2026) {
        programadas++;
        valorProg2026 += val;
        
        if (estado === 'TERMINADO') {
          terminadas++;
          valorTerm2026 += val;
          kmTerm += Number(d.km_carril) || 0;
          m2Term += Number(d.m2) || 0;
          mlTerm += Number(d.ml) || 0;
          huecosTerm += Number(d.huecos) || 0;
        }
      }
    });

    const cumplimiento = programadas > 0 ? (terminadas / programadas) * 100 : 0;
    const pctFinanciero = valorProg2026 > 0 ? (valorTerm2026 / valorProg2026) * 100 : 0;

    return {
      programadas, terminadas, suspendidas, incumplimiento,
      cumplimiento, kmTerm, m2Term, mlTerm, huecosTerm, 
      valorTerm: valorTerm2026, valorTotalProg: valorProg2026, pctFinanciero
    };
  }, [filteredData, localidadFilter]);

  // Alertas Stats
  const alertasStats = useMemo(() => {
    let noAcogeTec = 0, noAcogeJur = 0;
    let totalRecomendaciones = 0, totalAcogidas = 0;
    const detallePendientes = [];
    
    filteredAlertas.forEach(a => {
      const tec = a.acogio_tecnica ? String(a.acogio_tecnica).trim().toUpperCase() : '';
      const jur = a.acogio_juridica ? String(a.acogio_juridica).trim().toUpperCase() : '';

      // KPI Global de Recomendaciones
      if (tec !== '') {
        totalRecomendaciones++;
        if (tec === 'SI' || tec === 'SÍ') totalAcogidas++;
      }
      if (jur !== '') {
        totalRecomendaciones++;
        if (jur === 'SI' || jur === 'SÍ') totalAcogidas++;
      }

      let tienePendiente = false;
      let tipoPendiente = [];
      let obsPendiente = [];

      if (tec === 'NO') {
        noAcogeTec++;
        tienePendiente = true;
        tipoPendiente.push('Técnica');
        if (a.observacion_tecnica) obsPendiente.push(a.observacion_tecnica);
      }
      if (jur === 'NO') {
        noAcogeJur++;
        tienePendiente = true;
        tipoPendiente.push('Jurídica');
        if (a.observacion_juridica) obsPendiente.push(a.observacion_juridica);
      }

      if (tienePendiente) {
        detallePendientes.push({
          localidad: a.localidad || 'Sin dato',
          contrato: a.contrato || 'Sin contrato',
          tipo: tipoPendiente.join(' y '),
          obs: obsPendiente.join(' | ') || 'Sin observación específica'
        });
      }
    });
    
    const pctAcogidas = totalRecomendaciones > 0 ? (totalAcogidas / totalRecomendaciones) * 100 : 0;
    
    return { noAcogeTec, noAcogeJur, totalRecomendaciones, totalAcogidas, pctAcogidas, detallePendientes };
  }, [filteredAlertas]);

  // Desglose Mensual 2026 (Solo valores no acumulados, sobre Universo 2026)
  const monthlyData = useMemo(() => {
    const dataByMonth = MONTHS.map((m, i) => ({ name: m, Programadas: 0, Terminadas: 0 }));
    
    filteredData.forEach(d => {
      let es2026 = false;
      let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
      if (dFin && dFin.getFullYear() === 2026) es2026 = true;

      if (!es2026) return;

      const estado = d.estado ? String(d.estado).toUpperCase() : '';
      
      // Programadas: Según mes de crono_fin
      if (dFin) {
        dataByMonth[dFin.getMonth()].Programadas++;
      }
      
      // Terminadas: Según mes de fecha_real_fin
      if (estado === 'TERMINADO') {
        const dReal = d.fecha_real_fin ? new Date(d.fecha_real_fin) : null;
        // Solo sumamos en la curva a las que tienen fecha real en 2026 (o las imputamos a su mes programado si no hay real, pero ideal real)
        if (dReal && dReal.getFullYear() === 2026) {
          dataByMonth[dReal.getMonth()].Terminadas++;
        } else if (!dReal && dFin) {
          // Si no tiene fecha real pero está terminada, la asumo en el mes programado
          dataByMonth[dFin.getMonth()].Terminadas++;
        }
      }
    });

    return dataByMonth;
  }, [filteredData]);

  // Ranking IDC (Solo sobre Universo 2026)
  const rankingIDC = useMemo(() => {
    if (localidadFilter !== 'VISIÓN GLOBAL') return [];
    
    const locStats = {};
    const today = new Date(fechaCorte || Date.now());

    LOCALIDADES.forEach(loc => locStats[loc] = { loc, progTotales: 0, termTotales: 0, progVencidas: 0, termVencidas: 0, susp: 0, atrasadas: 0 });

    filteredData.forEach(d => {
      let es2026 = false;
      let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
      if (dFin && dFin.getFullYear() === 2026) es2026 = true;
      else if (d.crono_inicio) {
        const dIni = new Date(d.crono_inicio);
        if (dIni.getFullYear() === 2026) es2026 = true;
      }

      if (!es2026) return; // Solo universo 2026
      if (!d.localidad || !locStats[d.localidad]) return;
      
      const estado = d.estado ? String(d.estado).toUpperCase() : '';
      const st = locStats[d.localidad];

      st.progTotales++;
      if (estado === 'TERMINADO') st.termTotales++;

      if (estado === 'SUSPENDIDO') st.susp++;

      if (dFin && dFin <= today) {
        st.progVencidas++;
        if (estado === 'TERMINADO') st.termVencidas++;
        else st.atrasadas++;
      }
    });

    return Object.values(locStats).map(st => {
      const pctTerm = st.progVencidas > 0 ? (st.termVencidas / st.progVencidas) * 100 : 0;
      const pctSusp = st.progVencidas > 0 ? (st.susp / st.progVencidas) : 0;
      const pctAtraso = st.progVencidas > 0 ? (st.atrasadas / st.progVencidas) : 0;
      
      let idc = pctTerm - (pctSusp * 30) - (pctAtraso * 15);
      idc = Math.max(0, Math.min(100, idc));
      
      return { ...st, idc, pctTerm };
    }).sort((a, b) => b.idc - a.idc);
  }, [filteredData, fechaCorte, localidadFilter]);

  // Top 50 Próximas Entregas (Solo Universo 2026, Avance > 60% y < 99%)
  const proximasEntregas = useMemo(() => {
    return filteredData
      .filter(d => {
        const est = d.estado ? String(d.estado).toUpperCase() : '';
        let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
        const es2026 = dFin && dFin.getFullYear() === 2026;
        const avance = Number(d.porcentaje_avance) || 0;
        
        return (est === 'EN EJECUCIÓN' || est === 'EN EJECUCION') && es2026 && avance > 0.60 && avance < 0.99;
      })
      .sort((a, b) => new Date(a.crono_fin) - new Date(b.crono_fin))
      .slice(0, 50);
  }, [filteredData]);

  // Top 50 Entregadas Recientemente (Solo Universo 2026)
  const entregadasRecientes = useMemo(() => {
    return filteredData
      .filter(d => {
        const est = d.estado ? String(d.estado).toUpperCase() : '';
        let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
        const es2026 = dFin && dFin.getFullYear() === 2026;
        
        return est === 'TERMINADO' && es2026 && d.fecha_real_fin;
      })
      .sort((a, b) => new Date(b.fecha_real_fin) - new Date(a.fecha_real_fin))
      .slice(0, 50);
  }, [filteredData]);

  // Tabla Suspendidas
  const suspendidasList = useMemo(() => {
    return filteredData
      .filter(d => {
        const est = d.estado ? String(d.estado).toUpperCase() : '';
        return est === 'SUSPENDIDO';
      })
      .slice(0, 50);
  }, [filteredData]);

  const formatCurrency = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  const formatNum = (val) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(val);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%' }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>Cargando datos desde la nube...</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <div className="sidebar" style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo_SDG_2.png" alt="Alcaldía Mayor de Bogotá" style={{ maxWidth: '140px', height: 'auto', marginBottom: '16px' }} />
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '4px', fontSize: '18px' }}>UGRT Bogotá</h1>
          <p style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 'bold', margin: '4px 0' }}>Unidad de Transformación</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>Secretaría Distrital de Gobierno</p>
        </div>
        
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Fecha de Corte
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.05)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
            <CalendarIcon size={16} color="var(--primary)" />
            <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px' }}>{fechaCorte || 'Automática'}</span>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Filtrar Localidad
          </label>
          <div style={{ position: 'relative' }}>
            <MapPin size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <select value={localidadFilter} onChange={(e) => setLocalidadFilter(e.target.value)} style={{ paddingLeft: '36px', fontWeight: '500' }}>
              <option value="VISIÓN GLOBAL">🌎 Visión Global</option>
              {LOCALIDADES.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
        </div>

        {/* Físicas KPIs Sidebar (Solo Terminadas) */}
        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', borderBottom: '2px solid var(--primary)', paddingBottom: '4px', display: 'inline-block' }}>
            Cifras Físicas (Terminadas 2026)
          </h3>
          
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Km-Carril Terminados</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{formatNum(stats.kmTerm)} <span style={{ fontSize: '12px' }}>km</span></div>
          </div>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>M² Intervenidos</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{formatNum(stats.m2Term)} <span style={{ fontSize: '12px' }}>m²</span></div>
          </div>
          
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Huecos Tapados</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>{formatNum(stats.huecosTerm)}</div>
          </div>

          <div style={{ background: 'rgba(220, 38, 38, 0.1)', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 'bold', textTransform: 'uppercase' }}>Valor Ejecutado</span>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--danger)' }}>{formatCurrency(stats.valorTerm)}</div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, fontWeight: '500' }}>{stats.programadas} frentes programados 2026</p>
          </div>
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Link to="/admin" style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>Acceso Administrador →</Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '26px', marginBottom: '4px', letterSpacing: '-0.5px' }}>
            {localidadFilter === 'VISIÓN GLOBAL' ? 'TABLERO DE CONTROL 2026' : `TABLERO DE OBRAS: ${localidadFilter}`}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Seguimiento de Frentes de Obra Locales | Meta 2026: 1.700 Frentes
          </p>
        </header>

        {/* Top KPIs (Distritales) */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--success)' }}>META 2026</span>
            <div className="kpi-value success">{stats.terminadas} / {stats.programadas}</div>
            <div style={{ width: '100%', height: '6px', background: 'var(--surface-border)', borderRadius: '3px', marginTop: '8px' }}>
              <div style={{ width: `${Math.min(stats.cumplimiento, 100)}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }}></div>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>{stats.cumplimiento.toFixed(1)}% Cumplido</span>
          </div>

          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--danger)' }}>SUSPENDIDAS</span>
            <div className="kpi-value danger">{stats.suspendidas}</div>
            <span style={{ fontSize: '12px', color: 'var(--danger)', marginTop: 'auto', fontWeight: '500' }}>Atención Prioritaria</span>
          </div>

          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--text-primary)' }}>% VALOR EJECUTADO (2026)</span>
            <div className="kpi-value" style={{ fontSize: '28px' }}>{stats.pctFinanciero.toFixed(1)}%</div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 'auto' }}>
              De {formatCurrency(stats.valorTotalProg)} programado en la meta
            </span>
          </div>
        </div>

        {/* Chart: Curva de Avance */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '24px' }}>
            Matriz Mensual 2026 - Programado vs Terminado (Valores del Mes)
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px', fontWeight: '500' }}/>
              <Bar dataKey="Programadas" fill="var(--info)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Terminadas" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking IDC */}
        <div className="charts-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '32px' }}>
          {localidadFilter === 'VISIÓN GLOBAL' && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} color="var(--primary)"/> RANKING 1: DESEMPEÑO COMPUESTO (IDC) SOBRE META 2026
                </h3>
              </div>
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Localidad</th>
                      <th style={{ textAlign: 'center' }}>Prog. Totales</th>
                      <th style={{ textAlign: 'center' }}>Terminadas</th>
                      <th style={{ textAlign: 'center' }}>Vencidas</th>
                      <th style={{ textAlign: 'right' }}>IDC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingIDC.map((r, idx) => (
                      <tr key={r.loc}>
                        <td style={{ fontWeight: 'bold', color: idx < 3 ? 'var(--primary)' : 'var(--text-secondary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: '500' }}>{r.loc}</td>
                        <td style={{ textAlign: 'center' }}>{r.progTotales}</td>
                        <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>{r.termTotales}</td>
                        <td style={{ textAlign: 'center', color: 'var(--danger)' }}>{r.progVencidas}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <span style={{ 
                              fontWeight: 'bold',
                              color: r.idc >= 70 ? '#059669' : (r.idc >= 40 ? '#d97706' : '#dc2626')
                            }}>
                              {r.idc.toFixed(1)}
                            </span>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.idc >= 70 ? '#10b981' : (r.idc >= 40 ? '#f59e0b' : '#ef4444') }}></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.03)', borderTop: '1px solid var(--surface-border)' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <strong>Cálculo del IDC (Índice de Desempeño Compuesto):</strong> Asigna puntajes de 0 a 100 evaluando las obras que ya superaron su fecha de fin. 
                  Fórmula: <code style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 4px', borderRadius: '4px' }}>% Terminadas - (Castigo Suspendidas × 30) - (Castigo Atrasadas × 15)</code>
                </p>
              </div>
            </div>
          )}

          {/* Obras Suspendidas */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--surface-border)' }}>
              <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="var(--danger)"/> OBRAS SUSPENDIDAS (DETALLE)
              </h3>
            </div>
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ minWidth: '400px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Localidad</th>
                    <th>Contrato / Frente</th>
                  </tr>
                </thead>
                <tbody>
                  {suspendidasList.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '11px', fontWeight: 'bold' }}>{r.localidad}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.contrato}</td>
                    </tr>
                  ))}
                  {suspendidasList.length === 0 && (
                    <tr><td colSpan="2" style={{ textAlign: 'center', padding: '24px' }}>No hay obras suspendidas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 50 Próximas vs 50 Entregadas Recientemente */}
        <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '32px' }}>
          
          {/* Próximas Entregas */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--surface-border)' }}>
              <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--info)"/> TOP 50: PRÓXIMAS ENTREGAS
              </h3>
            </div>
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ minWidth: '600px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Localidad</th>
                    <th>Tipo Intervención</th>
                    <th>Contrato / Frente</th>
                    <th style={{ textAlign: 'center' }}>% Avance</th>
                    <th style={{ textAlign: 'right' }}>Fecha Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {proximasEntregas.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '11px', fontWeight: 'bold' }}>{r.localidad}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.tipo_intervencion?.substring(0, 20)}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.contrato?.substring(0, 20)}...</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--info)' }}>{(Number(r.porcentaje_avance)*100).toFixed(0)}%</td>
                      <td style={{ textAlign: 'right', fontWeight: '500', fontSize: '12px' }}>{r.crono_fin}</td>
                    </tr>
                  ))}
                  {proximasEntregas.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No hay obras en ejecución con cronograma</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Entregadas Recientemente */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--surface-border)' }}>
              <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--success)"/> TOP 50: ENTREGADAS RECIENTEMENTE
              </h3>
            </div>
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ minWidth: '600px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Localidad</th>
                    <th>Tipo Intervención</th>
                    <th>Contrato / Frente</th>
                    <th style={{ textAlign: 'center' }}>Km-Carril</th>
                    <th style={{ textAlign: 'right' }}>Fecha Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {entregadasRecientes.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '11px', fontWeight: 'bold' }}>{r.localidad}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.tipo_intervencion?.substring(0, 20)}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.contrato?.substring(0, 20)}...</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--success)' }}>{Number(r.km_carril).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '500', fontSize: '12px' }}>{r.fecha_real_fin}</td>
                    </tr>
                  ))}
                  {entregadasRecientes.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No hay obras terminadas con fecha real</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Alertas (Movidas a la parte inferior) */}
        <div className="glass-panel" style={{ padding: '0', gridColumn: '1 / -1' }}>
          <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--surface-border)' }}>
            <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="var(--warning-text)"/> ALERTAS MESA TÉCNICA Y JURÍDICA (DETALLE)
            </h3>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              <div style={{ flex: 1, background: 'rgba(220, 38, 38, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: '600', fontSize: '13px' }}>No acogen Rec. Técnica</span>
                  <span style={{ color: 'var(--danger)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.noAcogeTec}</span>
                </div>
              </div>

              <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--warning-text)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '13px' }}>No acogen Rec. Jurídica</span>
                  <span style={{ color: 'var(--warning-text)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.noAcogeJur}</span>
                </div>
              </div>

              <div style={{ flex: 1, background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '13px' }}>% Rec. Acogidas Global</span>
                  <span style={{ color: 'var(--primary-dark)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.pctAcogidas.toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>
                  {alertasStats.totalAcogidas} acogidas de {alertasStats.totalRecomendaciones} registradas
                </div>
              </div>
            </div>

            {/* Tabla de Detalle de Alertas */}
            <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Localidad</th>
                    <th>Contrato</th>
                    <th>Tipo Observación</th>
                    <th>Observación Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasStats.detallePendientes.map((al, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{al.localidad}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{al.contrato}</td>
                      <td style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 'bold' }}>{al.tipo}</td>
                      <td style={{ fontSize: '11px' }}>{al.obs}</td>
                    </tr>
                  ))}
                  {alertasStats.detallePendientes.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>No hay alertas activas de Mesa Técnica o Jurídica</td></tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}


