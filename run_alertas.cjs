
const url = "https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/alertas_obra?select=*";
const headers = { "apikey": "sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ", "Authorization": "Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ" };

async function run() {
  let all = []; let from = 0; let more = true;
  while(more) {
    const res = await fetch(url, { headers: { ...headers, "Range": from + "-" + (from+999) } });
    const data = await res.json();
    if(data.length > 0) { all = all.concat(data); if(data.length < 1000) more = false; else from += 1000; } else more = false;
  }
  
  const LOCALIDADES = [
    "ANTONIO NARIÑO", "BARRIOS UNIDOS", "BOSA", "CANDELARIA", "CHAPINERO", 
    "CIUDAD BOLÍVAR", "ENGATIVÁ", "FONTIBÓN", "KENNEDY", "LOS MÁRTIRES", 
    "PUENTE ARANDA", "RAFAEL URIBE URIBE", "SAN CRISTÓBAL", "SANTA FE", 
    "SUBA", "SUMAPAZ", "TEUSAQUILLO", "TUNJUELITO", "USAQUÉN", "USME"
  ];
  
  const locMap = {};
  LOCALIDADES.forEach(loc => locMap[loc] = { loc, observacionesCount: 0, acogidas: 0, parciales: 0, pendientes: 0 });
  
  const normalizar = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  
  all.forEach(a => {
    const rawLoc = a.localidad ? normalizar(String(a.localidad)) : null;
    let matchedKey = rawLoc ? Object.keys(locMap).find(k => normalizar(k) === rawLoc) : null;
    if(!matchedKey) return;
    const loc = matchedKey;
    
    const valTec = a.observacion_tecnica ? String(a.observacion_tecnica).trim() : "";
    const valJur = a.observacion_juridica ? String(a.observacion_juridica).trim() : "";
    const isInvalid = (str) => {
      const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return s === "0" || s === "n/a" || s === "na" || s === "" || s.includes("no hay observacion") || s.includes("sin observacion");
    };
    
    const hasTec = !isInvalid(valTec);
    const hasJur = !isInvalid(valJur);
    
    const checkField = (hasObs, fieldStr) => {
      if (!hasObs) return;
      locMap[loc].observacionesCount++;
      const val = fieldStr ? String(fieldStr).trim().toUpperCase() : "";
      if (val === "SI" || val === "SÍ") locMap[loc].acogidas++;
      else if (val.includes("PARCIAL")) locMap[loc].parciales++;
      else locMap[loc].pendientes++;
    };

    checkField(hasTec, a.acogio_tecnica);
    checkField(hasJur, a.acogio_juridica);
  });
  
  const alertasResumen = Object.values(locMap).map(st => {
    st.pct = st.observacionesCount > 0 ? ((st.acogidas * 1) + (st.parciales * 0.5)) / st.observacionesCount * 100 : 0;
    return st;
  }).sort((a,b) => b.pct - a.pct);
  
  console.log(JSON.stringify(alertasResumen, null, 2));
}
run();

