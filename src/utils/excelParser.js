import * as XLSX from 'xlsx';

export const parseExcelToDB = async (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        onProgress('Leyendo archivo Excel...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        onProgress('Procesando hoja 2021-2025...');
        const sheetName = '2021-2025';
        if (!workbook.Sheets[sheetName]) {
          throw new Error('No se encontró la hoja "2021-2025"');
        }
        
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: "A", defval: null });
        const parsedData = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row['C']) continue;
          
          parsedData.push({
            localidad: row['C'] ? String(row['C']).trim().toUpperCase() : null,
            contrato: row['D'] || null,
            tipo_contrato: row['F'] || null,
            tipo_intervencion: row['BF'] || null,
            categoria_inversion: row['BD'] || null,
            estado: row['BN'] || null,
            porcentaje_avance: parseFloat(row['BO']) || 0,
            crono_inicio: row['BI'] instanceof Date ? row['BI'].toISOString().split('T')[0] : null,
            crono_fin: row['BJ'] instanceof Date ? row['BJ'].toISOString().split('T')[0] : null,
            fecha_real_fin: row['BQ'] instanceof Date ? row['BQ'].toISOString().split('T')[0] : null,
            valor_final: parseFloat(row['K']) || 0,
            km_carril: parseFloat(row['BX']) || 0,
            m2: parseFloat(row['CD']) || 0,
            ml: parseFloat(row['CE']) || 0,
            huecos: parseFloat(row['BY']) || 0,
            justificacion_suspension: row['V'] || null,
            fecha_suspension: row['W'] instanceof Date ? row['W'].toISOString().split('T')[0] : (row['W'] || null)
          });
        }
        
        onProgress('Procesando hoja Alertas...');
        const alertasSheet = workbook.Sheets['Alertas'] || workbook.Sheets['ALERTAS'];
        const parsedAlertas = [];
        if (alertasSheet) {
          const alertasRows = XLSX.utils.sheet_to_json(alertasSheet, { header: "A", defval: null });
          for (let i = 1; i < alertasRows.length; i++) {
            const row = alertasRows[i];
            if (!row['A']) continue; // skip empty
            
            parsedAlertas.push({
              localidad: row['B'] || null,
              contrato: row['C'] || null,
              estado_general: row['F'] || null,
              acogio_tecnica: row['K'] || null, // Acogio Las Recomendaciones Técnicas
              acogio_juridica: row['L'] || null, // Acogio Las Recomendaciones Jurídicas
              observacion_tecnica: row['G'] || null,
              observacion_juridica: row['H'] || null,
              gestiones_otras_entidades: row['M'] || null
            });
          }
        }
        
        resolve({ frentes: parsedData, alertas: parsedAlertas });
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
