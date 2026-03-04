'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

interface HeatmapProps {
  data: any[];
  onPoleSelect: (poleNumber: string) => void;
  selectedPole: string | null;
  sortType: string;
}

export default function Heatmap({ data, onPoleSelect, selectedPole, sortType }: HeatmapProps) {
  const chartRef = useRef<any>(null);
  // Store zoom state to persist scroll position across re-renders
  const [zoomState, setZoomState] = React.useState<{start: number, end: number} | null>(null);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const poleSet = new Set<string>();
    const poleMeta = new Map<string, { route: string, poleNum: number, no: number }>();
    const hangers = Array.from({ length: 14 }, (_, i) => `${14 - i}H`); // Reverse for Y-axis (1H at top)
    const scatterData: any[] = [];

    // Helper to determine color based on wear percentage
    const getColor = (wear: number, normalDia: number) => {
      if (!normalDia) return '#e2e8f0'; // Default gray
      const ratio = wear / normalDia;
      // Map ratio 0.6...1.0 to Hue 0(Red)...220(Blue)
      const clampedRatio = Math.max(0.6, Math.min(1.0, ratio));
      const hue = ((clampedRatio - 0.6) / 0.4) * 220;
      return `hsl(${hue}, 80%, 50%)`;
    };

    data.forEach(row => {
      // Create a globally unique pole name using Station/Section Name (or fallback to Route/Line)
      const routeName = row['行路名称'] || row['通称線名名称'] || '不明';
      const stationName = row['駅_駅々間名称'] || routeName;
      const rawPole = String(row['電柱番号']);
      const poleNumber = `${stationName} ${rawPole}`;
      
      const hangerPosStr = `${row['ハンガ位置']}H`;
      const wear = parseFloat(row['摩耗_最小値']);
      const normalDia = parseFloat(row['新品時直径']);
      const dateStr = String(row['測定年月日']);

      if (!rawPole || !hangerPosStr || isNaN(wear) || !dateStr || dateStr === 'undefined') return;

      if (!poleSet.has(poleNumber)) {
        poleSet.add(poleNumber);
        const parsedPole = parseInt(rawPole, 10);
        const noVal = parseInt(row['no'], 10);
        poleMeta.set(poleNumber, { 
          route: routeName, 
          poleNum: isNaN(parsedPole) ? 0 : parsedPole,
          no: isNaN(noVal) ? 0 : noVal
        });
      }
      
      // Parse YYYYMMDD or YYYY-MM-DD
      let year, month, day;
      const cleanDate = dateStr.replace(/[-/]/g, '');
      if (cleanDate.length === 8) {
        year = cleanDate.substring(0, 4);
        month = cleanDate.substring(4, 6);
        day = cleanDate.substring(6, 8);
      } else {
        // Fallback for unexpected formats
        year = '2000'; month = '01'; day = '01';
      }
      
      const timestamp = new Date(`${year}-${month}-${day}T00:00:00Z`).getTime();
      if (isNaN(timestamp)) return; // Skip invalid dates

      scatterData.push({
        value: [
          timestamp,      // X: Time
          poleNumber,     // Y: Category (Pole)
          hangerPosStr,     // extra data for tooltip/y-axis logic
          wear,           // extra data
          normalDia       // extra data
        ],
        itemStyle: {
          color: getColor(wear, normalDia)
        }
      });
    });

    const poleNumbers = Array.from(poleSet).sort((a, b) => {
      const metaA = poleMeta.get(a)!;
      const metaB = poleMeta.get(b)!;
      const isDesc = sortType.endsWith('_desc');
      
      if (sortType.startsWith('no_')) {
        let diff = metaA.no - metaB.no;
        if (diff === 0) diff = metaA.poleNum - metaB.poleNum;
        return isDesc ? -diff : diff;
      } else {
        if (metaA.route !== metaB.route) {
          const routeDiff = metaA.route.localeCompare(metaB.route);
          return isDesc ? -routeDiff : routeDiff;
        }
        const diff = metaA.poleNum - metaB.poleNum;
        return isDesc ? -diff : diff;
      }
    }).reverse(); // Reverse for Y axis (ECharts plots from bottom to top)

    // Generate Cartesian Y-Axis categories matching Route + Pole + Hanger
    const yCategories: string[] = [];
    poleNumbers.forEach(pole => {
      hangers.forEach(h => {
        yCategories.push(`${pole} - ${h}`);
      });
    });

    // Map the scatter data Y values to the exact combined category
    const mappedScatterData = scatterData.map(item => {
        const pole = item.value[1];
        const hanger = item.value[2];
        return {
            ...item,
            value: [
                item.value[0],
                `${pole} - ${hanger}`,
                ...item.value.slice(2)
            ]
        };
    });

    return { yCategories, scatterData: mappedScatterData, poleNumbers };
  }, [data]);

  useEffect(() => {
    const echartInstance = chartRef.current?.getEchartsInstance();
    if (echartInstance) {
      const clickHandler = (params: any) => {
        if (params.value && params.value[1]) {
           const poleCategory = params.value[1];
           const pole = poleCategory.split(' - ')[0];
           onPoleSelect(pole);
        }
      };
      
      const zoomHandler = (params: any) => {
          // dataZoom event returns batch array or single start/end
          const batch = params.batch?.[0] || params;
          if (batch.start !== undefined && batch.end !== undefined) {
              setZoomState({ start: batch.start, end: batch.end });
          }
      };

      echartInstance.on('click', clickHandler);
      echartInstance.on('dataZoom', zoomHandler);

      return () => {
         echartInstance.off('click', clickHandler);
         echartInstance.off('dataZoom', zoomHandler);
      };
    }
  }, [onPoleSelect, processedData]);

  if (!processedData || processedData.yCategories.length === 0) {
    return <div className="text-sm text-slate-500 flex h-full items-center justify-center">データがありません</div>;
  }

  const { yCategories, scatterData } = processedData;

  const getOptions = () => ({
    grid: {
      left: 100, // accommodate labels
      right: 30,
      top: 10,
      bottom: 60
    },
    tooltip: {
      formatter: (params: any) => {
        const date = new Date(params.value[0]);
        const dateStr = `${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${String(date.getUTCDate()).padStart(2,'0')}`;
        const poleHanger = params.value[1];
        const wear = params.value[3];
        const normal = params.value[4];
        return `
            <strong>${poleHanger}</strong><br/>
            日付: ${dateStr}<br/>
            摩耗_最小値: ${wear} mm<br/>
            新品時直径: ${normal} mm
        `;
      }
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      splitLine: { show: true, lineStyle: { color: '#e2e8f0' } },
      axisLine: { show: true },
      axisLabel: { 
          formatter: '{yyyy}/{MM}',
          hideOverlap: true
      }
    },
    yAxis: {
      type: 'category',
      data: yCategories,
      axisLabel: {
        interval: 0,
        fontSize: 10,
        formatter: (value: string) => {
           // Highlight selected pole label
           const pole = value.split(' - ')[0];
           return selectedPole === pole ? `{active|${value}}` : `{normal|${value}}`;
        },
        rich: {
            active: { color: '#2563eb', fontWeight: 'bold' },
            normal: { color: '#64748b' }
        }
      },
      splitArea: {
          show: true,
          areaStyle: { color: ['rgba(250,250,250,0.3)','rgba(200,200,200,0.1)'] }
      }
    },
    dataZoom: [
      {
        type: 'slider',
        show: true,
        xAxisIndex: [0],
        bottom: 10,
        height: 20
      },
      {
        type: 'slider',
        show: true,
        yAxisIndex: [0],
        right: 0,
        width: 20,
        // Use saved zoom state if available, otherwise use default range
        ...(zoomState ? {
            start: zoomState.start,
            end: zoomState.end
        } : {
            startValue: Math.max(0, yCategories.length - 42),
            endValue: yCategories.length - 1
        })
      },
      { 
        type: 'inside', 
        yAxisIndex: [0],
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true
      },
      {
        type: 'inside',
        xAxisIndex: [0],
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true
      }
    ],
    series: [
      {
        type: 'scatter',
        symbol: 'roundRect',
        symbolSize: [12, 10], // width, height of the '■'
        data: scatterData,
        animation: false
      }
    ]
  });

  return (
    <div className="w-full h-full min-h-[500px] border rounded bg-white relative">
      <ReactECharts 
        ref={chartRef}
        option={getOptions()} 
        style={{ height: '100%', width: '100%' }} 
        // Remove notMerge={true} to allow partial updates (keeping internal state like scroll if possible)
        // But since we are managing zoom state explicitly now, it should work either way.
        // Keeping notMerge={true} causes full redraw which is flickery.
        notMerge={false}
      />
    </div>
  );
}
