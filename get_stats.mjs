const url = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/frentes_obra?select=*';
const headers = {
  'apikey': 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ',
  'Authorization': 'Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ'
};

fetch(url, { headers })
  .then(r => r.json())
  .then(data => {
    // Basic filters applied in Dashboard
    const filteredData = data.filter(d => {
      const e = d.estado ? String(d.estado).toUpperCase().trim() : '';
      if (e === 'ANULADO' || e === 'PAGADO') return false;
      let yFin = d.crono_fin ? new Date(d.crono_fin).getFullYear() : null;
      let yReal = d.fecha_real_fin ? new Date(d.fecha_real_fin).getFullYear() : null;
      if (yReal === 2024 || yReal === 2025) return false;
      if (yFin === 2024 || yFin === 2025) return false;
      return true;
    });

    let universoCount = filteredData.length;
    let terminadas = 0;
    let suspendidas = 0;
    let enEjecucion = 0;
    let sinCronograma = 0;
    let kmTerm = 0, m2Term = 0, mlTerm = 0;
    let huecosTerm = 0;

    filteredData.forEach(d => {
      const e = d.estado ? String(d.estado).toUpperCase().trim() : '';
      if (e === 'TERMINADO') {
        terminadas++;
        kmTerm += Number(d.km_carril) || 0;
        m2Term += Number(d.m2) || 0;
        mlTerm += Number(d.ml) || 0;
        huecosTerm += Number(d.huecos) || 0;
      }
      else if (e === 'SUSPENDIDO') suspendidas++;
      else if (e === 'EN EJECUCIÓN' || e === 'EN EJECUCION' || e === 'EN EJECUCIÓN ' || e === 'EN  EJECUCION' || e === 'POR INICIAR') enEjecucion++;
      else if (e === 'SIN CRONOGRAMA' || e === 'SIN CRONOGRAMA ') sinCronograma++;
    });

    console.log('--- CONSOLIDADO ---');
    console.log('Universo Activo:', universoCount);
    console.log('Terminadas:', terminadas);
    console.log('En Ejecución / Por Iniciar:', enEjecucion);
    console.log('Suspendidas:', suspendidas);
    console.log('Sin Cronograma:', sinCronograma);
    console.log('Físicas: Km:', kmTerm, ' M2:', m2Term, ' ML:', mlTerm, ' Huecos:', huecosTerm);
  });
