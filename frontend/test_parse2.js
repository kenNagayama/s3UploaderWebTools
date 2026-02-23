const fs = require('fs');
const Papa = require('papaparse');

const csvText = fs.readFileSync('test2.csv', 'utf8');

Papa.parse(csvText, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: (results) => {
    console.log(`Parsed ${results.data.length} rows.`);
    
    const poleSet = new Set();
    const hangers = Array.from({ length: 14 }, (_, i) => `${14 - i}H`); // Reverse for Y-axis (1H at top)
    const scatterData = [];
    
    let validCount = 0;
    results.data.forEach(row => {
      const poleNumber = String(row['電柱番号']);
      const hangerPosStr = `${row['ハンガ位置']}H`;
      const wear = parseFloat(row['摩耗_最小値']);
      const normalDia = parseFloat(row['新品時直径']);
      const dateStr = String(row['測定年月日']);

      if (!poleNumber || !hangerPosStr || isNaN(wear) || !dateStr || dateStr === 'undefined') return;

      poleSet.add(poleNumber);
      
      let year, month, day;
      const cleanDate = dateStr.replace(/[-/]/g, '');
      if (cleanDate.length === 8) {
        year = cleanDate.substring(0, 4);
        month = cleanDate.substring(4, 6);
        day = cleanDate.substring(6, 8);
      } else {
        year = '2000'; month = '01'; day = '01';
      }
      const timestamp = new Date(`${year}-${month}-${day}T00:00:00Z`).getTime();
      if (isNaN(timestamp)) return; // Skip invalid dates
      
      validCount++;
      scatterData.push({
        value: [
          timestamp,
          poleNumber,
          hangerPosStr,
          wear,
          normalDia
        ]
      });
    });
    
    console.log(`Valid scatter rows: ${validCount}`);
    console.log(`Unique poles: ${poleSet.size}`);
    
    const poleNumbers = Array.from(poleSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.localeCompare(b);
    }).reverse();
    
    const yCategories = [];
    poleNumbers.forEach(pole => {
      hangers.forEach(h => {
        yCategories.push(`${pole} - ${h}`);
      });
    });
    
    console.log(`yCategories length: ${yCategories.length}`);
  }
});
