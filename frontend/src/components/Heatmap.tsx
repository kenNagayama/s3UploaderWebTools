'use client';

import React, { useMemo } from 'react';

interface HeatmapProps {
  data: any[];
  onPoleSelect: (poleNumber: string) => void;
  selectedPole: string | null;
}

export default function Heatmap({ data, onPoleSelect, selectedPole }: HeatmapProps) {
  // Use useMemo to process data efficiently for the heatmap
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Map the unpivoted CSV data: Record<PoleNumber, Record<HangerPosition, Record<Date, {wear, normalDia}>>>
    const poleMap: Record<string, Record<string, Record<string, any>>> = {};
    const datesSet = new Set<string>();

    data.forEach(row => {
      const poleNumber = String(row['電柱番号']);
      const hangerPos = String(row['ハンガ位置']);
      const wear = parseFloat(row['摩耗_最小値']);
      const normalDia = parseFloat(row['新品時直径']);
      const date = row['測定年月日'];

      if (!row['電柱番号'] || !row['ハンガ位置'] || isNaN(wear) || !date) return;

      datesSet.add(date);

      if (!poleMap[poleNumber]) poleMap[poleNumber] = {};
      if (!poleMap[poleNumber][hangerPos]) poleMap[poleNumber][hangerPos] = {};
      poleMap[poleNumber][hangerPos][date] = { wear, normalDia };
    });

    return { poleMap, dates: Array.from(datesSet).filter(Boolean).sort() };
  }, [data]);

  if (!('dates' in processedData) || processedData.dates.length === 0) {
    return <div className="text-sm text-slate-500">データがありません</div>;
  }

  const { poleMap, dates } = processedData as { poleMap: Record<string, Record<string, Record<string, any>>>; dates: string[] };
  // Sort poles. If they are numeric, sort as numbers, else string sort
  const poleNumbers = Object.keys(poleMap).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
  const hangers = Array.from({ length: 14 }, (_, i) => (i + 1).toString());

  // Helper to determine color based on wear percentage
  const getColor = (wear: number, normalDia: number) => {
    if (!normalDia) return '#e2e8f0'; // Default gray
    const ratio = wear / normalDia;
    
    // Map ratio 0.6...1.0 to Hue 0(Red)...220(Blue)
    const clampedRatio = Math.max(0.6, Math.min(1.0, ratio));
    const hue = ((clampedRatio - 0.6) / 0.4) * 220; 
    
    return `hsl(${hue}, 80%, 50%)`;
  };

  return (
    <div className="overflow-auto border rounded bg-white h-full">
      <table className="min-w-full text-xs text-center border-collapse">
        <thead className="sticky top-0 bg-slate-100 shadow-sm z-30">
          <tr>
            <th className="border p-1 bg-slate-200 min-w-16 sticky left-0 z-40">電柱番号</th>
            <th className="border p-1 bg-slate-200 min-w-12 sticky left-16 z-40">位置</th>
            {dates.map(d => (
              <th key={d} className="border p-1 min-w-16 font-normal whitespace-nowrap">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {poleNumbers.map(pole => (
             hangers.map((h, index) => (
                <tr 
                  key={`${pole}-${h}`} 
                  className={`hover:bg-slate-50 cursor-pointer ${selectedPole === pole ? 'bg-blue-50' : ''}`}
                  onClick={() => onPoleSelect(pole)}
                >
                  {index === 0 && (
                    <td 
                      rowSpan={14} 
                      className={`border p-1 font-semibold sticky left-0 z-20 text-left px-2 align-top ${selectedPole === pole ? 'bg-blue-100 ring-inset ring-2 ring-blue-500' : 'bg-slate-50'}`}
                    >
                      {pole}
                    </td>
                  )}
                  <td className={`border p-1 sticky left-16 z-20 text-center text-[10px] ${selectedPole === pole ? 'bg-blue-50' : 'bg-white'}`}>
                    {h}H
                  </td>
                  {dates.map(d => {
                    const cellData = poleMap[pole]?.[h]?.[d];
                    const bg = cellData ? getColor(cellData.wear, cellData.normalDia) : '#f8fafc';
                    return (
                      <td 
                        key={d} 
                        className="border p-0 transition-colors duration-200 min-w-12 h-6"
                        style={{ backgroundColor: bg }}
                        title={cellData ? `摩耗: ${cellData.wear}mm (新品: ${cellData.normalDia}mm)` : 'データなし'}
                      >
                      </td>
                    );
                  })}
                </tr>
             ))
          ))}
        </tbody>
      </table>
    </div>
  );
}
