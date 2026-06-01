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
  
  bosaAlertas.forEach(a => {
      console.log('ID:', a.id, 'TEC:', a.observacion_tecnica, '|| JUR:', a.observacion_juridica);
  });
}
fetchAll();
