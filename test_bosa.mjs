const url = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/alertas_obra?select=*';
const headers = { 'apikey': 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ', 'Authorization': 'Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ' };

async function fetchAll() {
  let all = []; let from = 0; let more = true;
  while(more) {
    const res = await fetch(url, { headers: { ...headers, 'Range': from + '-' + (from+999) } });
    const data = await res.json();
    if(data.length > 0) { all = all.concat(data); if(data.length < 1000) more = false; else from += 1000; } else more = false;
  }
  
  const bosaAlertas = all.filter(a => a.localidad && a.localidad.toUpperCase().includes('BOSA'));
  
  let tecValid = 0;
  let jurValid = 0;
  let totalBosa = 0;
  let acogidas = 0;
  let parciales = 0;
  let pendientes = 0;

  bosaAlertas.forEach(a => {
    const valTec = a.observacion_tecnica ? String(a.observacion_tecnica).trim() : '';
    const valJur = a.observacion_juridica ? String(a.observacion_juridica).trim() : '';
    const hasTec = valTec.length > 0 && valTec !== '0' && valTec.toLowerCase() !== 'n/a';
    const hasJur = valJur.length > 0 && valJur !== '0' && valJur.toLowerCase() !== 'n/a';
    
    if (!hasTec && !hasJur) return;
    
    if (hasTec) {
      tecValid++;
      const v = a.acogio_tecnica ? String(a.acogio_tecnica).toUpperCase().trim() : '';
      if (v === 'SI' || v === 'SÍ') acogidas++;
      else if (v.includes('PARCIAL')) parciales++;
      else pendientes++;
    }
    if (hasJur) {
      jurValid++;
      const v = a.acogio_juridica ? String(a.acogio_juridica).toUpperCase().trim() : '';
      if (v === 'SI' || v === 'SÍ') acogidas++;
      else if (v.includes('PARCIAL')) parciales++;
      else pendientes++;
    }
  });

  console.log('Total Frentes Bosa:', bosaAlertas.length);
  console.log('Tec Valid:', tecValid);
  console.log('Jur Valid:', jurValid);
  console.log('Total Obs:', tecValid + jurValid);
  console.log('Acogidas:', acogidas);
  console.log('Parciales:', parciales);
  console.log('Pendientes:', pendientes);
}
fetchAll();
