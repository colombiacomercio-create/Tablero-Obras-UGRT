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

  let termSinCrono = 0;
  let termFuturo = 0;
  let subaTermMissing = 0;
  let subaProgMissing = 0;
  let termGlobals = 0;
  let suspGlobals = 0;

  filteredData.forEach(d => {
    const estado = d.estado ? String(d.estado).toUpperCase().trim() : '';
    const loc = d.localidad ? String(d.localidad).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
    let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
    const today = new Date();
    const inicio2026 = new Date(2026, 0, 1);
    
    if (estado === 'TERMINADO') {
      termGlobals++;
      if (!dFin) termSinCrono++;
      else if (dFin > today) termFuturo++;
      
      if (loc === 'SUBA') {
        const isProgCorte = dFin && dFin >= inicio2026 && dFin <= today;
        if (!isProgCorte) subaTermMissing++;
      }
    }
    
    if (estado === 'SUSPENDIDO') suspGlobals++;
  });

  console.log('Terminadas Totales:', termGlobals);
  console.log('Terminadas SIN CRONOGRAMA:', termSinCrono);
  console.log('Terminadas FUTURAS:', termFuturo);
  console.log('SUBA Terminadas q NO estaban en Prog a Corte:', subaTermMissing);
  console.log('Suspendidas Totales:', suspGlobals);
}
fetchAll();
