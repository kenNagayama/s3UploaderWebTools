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

    // Map the unpivoted CSV data to an object structure suitable for rendering
    // Expected structure: Record<PoleNumber, Record<HangerPosition, {wear: number, normalDia: number, date: string}>>
    const poleMap: Record<string, Record<string, any>> = {};
    const dates = new Set<string>();

    data.forEach(row => {
      const poleNumber = row['電柱番号'];
      const hangerPos = row['ハンガ位置'];
      const wear = parseFloat(row['摩耗_最小値']);
      const normalDia = parseFloat(row['新品時直径']);
      const date = row['測定年月日'];

      if (!poleNumber || !hangerPos || isNaN(wear)) return;

      dates.add(date);

      if (!poleMap[poleNumber]) {
        poleMap[poleNumber] = {};
      }
      poleMap[poleNumber][hangerPos] = { wear, normalDia, date };
    });

    return { poleMap, dates: Array.from(dates).sort() };
  }, [data]);

  if (!('dates' in processedData) || processedData.dates.length === 0) {
    return <div className="text-sm text-slate-500">データがありません</div>;
  }

  const { poleMap, dates } = processedData as { poleMap: Record<string, Record<string, any>>; dates: string[] };
  const poleNumbers = Object.keys(poleMap).sort();
  const hangers = Array.from({ length: 14 }, (_, i) => (i + 1).toString());

  // Helper to determine color based on wear percentage
  const getColor = (wear: number, normalDia: number) => {
    if (!normalDia) return '#e2e8f0'; // Default gray
    const ratio = wear / normalDia;
    
    // Color logic: Red (progressed wear, e.g., < 80%) to Blue (less wear, e.g., > 95%)
    // MVP simplified logic using HSL (0 is red, 220 is blue)
    // Map ratio 0.7...1.0 to Hue 0...220
    const clampedRatio = Math.max(0.7, Math.min(1.0, ratio));
    const hue = ((clampedRatio - 0.7) / 0.3) * 220; 
    
    return `hsl(${hue}, 80%, 50%)`;
  };

  return (
    <div className="overflow-auto border rounded bg-white">
      <table className="min-w-full text-xs text-center border-collapse">
        <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
          <tr>
            <th className="border p-1 bg-slate-200 min-w-20 sticky left-0 z-20">電柱番号</th>
            {hangers.map(h => (
              <th key={h} className="border p-1 min-w-8 font-normal">{h}H</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {poleNumbers.map(pole => (
            <tr 
              key={pole} 
              className={`hover:bg-slate-50 cursor-pointer ${selectedPole === pole ? 'bg-blue-50 ring-inset ring-2 ring-blue-500' : ''}`}
              onClick={() => onPoleSelect(pole)}
            >
              <td className="border p-1 font-semibold sticky left-0 bg-white z-10 text-left px-2">
                {pole}
              </td>
              {hangers.map(h => {
                const cellData = poleMap[pole][h];
                const bg = cellData ? getColor(cellData.wear, cellData.normalDia) : '#f8fafc';
                return (
                  <td 
                    key={h} 
                    className="border p-1 transition-colors duration-200"
                    style={{ backgroundColor: bg }}
                    title={cellData ? `摩耗: ${cellData.wear}mm (新品: ${cellData.normalDia}mm)` : 'データなし'}
                  >
                    {/* Optional text inside */}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
