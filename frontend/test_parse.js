const fs = require('fs');
const Papa = require('papaparse');

const csvText = `"測定年月日","電柱番号","ハンガ位置","摩耗_最小値","新品時直径"
"20200405","001","1","13.67","15.49"
"20200413","001","1",,"15.49"
"20200413","002","2","15.14","15.49"`;

Papa.parse(csvText, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: (results) => {
    console.log("Results:", results.data);
    
    // Simulate Heatmap.tsx logic
    results.data.forEach(row => {
      const poleNumber = String(row['電柱番号']);
      const hangerPosStr = `${row['ハンガ位置']}H`;
      const wear = parseFloat(row['摩耗_最小値']);
      const normalDia = parseFloat(row['新品時直径']);
      const dateStr = String(row['測定年月日']);
      
      console.log(`Row: pole=${poleNumber}, hanger=${hangerPosStr}, wear=${wear}, normalDia=${normalDia}, date=${dateStr}`);
      if (!poleNumber || !hangerPosStr || isNaN(wear) || !dateStr || dateStr === 'undefined') {
        console.log("==> SKIPPED!");
      }
    });
  }
});
