
const fs = require("fs");
const url = "https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/frentes_obra?select=*";
const alertasUrl = "https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/alertas_obra?select=*";
const headers = {
  "apikey": "sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ",
  "Authorization": "Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ"
};

const LOCALIDADES = [
  "ANTONIO NARIÑO", "BARRIOS UNIDOS", "BOSA", "CANDELARIA", "CHAPINERO", 
  "CIUDAD BOLÍVAR", "ENGATIVÁ", "FONTIBÓN", "KENNEDY", "LOS MÁRTIRES", 
  "PUENTE ARANDA", "RAFAEL URIBE URIBE", "SAN CRISTÓBAL", "SANTA FE", 
  "SUBA", "SUMAPAZ", "TEUSAQUILLO", "TUNJUELITO", "USAQUÉN", "USME"
];

async function fetchAll(u) {
  let all = [];
  let from = 0;
  let more = true;
  while(more) {
    const res = await fetch(u, { headers: { ...headers, "Range": from + "-" + (from+999) } });
    const data = await res.json();
    if(data.length > 0) {
      all = all.concat(data);
      if(data.length < 1000) more = false;
      else from += 1000;
    } else {
      more = false;
    }
  }
  return all;
}

async function run() {
  const allFrentes = await fetchAll(url);
  const alertas = await fetchAll(alertasUrl);

  const filteredData = allFrentes.filter(d => {
    const e = d.estado ? String(d.estado).toUpperCase().trim() : "";
    if (e === "ANULADO" || e === "PAGADO") return false;
    let yFin = d.crono_fin ? new Date(d.crono_fin).getFullYear() : null;
    let yReal = d.fecha_real_fin ? new Date(d.fecha_real_fin).getFullYear() : null;
    if (yReal === 2024 || yReal === 2025) return false;
    if (yFin === 2024 || yFin === 2025) return false;
    return true;
  });

  const locStats = {};
  LOCALIDADES.forEach(loc => locStats[loc] = { loc, univ:0, prog:0, term:0, susp:0, venc:0 });
  const today = new Date("2026-05-29"); 
  
  filteredData.forEach(d => {
    const e = d.estado ? String(d.estado).toUpperCase().trim() : "";
    let dFin = d.crono_fin ? new Date(d.crono_fin) : null;
    if (!d.localidad || !locStats[d.localidad]) return;
    const st = locStats[d.localidad];
    st.univ++;
    const inicio2026 = new Date(2026, 0, 1);
    if (dFin && dFin >= inicio2026 && dFin <= today) {
      st.prog++;
      if (e === "TERMINADO") st.term++;
      else st.venc++;
    }
    if (e === "SUSPENDIDO") st.susp++;
  });

  const rankingIDC = Object.values(locStats).map(st => {
    st.pct = st.prog > 0 ? (st.term/st.prog)*100 : 0;
    return st;
  }).sort((a,b) => {
    if(a.pct !== b.pct) return b.pct - a.pct;
    if(a.term !== b.term) return b.term - a.term;
    if(a.venc !== b.venc) return a.venc - b.venc;
    return a.susp - b.susp;
  });

  const locMap = {};
  LOCALIDADES.forEach(l => locMap[l] = { loc:l, count:0, si:0, no:0, vacio:0 });
  alertas.forEach(a => {
    const loc = a.localidad ? String(a.localidad).trim().toUpperCase() : null;
    if(!loc || !locMap[loc]) return;
    const vt = a.observacion_tecnica?String(a.observacion_tecnica).trim():"";
    const vj = a.observacion_juridica?String(a.observacion_juridica).trim():"";
    const ht = vt.length>0 && vt!=="0" && vt.toLowerCase()!=="n/a";
    const hj = vj.length>0 && vj!=="0" && vj.toLowerCase()!=="n/a";
    if(!ht && !hj) return;
    locMap[loc].count++;
    const ch = (f) => {
      const v = f ? String(f).trim().toUpperCase() : "";
      if(v==="SI"||v==="SÍ") locMap[loc].si++;
      else if(v==="NO") locMap[loc].no++;
      else locMap[loc].vacio++;
    };
    ch(a.acogio_tecnica); ch(a.acogio_juridica);
  });

  const alertasResumen = Object.values(locMap).map(st => {
    const tp = st.count * 2;
    st.pct = tp > 0 ? (st.si/tp)*100 : 0;
    return st;
  }).sort((a,b) => b.pct - a.pct);

  fs.writeFileSync("datos.json", JSON.stringify({ rankingIDC, alertasResumen }, null, 2));
}
run();

