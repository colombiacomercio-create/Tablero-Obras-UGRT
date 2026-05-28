const XLSX = require('xlsx');
const wb = XLSX.readFile('../MATRIZ 2021-2025 F (2) (version 1) v26mayo.xlsm');
const ws = wb.Sheets['Alertas'];
if (ws) {
  const json = XLSX.utils.sheet_to_json(ws, {header: 1});
  console.log('Headers Alertas:', json[0]);
} else {
  console.log('No Alertas sheet found');
}
