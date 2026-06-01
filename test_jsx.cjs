const fs = require('fs');
const content = fs.readFileSync('d:\\tablero_Obras\\tablero-web-ugrt\\src\\components\\Dashboard.jsx', 'utf8');
const isInvalidStr = content.includes('s.includes(\'no hay observacion\')');
console.log('isInvalid logic exists:', isInvalidStr);
