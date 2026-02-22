'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface LineChartProps {
  data: any[];
  poleNumber: string;
}

export default function LineChart({ data, poleNumber }: LineChartProps) {
  const chartData = useMemo(() => {
    if (!data || !poleNumber) return null;

    // Filter data for the selected pole
    const filtered = data.filter(row => row['電柱番号'] === poleNumber);
    if (filtered.length === 0) return null;

    // Extract unique dates for X-axis
    const dates = Array.from(new Set(filtered.map(row => row['測定年月日']))).sort();

    // Prepare datasets for each hanger position (1H to 14H)
    const datasets = [];
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
      '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'
    ];

    for (let i = 1; i <= 14; i++) {
        const hangerStr = i.toString();
        
        // Find data points for this hanger across all dates
        const dataPoints = dates.map(date => {
            const entry = filtered.find(row => row['測定年月日'] === date && row['ハンガ位置']?.toString() === hangerStr);
            return entry ? parseFloat(entry['摩耗_最小値']) : null;
        });

        // Only add dataset if it has at least one valid point
        if (dataPoints.some(dp => dp !== null && !isNaN(dp))) {
            datasets.push({
                label: `${hangerStr}H`,
                data: dataPoints,
                borderColor: colors[i - 1],
                backgroundColor: colors[i - 1],
                tension: 0.1,
                fill: false,
                spanGaps: true
            });
        }
    }

    return {
      labels: dates,
      datasets
    };
  }, [data, poleNumber]);

  if (!chartData) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">データが見つかりません</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { boxWidth: 12, font: { size: 11 } }
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: { title: { display: true, text: '測定年月日' } },
      y: { 
          title: { display: true, text: '摩耗_最小値 (mm)' },
          // optional: min/max bounds based on nominal dia can go here
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  return (
    <div className="w-full h-full min-h-[400px]">
      <Line options={options} data={chartData} />
    </div>
  );
}
