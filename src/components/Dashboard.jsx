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
    let terminadas = 0, suspendidas = 0, enEjecucion = 0, sinCronograma = 0;
    let universoCount = 0;
    let kmTerm = 0, m2Term = 0, mlTerm = 0;
    const terminadasCats = {};
    
    filteredData.forEach(d => {
      const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
      
      {
        universoCount++;
        
        if (estado === 'TERMINADO') {
          terminadas++;
          kmTerm += Number(d.km_carril) || 0;
          m2Term += Number(d.m2) || 0;
          mlTerm += Number(d.ml) || 0;
          
          let cat = d.categoria_inversion ? String(d.categoria_inversion).trim() : 'Otros';
          const catUpper = cat.toUpperCase();
          if (
            catUpper === 'EDIFICACIONES' || 
            catUpper === 'SIN CATEGORÍA' || 
            catUpper === 'SIN CATEGORIA' ||
            catUpper === 'BAHIA' ||
            catUpper === 'BAHÍAS' ||
            catUpper === 'CASA CULTURA' ||
            catUpper === 'PUENTES' ||
            catUpper.includes('MITIGACION') ||
            catUpper.includes('MITIGACIÓN')
          ) {
            cat = 'Otros';
          }
          terminadasCats[cat] = (terminadasCats[cat] || 0) + 1;
        }
        
        if (estado === 'SUSPENDIDO') suspendidas++;
        if (estado === 'EN EJECUCION' || estado === 'EN EJECUCIÓN') enEjecucion++;
        if (!d.crono_fin) sinCronograma++;
      }
    });

    // La meta es el universo completo filtrado (incluyendo vigencias anteriores y sin cronograma)
    const metaTotal = universoCount;
    const cumplimiento = metaTotal > 0 ? (terminadas / metaTotal) * 100 : 0;

    return {
      universoCount, metaTotal, terminadas, suspendidas, enEjecucion, sinCronograma,
      cumplimiento, kmTerm, m2Term, mlTerm, terminadasCats
    };
  }, [filteredData, localidadFilter]);

  // Alertas Stats
  const alertasStats = useMemo(() => {
    let totalObsTecnica = 0, totalObsJuridica = 0;
    let tecAcogidas = 0, jurAcogidas = 0;
    let tecParcial = 0, jurParcial = 0;
    const detallePendientes = [];
    
    filteredAlertas.forEach(a => {
      const valTec = a.observacion_tecnica ? String(a.observacion_tecnica).trim() : '';
      const valJur = a.observacion_juridica ? String(a.observacion_juridica).trim() : '';
      
      const hasTec = valTec.length > 0 && valTec !== '0' && valTec.toLowerCase() !== 'n/a';
      const hasJur = valJur.length > 0 && valJur !== '0' && valJur.toLowerCase() !== 'n/a';
      
      if (!hasTec && !hasJur) return; // Only process rows with valid observations

      const tec = a.acogio_tecnica ? String(a.acogio_tecnica).trim().toUpperCase() : '';
      const jur = a.acogio_juridica ? String(a.acogio_juridica).trim().toUpperCase() : '';

      let tienePendiente = false;
      let tipoPendiente = [];
      let obsPendiente = [];

      if (hasTec) {
        totalObsTecnica++;
        if (tec === 'SI' || tec === 'SÍ') tecAcogidas++;
        else if (tec === 'PARCIALMENTE') tecParcial++;
        else if (tec === 'NO') {
          tienePendiente = true;
          tipoPendiente.push('Técnica');
          obsPendiente.push(a.observacion_tecnica);
        }
      }

      if (hasJur) {
        totalObsJuridica++;
        if (jur === 'SI' || jur === 'SÍ') jurAcogidas++;
        else if (jur === 'PARCIALMENTE') jurParcial++;
        else if (jur === 'NO') {
          tienePendiente = true;
          tipoPendiente.push('Jurídica');
          obsPendiente.push(a.observacion_juridica);
        }
      }

      if (tienePendiente) {
        detallePendientes.push({
          localidad: a.localidad || 'Sin dato',
          contrato: a.contrato || a.numero_contrato || 'Sin contrato',
          tipo: tipoPendiente.join(' y '),
          obs: obsPendiente.join(' | ') || 'Sin observación específica'
        });
      }
    });
    
    const totalObservaciones = totalObsTecnica + totalObsJuridica;
    const totalAcogidas = tecAcogidas + jurAcogidas;
    const totalParciales = tecParcial + jurParcial;
    const pctAcogidas = totalObservaciones > 0 ? (totalAcogidas / totalObservaciones) * 100 : 0;
    
    return { totalObservaciones, tecAcogidas, jurAcogidas, tecParcial, jurParcial, totalAcogidas, totalParciales, pctAcogidas, detallePendientes };
  }, [filteredAlertas]);

  // Desglose Mensual (Sobre Nuevo Universo)
  const monthlyData = useMemo(() => {
    const dataByMonth = MONTHS.map((m, i) => ({ name: m, Programadas: 0, Terminadas: 0 }));
    
    filteredData.forEach(d => {
      const tc = d.tipo_contrato ? String(d.tipo_contrato).toUpperCase() : '';
      const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
      let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
      let dReal = d.fecha_real_fin ? new Date(d.fecha_real_fin) : null;
      
      let okTipo = (tc.includes('OBRA') || tc.includes('CONVENIO'));
      let okCronoFin = false;
      if (!d.crono_fin || (dFin && [2023, 2024, 2025, 2026].includes(dFin.getFullYear()))) okCronoFin = true;
      let okEstado = false;
      const validEstados = ['POR INICIAR', 'EN EJECUCION', 'EN EJECUCIÓN', 'SUSPENDIDO', 'TERMINADO'];
      if (!d.estado || validEstados.includes(estado)) okEstado = true;
      let okRealFin = false;
      if (!d.fecha_real_fin || (dReal && dReal.getFullYear() === 2026)) okRealFin = true;
      
      let esUniverso = okTipo && okCronoFin && okEstado && okRealFin;

      if (!esUniverso) return;
      
      // Programadas: Según mes de crono_fin (solo si es 2026 para la curva)
      if (dFin && dFin.getFullYear() === 2026) {
        dataByMonth[dFin.getMonth()].Programadas++;
      }
      
      // Terminadas: Según mes de fecha_real_fin (solo 2026)
      if (estado === 'TERMINADO') {
        if (dReal && dReal.getFullYear() === 2026) {
          dataByMonth[dReal.getMonth()].Terminadas++;
        } else if (!dReal && dFin && dFin.getFullYear() === 2026) {
          dataByMonth[dFin.getMonth()].Terminadas++;
        }
      }
    });

    return dataByMonth;
  }, [filteredData]);

  // Categoria Inversion
  const categoriaData = useMemo(() => {
    const cats = {};
    filteredData.forEach(d => {
      const tc = d.tipo_contrato ? String(d.tipo_contrato).toUpperCase() : '';
      const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
      let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
      let dReal = d.fecha_real_fin ? new Date(d.fecha_real_fin) : null;
      let okTipo = (tc.includes('OBRA') || tc.includes('CONVENIO'));
      let okCronoFin = false;
      if (!d.crono_fin || (dFin && [2023, 2024, 2025, 2026].includes(dFin.getFullYear()))) okCronoFin = true;
      let okEstado = false;
      const validEstados = ['POR INICIAR', 'EN EJECUCION', 'EN EJECUCIÓN', 'SUSPENDIDO', 'TERMINADO'];
      if (!d.estado || validEstados.includes(estado)) okEstado = true;
      let okRealFin = false;
      if (!d.fecha_real_fin || (dReal && dReal.getFullYear() === 2026)) okRealFin = true;
      
      let esUniverso = okTipo && okCronoFin && okEstado && okRealFin;

      if (!esUniverso) return;
      
      let cat = d.categoria_inversion ? String(d.categoria_inversion).trim() : 'Otros';
      const catUpper = cat.toUpperCase();
      if (
        catUpper === 'EDIFICACIONES' || 
        catUpper === 'SIN CATEGORÍA' || 
        catUpper === 'SIN CATEGORIA' ||
        catUpper === 'BAHIA' ||
        catUpper === 'BAHÍAS' ||
        catUpper === 'CASA CULTURA' ||
        catUpper === 'PUENTES' ||
        catUpper.includes('MITIGACION') ||
        catUpper.includes('MITIGACIÓN')
      ) {
        cat = 'Otros';
      }
      
      if (!cats[cat]) cats[cat] = 0;
      cats[cat]++;
    });

    const colors = ['#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12', '#422006'];
    
    return Object.entries(cats)
      .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Ranking IDC
  const rankingIDC = useMemo(() => {
    if (localidadFilter !== 'VISIÓN GLOBAL') return [];
    
    const locStats = {};
    const today = new Date(fechaCorte || Date.now());

    LOCALIDADES.forEach(loc => locStats[loc] = { loc, universoTotal: 0, progTotales: 0, termTotales: 0, progVencidas: 0, termVencidas: 0, susp: 0, atrasadas: 0 });

    filteredData.forEach(d => {
      const tc = d.tipo_contrato ? String(d.tipo_contrato).toUpperCase() : '';
      const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
      let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
      let dReal = d.fecha_real_fin ? new Date(d.fecha_real_fin) : null;
      
      let okTipo = (tc.includes('OBRA') || tc.includes('CONVENIO'));
      let okCronoFin = false;
      if (!d.crono_fin || (dFin && [2023, 2024, 2025, 2026].includes(dFin.getFullYear()))) okCronoFin = true;
      let okEstado = false;
      const validEstados = ['POR INICIAR', 'EN EJECUCION', 'EN EJECUCIÓN', 'SUSPENDIDO', 'TERMINADO'];
      if (!d.estado || validEstados.includes(estado)) okEstado = true;
      let okRealFin = false;
      if (!d.fecha_real_fin || (dReal && dReal.getFullYear() === 2026)) okRealFin = true;
      
      let esUniverso = okTipo && okCronoFin && okEstado && okRealFin;

      if (!esUniverso) return;
      if (!d.localidad || !locStats[d.localidad]) return;
      
      const st = locStats[d.localidad];
      st.universoTotal++;

      // Filtro para Programadas a corte: entre el 1 de enero de 2026 y la fecha_corte
      const inicio2026 = new Date(2026, 0, 1);
      const isProgCorte = dFin && dFin >= inicio2026 && dFin <= today;

      if (isProgCorte) {
        st.progTotales++;
        if (estado === 'TERMINADO') st.termTotales++;
      }

      if (estado === 'SUSPENDIDO') {
        st.susp++;
      }
    });

    return Object.values(locStats)
      .filter(st => st.progTotales > 0)
      .map(st => {
      st.vencidas = st.progTotales - st.termTotales;
      st.puntajeTotal = (st.termTotales / st.progTotales) * 100;
      return st;
    }).sort((a, b) => {
      if (a.puntajeTotal !== b.puntajeTotal) return b.puntajeTotal - a.puntajeTotal; // Mayor % es mejor
      if (a.termTotales !== b.termTotales) return b.termTotales - a.termTotales; // Mayor terminadas
      if (a.vencidas !== b.vencidas) return a.vencidas - b.vencidas; // Menor vencidas
      return a.susp - b.susp; // Menor suspendidas
    });
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
    const list = filteredData
      .filter(d => {
        const tc = d.tipo_contrato ? String(d.tipo_contrato).toUpperCase() : '';
        const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
        let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
        let dReal = d.fecha_real_fin ? new Date(d.fecha_real_fin) : null;
        let okTipo = (tc.includes('OBRA') || tc.includes('CONVENIO'));
        let okCronoFin = false;
        if (!d.crono_fin || (dFin && [2023, 2024, 2025, 2026].includes(dFin.getFullYear()))) okCronoFin = true;
        let okEstado = false;
        const validEstados = ['POR INICIAR', 'EN EJECUCION', 'EN EJECUCIÓN', 'SUSPENDIDO', 'TERMINADO'];
        if (!d.estado || validEstados.includes(estado)) okEstado = true;
        let okRealFin = false;
        if (!d.fecha_real_fin || (dReal && dReal.getFullYear() === 2026)) okRealFin = true;
        
        let esUniverso = okTipo && okCronoFin && okEstado && okRealFin;

        return esUniverso && estado === 'SUSPENDIDO';
      });

    // Agrupar por contrato
    const grouped = {};
    list.forEach(d => {
      const c = d.contrato || d.numero_contrato || d.id_frente || 'Sin contrato';
      if (!grouped[c]) {
        grouped[c] = { ...d, frentes_count: 1 };
      } else {
        grouped[c].frentes_count++;
      }
    });

    return Object.values(grouped).slice(0, 50);
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
          {Object.entries(stats.terminadasCats || {}).sort((a,b)=>b[1]-a[1]).map(([cat, val], idx) => (
            <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--surface-border)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>{cat}</span>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>{val}</div>
            </div>
          ))}
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Seguimiento de Frentes de Obra Locales</span>
            <span style={{ color: 'var(--primary)', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>Meta 2026: 1.700 Frentes</span>
          </p>
        </header>

        {/* Top KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--success)' }}>AVANCE FINALIZACIÓN OBRAS 2026</span>
            <div className="kpi-value success">{stats.terminadas} / {stats.metaTotal}</div>
            <div style={{ width: '100%', height: '6px', background: 'var(--surface-border)', borderRadius: '3px', marginTop: '8px' }}>
              <div style={{ width: `${Math.min(stats.cumplimiento, 100)}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }}></div>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>{stats.cumplimiento.toFixed(1)}% Cumplido</span>
          </div>

          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--primary)' }}>EN EJECUCIÓN</span>
            <div className="kpi-value" style={{ color: 'var(--primary)' }}>{stats.enEjecucion}</div>
          </div>

          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--danger)' }}>SUSPENDIDAS</span>
            <div className="kpi-value danger">{stats.suspendidas}</div>
            <span style={{ fontSize: '12px', color: 'var(--danger)', marginTop: 'auto', fontWeight: '500' }}>Atención Prioritaria</span>
          </div>

          <div className="glass-panel kpi-card">
            <span className="kpi-title" style={{ color: 'var(--text-primary)' }}>SIN CRONOGRAMA</span>
            <div className="kpi-value" style={{ fontSize: '28px' }}>{stats.sinCronograma}</div>
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
              <RechartsTooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} contentStyle={{ backgroundColor: '#111', color: '#fff', borderRadius: '8px', border: '1px solid #333', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)' }} itemStyle={{ color: '#fff' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px', fontWeight: '500' }}/>
              <Bar dataKey="Programadas" fill="var(--info)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Terminadas" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart: Categoría Inversión */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '24px' }}>
            Frentes de Obra por Categoría de Inversión
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart layout="vertical" data={categoriaData} margin={{ top: 10, right: 30, left: 100, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-border)" />
              <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={11} width={120} tick={{ fill: 'var(--text-secondary)' }} />
              <RechartsTooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} contentStyle={{ backgroundColor: '#111', color: '#fff', borderRadius: '8px', border: '1px solid #333', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)' }} itemStyle={{ color: '#fff' }} />
              <Bar dataKey="value" name="Frentes" radius={[0, 4, 4, 0]}>
                {categoriaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking IDC */}
        <div className="charts-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '32px' }}>
          {localidadFilter === 'VISIÓN GLOBAL' && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} color="var(--primary)"/> RANKING CUMPLIMIENTO 2026
                </h3>
              </div>
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Localidad</th>
                      <th style={{ textAlign: 'center' }}>Total Obras</th>
                      <th style={{ textAlign: 'center' }}>Prog. a corte</th>
                      <th style={{ textAlign: 'center' }}>Terminadas</th>
                      <th style={{ textAlign: 'center' }}>Suspendidas</th>
                      <th style={{ textAlign: 'center' }}>Vencidas</th>
                      <th style={{ textAlign: 'right' }}>% Cumplido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingIDC.map((r, idx) => (
                      <tr key={r.loc}>
                        <td style={{ fontWeight: 'bold', color: idx < 3 ? 'var(--primary)' : 'var(--text-secondary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: '500' }}>{r.loc}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{r.universoTotal}</td>
                        <td style={{ textAlign: 'center' }}>{r.progTotales}</td>
                        <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>{r.termTotales}</td>
                        <td style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 'bold' }}>{r.susp}</td>
                        <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 'bold' }}>{r.vencidas}</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '14px' }}>
                          {r.puntajeTotal.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.03)', borderTop: '1px solid var(--surface-border)' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  El ranking se calcula como el porcentaje de obras Terminadas frente a las Programadas a Corte. Una localidad obtiene mejor posición cuando su % de cumplimiento es mayor. En caso de empate, la tabla prioriza a las localidades con mayor número de terminadas, menos vencidas y menos suspendidas.
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
                    <th>Contrato (Frentes)</th>
                    <th>Justificación</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {suspendidasList.length > 0 ? suspendidasList.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: '500' }}>{d.localidad}</td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{d.contrato || d.numero_contrato || 'Sin contrato'}</strong>
                        {d.frentes_count > 1 && <span style={{ marginLeft: '6px', fontSize: '11px', background: 'var(--surface-border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>({d.frentes_count} frentes)</span>}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.justificacion_suspension || 'Sin justificación registrada'}</td>
                      <td style={{ fontSize: '12px' }}>{d.fecha_suspension || 'N/A'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>No hay obras suspendidas</td></tr>
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
              <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--info)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--info)', fontWeight: '600', fontSize: '13px' }}>Total Observaciones</span>
                  <span style={{ color: 'var(--info)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.totalObservaciones}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Suma de observaciones G y H</div>
              </div>

              <div style={{ flex: 1, background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '13px' }}>Técnicas (G)</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.tecAcogidas}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{alertasStats.tecParcial} acogidas parcialmente</div>
              </div>

              <div style={{ flex: 1, background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--primary-dark)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--primary-dark)', fontWeight: '600', fontSize: '13px' }}>Jurídicas (H)</span>
                  <span style={{ color: 'var(--primary-dark)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.jurAcogidas}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{alertasStats.jurParcial} acogidas parcialmente</div>
              </div>

              <div style={{ flex: 1, background: 'rgba(251, 191, 36, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '13px' }}>% Rec. Acogidas</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '16px' }}>{alertasStats.pctAcogidas.toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>
                  {alertasStats.totalAcogidas} acogidas de {alertasStats.totalObservaciones}
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
                    <th>Tipo Observación Pendiente (Técnica o Jurídica)</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasStats.detallePendientes.map((al, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{al.localidad}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{al.contrato}</td>
                      <td style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 'bold' }}>{al.tipo}</td>
                    </tr>
                  ))}
                  {alertasStats.detallePendientes.length === 0 && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '24px' }}>No hay alertas de Mesa Técnica o Jurídica</td></tr>
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






