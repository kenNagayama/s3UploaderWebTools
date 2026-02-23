'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';

// Common locations from the data
const mcDataList = [
  { code: 318, name: "福島支社", items: [ { code: "83500", name: "福島電力設備技術センター" }, { code: "83501", name: "福島電力メンテナンスセンター" }, { code: "83502", name: "郡山電力メンテナンスセンター" }, { code: "83503", name: "会津若松電力メンテナンスセンター" }, { code: "83504", name: "原ノ町電力メンテナンスセンター" } ]},
  { code: 319, name: "水戸支社", items: [ { code: "83500", name: "水戸電力設備技術センター" }, { code: "83501", name: "水戸電力メンテナンスセンター" }, { code: "83502", name: "勝田電力メンテナンスセンター" }, { code: "83503", name: "土浦電力メンテナンスセンター" } ]},
  { code: 320, name: "千葉支社", items: [ { code: "83500", name: "千葉電力設備技術センター" }, { code: "83501", name: "千葉電力メンテナンスセンター" }, { code: "83502", name: "木更津電力メンテナンスセンター" }, { code: "83503", name: "成田電力メンテナンスセンター" }, { code: "83504", name: "勝浦電力メンテナンスセンター" } ]},
  { code: 416, name: "首都圏本部", items: [ { code: "84400", name: "大宮電力設備技術センター" }, { code: "84401", name: "大宮電力メンテナンスセンター" }, { code: "84402", name: "大宮電力設備技術センター（宇都宮除く）" }, { code: "84403", name: "熊谷電力メンテナンスセンター" }, { code: "84450", name: "大宮電力設備技セ　宇都宮電力オフィス" }, { code: "84451", name: "宇都宮電力メンテナンスセンター" }, { code: "84500", name: "品川電力設備技術センター" }, { code: "84501", name: "品川電力設備技術センター" }, { code: "84600", name: "新宿電力設備技術センター" }, { code: "84601", name: "新宿電力設備技術センター" }, { code: "84700", name: "上野電力設備技術センター" }, { code: "84701", name: "上野電力設備技術センター（我孫子除く）" }, { code: "84750", name: "上野電力設備技セ　我孫子電力オフィス" } ]},
  { code: 417, name: "横浜支社", items: [ { code: "83500", name: "横浜電力設備技術センター" }, { code: "83501", name: "鶴見電力メンテナンスセンター" }, { code: "83502", name: "横浜電力メンテナンスセンター" }, { code: "83503", name: "大船電力メンテナンスセンター" }, { code: "83504", name: "小田原電力メンテナンスセンター" }, { code: "83505", name: "橋本電力メンテナンスセンター" } ]},
  { code: 418, name: "八王子支社", items: [ { code: "83500", name: "八王子電力設備技術センター" }, { code: "83501", name: "立川電力メンテナンスセンター" }, { code: "83502", name: "八王子電力メンテナンスセンター" }, { code: "83503", name: "大月電力メンテナンスセンター" }, { code: "83504", name: "甲府電力メンテナンスセンター" } ]},
  { code: 511, name: "長野支社", items: [ { code: "83500", name: "長野電力設備技術センター" }, { code: "83501", name: "長野電力メンテナンスセンター" }, { code: "83503", name: "松本電力メンテナンスセンター" }, { code: "83504", name: "上諏訪電力メンテナンスセンター" } ]}
];

// Mapping to S3 prefix
const centerMap: Record<string, string> = {};
mcDataList.forEach(branch => {
  branch.items.forEach(item => {
    centerMap[item.name] = `tableau-access/${branch.name}/${item.name}/`;
  });
});

export default function UploadPage() {
  const [mcSelect, setMcSelect] = useState('');
  const [prefix, setPrefix] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('待機中...');
  const [logs, setLogs] = useState<{msg: string, type: 'info'|'success'|'error'}[]>([]);
  const [serverFiles, setServerFiles] = useState<any[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  
  // Using the CloudFront relative path which routes to the backend Lambda URL
  const UPLOAD_API_URL = '/api/upload/';

  const log = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setLogs(prev => [...prev, {msg, type}]);
  };

  const handleMcChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setMcSelect(val);
    setPrefix(centerMap[val] || 'tableau-access/common/share/');
  };

  // 1. ファイル選択 (フォルダ選択含む想定)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Schema check function directly migrated from index.html
    const checkCsvSchema = async (file: File) => {
        return new Promise<boolean>((resolve) => {
            if (file.size === 0) {
                resolve(false);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const lines = text.split('\n');
                let foundHeader = false;
                const maxLinesToCheck = Math.min(5, lines.length);

                for (let i = 0; i < maxLinesToCheck; i++) {
                    const line = lines[i].trim();
                    if (line.includes('測定年月日') && line.includes('行路名称') && line.includes('電柱番号')) {
                        foundHeader = true;
                        break;
                    }
                }
                resolve(foundHeader);
            };
            reader.onerror = () => resolve(false);
            const slice = file.slice(0, 1024 * 4);
            reader.readAsText(slice);
        });
    };

    const processFiles = async () => {
      const validFiles: File[] = [];
      for (const file of files) {
          // ignore files in subdirectories by checking webkitRelativePath
          if (file.webkitRelativePath) {
              const pathParts = file.webkitRelativePath.split('/');
              if (pathParts.length > 2) {
                  log(`Skipping subfolder file: ${file.name}`);
                  continue;
              }
          }

          if (!file.name.toLowerCase().endsWith('.csv')) {
              log(`Skipping non-CSV file: ${file.name}`);
              continue;
          }
          if (file.name.startsWith('._') || file.name === '.DS_Store') {
              log(`Skipping system file: ${file.name}`);
              continue;
          }

          const isValidSchema = await checkCsvSchema(file);
          if (isValidSchema) {
              validFiles.push(file);
          } else {
              log(`Skipping CSV with invalid schema: ${file.name}`, 'error');
          }
      }
      setSelectedFiles(validFiles);
    };
    
    processFiles();
  };

  const handleUpload = async () => {
    if (!mcSelect) {
      alert("アップロード先を選択してください");
      return;
    }
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(0);
    setProgressText('アップロード準備中...');
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileName = file.name;
      const objectKey = prefix + fileName;
      
      try {
        log(`Uploading ${fileName}...`);
        
        // 1. Ask backend for presigned URL
        const res = await fetch(UPLOAD_API_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'getPresignedUrl',
            objectKey: objectKey,
            contentType: file.type || 'text/csv',
            size: file.size
          })
        });

        if (!res.ok) throw new Error(`Backend Error: ${res.statusText}`);
        const urlsData = await res.json();

        // 2. Upload to S3
        if (urlsData.uploadType === 'single') {
          const putRes = await fetch(urlsData.url, {
            method: 'PUT',
            body: file
          });
          if (!putRes.ok) throw new Error(`S3 Put Error: ${putRes.statusText}`);

          const percent = ((i + 1) / selectedFiles.length) * 100;
          setProgress(percent);
          setProgressText(`File ${i + 1}/${selectedFiles.length}: ${file.name}`);
        } else {
            // omitted multipart upload implementation for simplicity as MVP
            throw new Error("Multipart upload not fully migrated to NextJS yet. Files > 50MB maybe fail.");
        }
        
        successCount++;
        log(`Success: ${fileName}`, 'success');
      } catch (err: any) {
        errorCount++;
        log(`Error uploading ${fileName}: ${err.message}`, 'error');
      }
    }
    
    setUploading(false);
    setProgress(100);
    setProgressText(`完了! 成功: ${successCount}, エラー: ${errorCount}`);
    alert(`アップロードが完了しました (${successCount}件)`);
    fetchServerFiles();
  };

  const fetchServerFiles = async () => {
    let pre = prefix.trim().replace(/[\\¥]/g, '/');
    if (!pre) return;
    if (!pre.endsWith('/')) pre += '/';

    setFetchingFiles(true);
    try {
      const res = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'listObjects',
          prefix: pre
        })
      });

      if (!res.ok) throw new Error(`Backend Error: ${res.statusText}`);

      const data = await res.json();
      setServerFiles(data.objects || []);
      log(`Fetched ${data.objects?.length || 0} objects for prefix: ${pre}`);
    } catch (err: any) {
      log(`Error listing objects: ${err.message}`, 'error');
      setServerFiles([]);
    } finally {
      setFetchingFiles(false);
    }
  };

  const deleteServerFile = async (key: string) => {
    if (!confirm(`本当に「${key}」を削除しますか？\n(復元にはシステム管理者の作業が必要です)`)) return;

    try {
      const res = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteObject',
          objectKey: key
        })
      });

      if (!res.ok) throw new Error(`Backend Error: ${res.statusText}`);
      log(`Deleted object: ${key}`, 'success');
      
      // Remove from list
      setServerFiles(prev => prev.filter(f => f.key !== key));
      alert('ファイルを削除しました');
    } catch (err: any) {
      log(`Error deleting object ${key}: ${err.message}`, 'error');
      alert('ファイルの削除に失敗しました');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900 overflow-y-auto">
      <header className="bg-white px-6 py-4 shadow-sm z-10">
        <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800">Twins デジタルデータ アップロードツール</h1>
            <a href="/" className="text-blue-600 hover:underline text-sm font-semibold">ダッシュボードへ戻る</a>
        </div>
        <p className="text-sm text-slate-500 mt-1">軽技Webから出力したCSVをTableau用にAmazon S3にアップロードするツール</p>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col gap-6">
        {/* Upload Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col gap-4">
          
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-slate-700 text-sm">技セ・メセを選択 <span className="text-red-500">*</span></label>
            <select value={mcSelect} onChange={handleMcChange} className="border rounded-md p-2 bg-slate-50">
              <option value="">-- 箇所を選択してください --</option>
              {mcDataList.map((branch, bIdx) => (
                <optgroup key={bIdx} label={branch.name}>
                  {branch.items.map((item, iIdx) => (
                    <option key={`${bIdx}-${iIdx}`} value={item.name}>{item.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-semibold text-slate-700 text-sm">アップロード先フォルダ</label>
            <input 
                type="text" 
                value={prefix} 
                disabled 
                className="border rounded-md p-2 bg-slate-100 text-slate-500 cursor-not-allowed" 
                placeholder="-- 自動入力 --"
            />
          </div>

          <div className="flex flex-col gap-2 mt-4 border-t pt-4">
            <label className="font-semibold text-slate-700 text-sm">CSVファイルを格納したフォルダを選択</label>
            <input 
                type="file" 
                // @ts-ignore - webkitdirectory is non-standard but works
                webkitdirectory="true" 
                directory="true" 
                multiple 
                onChange={handleFileChange} 
                className="border rounded-md p-2"
            />
            
            {selectedFiles.length > 0 && (
                <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md mt-2">
                    <p className="font-semibold mb-1">{selectedFiles.length}個の有効なCSVファイルが選択されました</p>
                    <ul className="list-disc pl-5 max-h-32 overflow-y-auto">
                        {selectedFiles.slice(0, 5).map((f, i) => <li key={i}>{f.name}</li>)}
                        {selectedFiles.length > 5 && <li>...他 {selectedFiles.length - 5} 個</li>}
                    </ul>
                </div>
            )}
          </div>

          <button 
            onClick={handleUpload} 
            disabled={uploading || selectedFiles.length === 0 || !mcSelect}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'アップロード中...' : `${selectedFiles.length} 個のファイルをアップロード`}
          </button>

          {/* Progress Bar */}
          {(uploading || progress === 100) && (
             <div className="mt-4 flex flex-col gap-1">
                 <div className="flex justify-between text-xs text-slate-600">
                     <span>{progressText}</span>
                     <span>{Math.round(progress)}%</span>
                 </div>
                 <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                 </div>
             </div>
          )}

        </div>

        {/* Server Files Explorer */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">サーバー上のファイル管理</h2>
                  <p className="text-xs text-slate-500 mt-1">選択した「アップロード先フォルダ」配下のファイルを表示します。</p>
                </div>
                <button 
                    onClick={fetchServerFiles}
                    disabled={fetchingFiles || !prefix}
                    className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-md font-medium disabled:opacity-50 text-sm"
                >
                    {fetchingFiles ? '取得中...' : 'ファイル一覧を取得'}
                </button>
            </div>

            <div className="overflow-x-auto rounded-md border mt-2">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                        <tr>
                            <th className="px-4 py-3 font-semibold">ファイル名</th>
                            <th className="px-4 py-3 font-semibold">サイズ</th>
                            <th className="px-4 py-3 font-semibold">更新日時</th>
                            <th className="px-4 py-3 font-semibold w-24">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {serverFiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                    {prefix ? 'ファイルは見つかりませんでした' : 'アップロード先を選択して「ファイル一覧を取得」を押してください'}
                                </td>
                            </tr>
                        ) : (
                            serverFiles.map((f, i) => (
                                <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{
                                        f.key.startsWith(prefix) ? f.key.slice(prefix.length) : f.key
                                    }</td>
                                    <td className="px-4 py-3 text-slate-500">{(f.size / 1024).toFixed(1)} KB</td>
                                    <td className="px-4 py-3 text-slate-500">{new Date(f.lastModified).toLocaleString('ja-JP')}</td>
                                    <td className="px-4 py-3">
                                        <button 
                                            onClick={() => deleteServerFile(f.key)}
                                            className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-transparent hover:border-red-200"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </main>
    </div>
  );
}
