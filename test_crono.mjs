const url = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/frentes_obra?select=*';
const headers = { 'apikey': 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ', 'Authorization': 'Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ' };

async function fetchAll() {
  let all = []; let from = 0; let more = true;
  while(more) {
    const res = await fetch(url, { headers: { ...headers, 'Range': from + '-' + (from+999) } });
    const data = await res.json();
    if(data.length > 0) { all = all.concat(data); if(data.length < 1000) more = false; else from += 1000; } else more = false;
  }
  
  const filteredData = all.filter(d => {
    const tc = d.tipo_contrato ? String(d.tipo_contrato).toUpperCase() : '';
    const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
    const tipoInt = d.tipo_intervencion ? String(d.tipo_intervencion).toUpperCase().trim() : '';
    
    let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
    let dReal = d.fecha_real_fin ? new Date(d.fecha_real_fin) : null;
    
    let okTipo = (tc.includes('OBRA') || tc.includes('CONVENIO'));
    let okIntervencion = !tipoInt.includes('ESTUDIOS');
    let okCronoFin = !dFin || dFin.getFullYear() !== 2027;
    let okEstado = estado !== 'INCUMPLIMIENTO' && estado !== 'NO EJECUTADO';
    let okRealFin = !d.fecha_real_fin || (dReal && dReal.getFullYear() === 2026);
    
    return okTipo && okIntervencion && okCronoFin && okEstado && okRealFin;
  });

  let sinCrono1 = 0;
  let sinCrono2 = 0;
  let subaTerm = 0;
  let subaProg = 0;

  filteredData.forEach(d => {
    if (!d.crono_fin) sinCrono1++;
    
    const dFinStr = d.crono_fin ? String(d.crono_fin).trim() : '';
    if (!dFinStr || dFinStr === '0' || dFinStr.includes('1899') || dFinStr.toLowerCase() === 'no tiene' || dFinStr === '') {
      sinCrono2++;
    }

    const loc = d.localidad ? String(d.localidad).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
    if (loc === 'SUBA') {
      const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
      let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
      const today = new Date();
      const inicio2026 = new Date(2026, 0, 1);
      const isProgCorte = dFin && dFin >= inicio2026 && dFin <= today;
      
      if (isProgCorte) subaProg++;
      if (isProgCorte && estado === 'TERMINADO') subaTerm++;
    }
  });

  console.log('Universo:', filteredData.length);
  console.log('Sin Cronograma (!d.crono_fin):', sinCrono1);
  console.log('Sin Cronograma (vacio/nulo):', sinCrono2);
  console.log('SUBA Prog (solo en rango):', subaProg);
  console.log('SUBA Term (solo en rango):', subaTerm);
}
fetchAll();
