'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import Heatmap from '../components/Heatmap';
import LineChart from '../components/LineChart';

// MVP Example API URL: Replace with actual URL after CDK deploy
const API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || '';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPole, setSelectedPole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Step 1: Request presigned URL from API Gateway -> Lambda
        const res = await fetch(`${API_URL}/dashboard`);
        if (!res.ok) throw new Error('API request failed');
        
        const json = await res.json();
        const downloadUrl = json.download_url;
        
        if (!downloadUrl) throw new Error('No download URL returned');

        // Step 2: Download the CSV from S3 presigned URL
        const csvRes = await fetch(downloadUrl);
        const csvText = await csvRes.text();

        // Step 3: Parse CSV data
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data);
            setLoading(false);
          },
          error: (err: Error) => {
            throw err;
          }
        });

      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    }

    if (API_URL) {
      fetchData();
    } else {
      setLoading(false);
      setError("NEXT_PUBLIC_DASHBOARD_API_URL is not set.");
    }
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center p-8">データを読み込み中...</div>;
  if (error) return <div className="flex h-screen items-center justify-center p-8 text-red-500">エラー: {error}</div>;

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900">
      <header className="bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">トロリ線 摩耗状態ダッシュボード (MVP)</h1>
      </header>

      <main className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left Side: Heatmap (Overview) */}
        <section className="flex flex-col w-1/2 rounded-lg bg-white shadow p-4 relative">
          <h2 className="text-lg font-semibold mb-2">俯瞰ヒートマップ</h2>
          <div className="flex-1 overflow-auto">
            <Heatmap 
              data={data} 
              onPoleSelect={(pole: string) => setSelectedPole(pole)} 
              selectedPole={selectedPole} 
            />
          </div>
        </section>

        {/* Right Side: Line Chart (Detail) */}
        <section className="flex flex-col w-1/2 rounded-lg bg-white shadow p-4 relative">
          <h2 className="text-lg font-semibold mb-2">詳細推移グラフ: {selectedPole || '未選択'}</h2>
          <div className="flex-1">
             {selectedPole ? (
               <LineChart data={data} poleNumber={selectedPole} />
             ) : (
               <div className="flex h-full items-center justify-center text-slate-400">
                 左側のヒートマップから電柱を選択してください
               </div>
             )}
          </div>
        </section>
      </main>
    </div>
  );
}
