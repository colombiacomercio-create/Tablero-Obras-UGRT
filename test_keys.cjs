const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./public/frentes_obra.json', 'utf8'));
const alertas = JSON.parse(fs.readFileSync('./public/alertas_obra.json', 'utf8'));

console.log('frentes_obra first row keys:', Object.keys(data[0]));
console.log('alertas_obra first row keys:', Object.keys(alertas[0]));
console.log('frentes_obra first row ID example:', data[0].id_frente, data[0].id, data[0].frente_obra);
console.log('alertas_obra first row ID example:', alertas[0].id_frente, alertas[0].id, alertas[0].frente_obra);
