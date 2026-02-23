'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import Heatmap from '../components/Heatmap';
import LineChart from '../components/LineChart';

// MVP Example API URL: Replace with actual URL after CDK deploy
const API_URL = '/api';

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // DO NOT load by default
  const [error, setError] = useState<string | null>(null);
  const [selectedPole, setSelectedPole] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Filter states
  const [location, setLocation] = useState('');
  const [lineType, setLineType] = useState<'route' | 'line'>('route'); // Toggle
  const [lineName, setLineName] = useState(''); // Holds either route or line
  const [direction, setDirection] = useState('');
  const [station, setStation] = useState('');

  // Fixed options lists based on Athena data
  const routeOptions = [
    "京浜東北線　北行　大船〜大宮", "京浜東北線　南行　大宮〜大船", "八高線　下り　八王子〜新宿",
    "八高線　下り　八王子〜新木場", "埼京線　下り　品川８＃〜八王子", "大宮支線　上り　東大操〜新秋津",
    "大宮支線　上り　東大操（大操２）〜新秋津", "大宮支線　下り　新秋津〜大宮操", "大宮支線　下り　新秋津〜東大宮操",
    "山手貨物　上り　東大操〜品川", "山手貨物　上り　東大操（２）〜品川", "山手貨物　下り　品川〜東大操",
    "山手貨物　下り　東京地下〜東大操", "常磐貨物線　上り　金町〜田端操〜東大宮操", "東北線　上り　黒磯〜大宮〜上野（高架１）",
    "東北線下り 東京〜上野(高架)〜大宮〜黒磯", "東北貨物線上り　東大宮操〜田端操〜金町", "西浦和支線　上り　大宮操〜東浦和",
    "西浦和支線　下り　東浦和〜東大操", "西浦和支線　下り　東浦和〜東大操２", "高崎線　上り　大前〜上野（地平）",
    "高崎線　下り　上野（地平）〜横川"
  ];

  const lineOptions = ["川越線", "東北〔回送〕", "東北〔埼京〕", "東北〔客〕", "東北〔貨物〕", "東北〔電車〕", "東北〔高崎〕", "東北本線", "高崎線"];
  const directionOptions = ["上り線", "下り線"];
  const stationOptions = [
    "与野―大宮", "久喜", "久喜―東鷲宮", "北与野―大宮", "南古谷", "南古谷―川越", "古河", "古河―野木", 
    "大宮", "大宮―宮原", "大宮―日進", "大宮―東大宮", "大宮―東大宮〔操〕", "大宮〔操〕", "大宮〔操〕―大宮", 
    "川越", "川越―西川越", "指扇", "指扇―南古谷", "新白岡", "新白岡―久喜", "日進", "日進―西大宮", 
    "東大宮", "東大宮―蓮田", "東鷲宮", "東鷲宮―栗橋", "栗橋", "栗橋―古河"
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Step 1: Request presigned URL from API Gateway -> Lambda with query params
        const params = new URLSearchParams();
        if (location) params.append('location', location);
        if (lineName) {
          params.append('line_type', lineType);
          params.append('line_name', lineName);
        }
        if (direction) params.append('direction', direction);
        if (station) params.append('station', station);

        const res = await fetch(`${API_URL}/dashboard/?${params.toString()}`);
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

    fetchData();
  }, []); // Run on mount

  const handleSearch = () => {
    setLoading(true);
    setSelectedPole(null);
    setData([]);
    // Re-trigger fetch by just calling same logic (extract to function)
    const fetchDataOnClick = async () => {
      try {
        const params = new URLSearchParams();
        if (location) params.append('location', location);
        if (lineName) {
          params.append('line_type', lineType);
          params.append('line_name', lineName);
        }
        if (direction) params.append('direction', direction);
        if (station) params.append('station', station);

        const res = await fetch(`${API_URL}/dashboard/?${params.toString()}`);
        if (!res.ok) throw new Error('API request failed');
        
        const json = await res.json();
        const downloadUrl = json.download_url;
        
        if (!downloadUrl) throw new Error('No download URL returned');

        const csvRes = await fetch(downloadUrl);
        const csvText = await csvRes.text();

        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log("Papa.parse complete. First 5 rows:", results.data.slice(0, 5));
            console.log("Keys of first row:", Object.keys(results.data[0] || {}));
            setData(results.data);
            setInitialLoad(false);
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
    };
    fetchDataOnClick();
  };

  const mcData = [
    { code: 211, name: "盛岡支社", items: [
      { code: "83500", name: "盛岡電力設備技術センター" },
      { code: "83501", name: "一ノ関電力メンテナンスセンター" },
      { code: "83503", name: "盛岡電力メンテナンスセンター" },
      { code: "83507", name: "青森電力メンテナンスセンター" }
    ]},
    { code: 212, name: "秋田支社", items: [
      { code: "83500", name: "秋田電力設備技術センター" },
      { code: "83501", name: "大曲電力メンテナンスセンター" },
      { code: "83502", name: "秋田電力メンテナンスセンター" },
      { code: "83504", name: "弘前電力メンテナンスセンター" }
    ]},
    { code: 213, name: "東北本部", items: [
      { code: "83502", name: "郡山電力メンテナンスセンター" },
      { code: "83503", name: "福島電力メンテナンスセンター" },
      { code: "83510", name: "仙台電力設備技術センター" },
      { code: "83512", name: "仙台電力メンテナンスセンター" },
      { code: "83515", name: "山形電力メンテナンスセンター" }
    ]},
    { code: 300, name: "新潟支社", items: [
      { code: "83500", name: "新潟電力設備技術センター" },
      { code: "83502", name: "酒田電力メンテナンスセンター" },
      { code: "83505", name: "長岡電力メンテナンスセンター" },
      { code: "83506", name: "新潟電力メンテナンスセンター" }
    ]},
    { code: 411, name: "高崎支社", items: [
      { code: "83500", name: "高崎電力設備技術センター" },
      { code: "83501", name: "桶川電力メンテナンスセンター" },
      { code: "83502", name: "熊谷電力メンテナンスセンター" },
      { code: "83503", name: "高崎電力メンテナンスセンター" }
    ]},
    { code: 412, name: "水戸支社", items: [
      { code: "83500", name: "水戸電力設備技術センター" },
      { code: "83501", name: "土浦電力メンテナンスセンター" },
      { code: "83502", name: "水戸電力メンテナンスセンター" },
      { code: "83504", name: "いわき電力メンテナンスセンター" },
      { code: "83505", name: "原ノ町電力メンテナンスセンター" }
    ]},
    { code: 413, name: "千葉支社", items: [
      { code: "83500", name: "千葉電力設備技術センター" },
      { code: "83501", name: "新小岩電力メンテナンスセンター" },
      { code: "83502", name: "西船橋電力メンテナンスセンター" },
      { code: "83503", name: "千葉電力メンテナンスセンター" },
      { code: "83505", name: "一ノ宮電力メンテナンスセンター" },
      { code: "83506", name: "木更津電力メンテナンスセンター" },
      { code: "83508", name: "成田電力メンテナンスセンター" }
    ]},
    { code: 415, name: "大宮支社", items: [
      { code: "83500", name: "大宮電力設備技術センター" },
      { code: "83501", name: "浦和電力メンテナンスセンター" },
      { code: "83502", name: "大宮電力メンテナンスセンター" },
      { code: "83503", name: "宇都宮電力メンテナンスセンター" },
      { code: "83504", name: "那須電力メンテナンスセンター" }
    ]},
    { code: 416, name: "首都圏本部", items: [
      { code: "84500", name: "品川電力設備技術センター" },
      { code: "84501", name: "品川電力設備技術センター" },
      { code: "84600", name: "新宿電力設備技術センター" },
      { code: "84601", name: "新宿電力設備技術センター" },
      { code: "84700", name: "上野電力設備技術センター" },
      { code: "84701", name: "上野電力設備技術センター（我孫子除く）" },
      { code: "84750", name: "上野電力設備技セ　我孫子電力オフィス" }
    ]},
    { code: 417, name: "横浜支社", items: [
      { code: "83500", name: "横浜電力設備技術センター" },
      { code: "83501", name: "鶴見電力メンテナンスセンター" },
      { code: "83502", name: "横浜電力メンテナンスセンター" },
      { code: "83503", name: "大船電力メンテナンスセンター" },
      { code: "83504", name: "小田原電力メンテナンスセンター" },
      { code: "83505", name: "橋本電力メンテナンスセンター" }
    ]},
    { code: 418, name: "八王子支社", items: [
      { code: "83500", name: "八王子電力設備技術センター" },
      { code: "83501", name: "立川電力メンテナンスセンター" },
      { code: "83502", name: "八王子電力メンテナンスセンター" },
      { code: "83503", name: "大月電力メンテナンスセンター" },
      { code: "83504", name: "甲府電力メンテナンスセンター" }
    ]},
    { code: 511, name: "長野支社", items: [
      { code: "83500", name: "長野電力設備技術センター" },
      { code: "83501", name: "長野電力メンテナンスセンター" },
      { code: "83503", name: "松本電力メンテナンスセンター" },
      { code: "83504", name: "上諏訪電力メンテナンスセンター" }
    ]}
  ];

  // Train Loading animation component
  const TrainLoader = () => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <div className="text-4xl animate-bounce mb-2">🚃💨</div>
        <div className="text-slate-700 font-semibold animate-pulse">データを取得・構築しています...</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900 relative">
      {loading && <TrainLoader />}
      
      <header className="bg-white px-6 py-4 shadow-sm z-10 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-slate-800">トロリ線 摩耗状態ダッシュボード (MVP)</h1>
        
        {/* Search / Filter Form */}
        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-md border text-sm">
          <div className="flex flex-col gap-1 w-64">
            <label className="font-semibold text-slate-700">箇所名 (メセ・技セ) <span className="text-red-500">*</span></label>
            <select 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              className="border rounded p-2 bg-white"
            >
              <option value="">-- 箇所を選択してください --</option>
              {mcData.map((branch, bIdx) => (
                <optgroup key={bIdx} label={branch.name}>
                  {branch.items.map((item, iIdx) => (
                    <option key={`${bIdx}-${iIdx}`} value={item.name}>{item.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-64">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700">線区・行路選択</label>
              <div className="flex gap-2 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="lineType" checked={lineType === 'route'} onChange={() => { setLineType('route'); setLineName(''); }} /> 行路
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="lineType" checked={lineType === 'line'} onChange={() => { setLineType('line'); setLineName(''); }} /> 通称線名
                </label>
              </div>
            </div>
            <select 
              value={lineName} 
              onChange={e => setLineName(e.target.value)} 
              className="border rounded p-2 bg-white"
            >
              <option value="">-- 全て --</option>
              {lineType === 'route' 
                ? routeOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)
                : lineOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)
              }
            </select>
          </div>
          <div className="flex flex-col gap-1 w-32">
            <label className="font-semibold text-slate-700">線別</label>
            <select 
              value={direction} 
              onChange={e => setDirection(e.target.value)} 
              className="border rounded p-2 bg-white"
            >
              <option value="">-- 全て --</option>
              {directionOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-48">
            <label className="font-semibold text-slate-700">駅・駅間</label>
            <select 
              value={station} 
              onChange={e => setStation(e.target.value)} 
              className="border rounded p-2 bg-white"
            >
              <option value="">-- 全て --</option>
              {stationOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          </div>
          <button 
            onClick={handleSearch} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded transition-colors h-[38px] flex items-center justify-center"
          >
            検索 / 適用
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-4 gap-4 relative">
        {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-lg shadow-lg">
                <strong className="font-bold">Error:</strong>
                <span className="block sm:inline ml-2">{error}</span>
            </div>
        )}

        {initialLoad ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-300 rounded-lg bg-white/50 backdrop-blur">
            <div className="text-6xl mb-4 text-slate-300">🔍</div>
            <h2 className="text-xl font-semibold mb-2">条件を指定してデータを検索してください</h2>
            <p className="text-sm text-slate-400 max-w-md text-center">
              上部のフィルタパネルから担当する「箇所名」を必ず選択してから、検索ボタンを押してください。データ量が多い場合は描画に数秒かかることがあります。
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
