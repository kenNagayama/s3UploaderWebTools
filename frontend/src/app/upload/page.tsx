'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

// Common locations from the data
const mcDataList = [
  {
    "code": 211,
    "name": "盛岡支社",
    "items": [
      {
        "code": "83500",
        "name": "盛岡電力設備技術センター",
        "path": "tableau-access/morioka/morioka/"
      },
      {
        "code": "83501",
        "name": "一ノ関電力メンテナンスセンター",
        "path": "tableau-access/morioka/ichinoseki-mc/"
      },
      {
        "code": "83503",
        "name": "盛岡電力メンテナンスセンター",
        "path": "tableau-access/morioka/morioka-mc/"
      },
      {
        "code": "83507",
        "name": "青森電力メンテナンスセンター",
        "path": "tableau-access/morioka/aomori-mc/"
      }
    ]
  },
  {
    "code": 212,
    "name": "秋田支社",
    "items": [
      {
        "code": "83500",
        "name": "秋田電力設備技術センター",
        "path": "tableau-access/akita/akita/"
      },
      {
        "code": "83501",
        "name": "大曲電力メンテナンスセンター",
        "path": "tableau-access/akita/oomagari-mc/"
      },
      {
        "code": "83502",
        "name": "秋田電力メンテナンスセンター",
        "path": "tableau-access/akita/akita-mc/"
      },
      {
        "code": "83504",
        "name": "弘前電力メンテナンスセンター",
        "path": "tableau-access/akita/hirosaki-mc/"
      }
    ]
  },
  {
    "code": 213,
    "name": "仙台支社",
    "items": [
      {
        "code": "83502",
        "name": "郡山電力メンテナンスセンター",
        "path": "tableau-access/sendai/koriyama-mc/"
      },
      {
        "code": "83503",
        "name": "福島電力メンテナンスセンター",
        "path": "tableau-access/sendai/fukushima-mc/"
      },
      {
        "code": "83510",
        "name": "仙台電力設備技術センター",
        "path": "tableau-access/sendai/sendai/"
      },
      {
        "code": "83512",
        "name": "仙台電力メンテナンスセンター",
        "path": "tableau-access/sendai/sendai-mc/"
      },
      {
        "code": "83515",
        "name": "山形電力メンテナンスセンター",
        "path": "tableau-access/sendai/yamagata-mc/"
      }
    ]
  },
  {
    "code": 300,
    "name": "新潟支社",
    "items": [
      {
        "code": "83500",
        "name": "新潟電力設備技術センター",
        "path": "tableau-access/niigata/niigata/"
      },
      {
        "code": "83502",
        "name": "酒田電力メンテナンスセンター",
        "path": "tableau-access/niigata/sakata-mc/"
      },
      {
        "code": "83505",
        "name": "長岡電力メンテナンスセンター",
        "path": "tableau-access/niigata/nagaoka-mc/"
      },
      {
        "code": "83506",
        "name": "新潟電力メンテナンスセンター",
        "path": "tableau-access/niigata/niigata-mc/"
      }
    ]
  },
  {
    "code": 411,
    "name": "高崎支社",
    "items": [
      {
        "code": "83500",
        "name": "高崎電力設備技術センター",
        "path": "tableau-access/takasaki/takasaki/"
      },
      {
        "code": "83501",
        "name": "桶川電力メンテナンスセンター",
        "path": "tableau-access/takasaki/okegawa-mc/"
      },
      {
        "code": "83502",
        "name": "熊谷電力メンテナンスセンター",
        "path": "tableau-access/takasaki/kumagaya-mc/"
      },
      {
        "code": "83503",
        "name": "高崎電力メンテナンスセンター",
        "path": "tableau-access/takasaki/takasaki-mc/"
      }
    ]
  },
  {
    "code": 412,
    "name": "水戸支社",
    "items": [
      {
        "code": "83500",
        "name": "水戸電力設備技術センター",
        "path": "tableau-access/mito/mito/"
      },
      {
        "code": "83501",
        "name": "土浦電力メンテナンスセンター",
        "path": "tableau-access/mito/tsuchiura-mc/"
      },
      {
        "code": "83502",
        "name": "水戸電力メンテナンスセンター",
        "path": "tableau-access/mito/mito-mc/"
      },
      {
        "code": "83504",
        "name": "いわき電力メンテナンスセンター",
        "path": "tableau-access/mito/iwaki-mc/"
      },
      {
        "code": "83505",
        "name": "原ノ町電力メンテナンスセンター",
        "path": "tableau-access/mito/haranomachi-mc/"
      }
    ]
  },
  {
    "code": 413,
    "name": "千葉支社",
    "items": [
      {
        "code": "83500",
        "name": "千葉電力設備技術センター",
        "path": "tableau-access/chiba/chiba/"
      },
      {
        "code": "83501",
        "name": "新小岩電力メンテナンスセンター",
        "path": "tableau-access/chiba/shinkoiwa-mc/"
      },
      {
        "code": "83502",
        "name": "西船橋電力メンテナンスセンター",
        "path": "tableau-access/chiba/nishifunabashi-mc/"
      },
      {
        "code": "83503",
        "name": "千葉電力メンテナンスセンター",
        "path": "tableau-access/chiba/chiba-mc/"
      },
      {
        "code": "83505",
        "name": "一ノ宮電力メンテナンスセンター",
        "path": "tableau-access/chiba/ichinomiya-mc/"
      },
      {
        "code": "83506",
        "name": "木更津電力メンテナンスセンター",
        "path": "tableau-access/chiba/kisarazu-mc/"
      },
      {
        "code": "83508",
        "name": "成田電力メンテナンスセンター",
        "path": "tableau-access/chiba/narita-mc/"
      }
    ]
  },
  {
    "code": 415,
    "name": "大宮支社",
    "items": [
      {
        "code": "83500",
        "name": "大宮電力設備技術センター",
        "path": "tableau-access/omiya/omiya/"
      },
      {
        "code": "83501",
        "name": "浦和電力メンテナンスセンター",
        "path": "tableau-access/omiya/urawa-mc/"
      },
      {
        "code": "83502",
        "name": "大宮電力メンテナンスセンター",
        "path": "tableau-access/omiya/omiya-mc/"
      },
      {
        "code": "83503",
        "name": "宇都宮電力メンテナンスセンター",
        "path": "tableau-access/omiya/utsunomiya-mc/"
      },
      {
        "code": "83504",
        "name": "那須電力メンテナンスセンター",
        "path": "tableau-access/omiya/nasu-mc/"
      }
    ]
  },
  {
    "code": 416,
    "name": "首都圏本部",
    "items": [
      {
        "code": "84500",
        "name": "品川電力設備技術センター",
        "path": "tableau-access/shinagawa/shinagawa/"
      },
      {
        "code": "84501",
        "name": "品川電力設備技術センター",
        "path": "tableau-access/shinagawa/shinagawa-mc/"
      },
      {
        "code": "84600",
        "name": "新宿電力設備技術センター",
        "path": "tableau-access/shinjuku/shinjuku/"
      },
      {
        "code": "84601",
        "name": "新宿電力設備技術センター",
        "path": "tableau-access/shinjuku/shinjuku-mc/"
      },
      {
        "code": "84700",
        "name": "上野電力設備技術センター",
        "path": "tableau-access/ueno/ueno/"
      },
      {
        "code": "84701",
        "name": "上野電力設備技術センター（我孫子除く）",
        "path": "tableau-access/ueno/ueno-not-abiko/"
      },
      {
        "code": "84750",
        "name": "上野電力設備技セ　我孫子電力オフィス",
        "path": "tableau-access/ueno/ueno-abiko/"
      }
    ]
  },
  {
    "code": 417,
    "name": "横浜支社",
    "items": [
      {
        "code": "83500",
        "name": "横浜電力設備技術センター",
        "path": "tableau-access/yokohama/yokohama/"
      },
      {
        "code": "83501",
        "name": "鶴見電力メンテナンスセンター",
        "path": "tableau-access/yokohama/tsurumi-mc/"
      },
      {
        "code": "83502",
        "name": "横浜電力メンテナンスセンター",
        "path": "tableau-access/yokohama/yokohama-mc/"
      },
      {
        "code": "83503",
        "name": "大船電力メンテナンスセンター",
        "path": "tableau-access/yokohama/ofuna-mc/"
      },
      {
        "code": "83504",
        "name": "小田原電力メンテナンスセンター",
        "path": "tableau-access/yokohama/odawara-mc/"
      },
      {
        "code": "83505",
        "name": "橋本電力メンテナンスセンター",
        "path": "tableau-access/yokohama/hashimoto-mc/"
      }
    ]
  },
  {
    "code": 418,
    "name": "八王子支社",
    "items": [
      {
        "code": "83500",
        "name": "八王子電力設備技術センター",
        "path": "tableau-access/hachioji/hachioji/"
      },
      {
        "code": "83501",
        "name": "立川電力メンテナンスセンター",
        "path": "tableau-access/hachioji/tachikawa-mc/"
      },
      {
        "code": "83502",
        "name": "八王子電力メンテナンスセンター",
        "path": "tableau-access/hachioji/hachioji-mc/"
      },
      {
        "code": "83503",
        "name": "大月電力メンテナンスセンター",
        "path": "tableau-access/hachioji/otsuki-mc/"
      },
      {
        "code": "83504",
        "name": "甲府電力メンテナンスセンター",
        "path": "tableau-access/hachioji/kofu-mc/"
      }
    ]
  },
  {
    "code": 511,
    "name": "長野支社",
    "items": [
      {
        "code": "83500",
        "name": "長野電力設備技術センター",
        "path": "tableau-access/nagano/nagano/"
      },
      {
        "code": "83501",
        "name": "長野電力メンテナンスセンター",
        "path": "tableau-access/nagano/nagano-mc/"
      },
      {
        "code": "83503",
        "name": "松本電力メンテナンスセンター",
        "path": "tableau-access/nagano/matsumoto-mc/"
      },
      {
        "code": "83504",
        "name": "上諏訪電力メンテナンスセンター",
        "path": "tableau-access/nagano/kamisuwa-mc/"
      }
    ]
  }
];

type ServerFile = {
  key: string;
  size: number;
  lastModified: string;
};

// Helper to extract CSV header
const getCsvHeader = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        if (file.size === 0) {
            resolve("");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/);
            
            // Search for the header line containing specific keywords
            // Checking first 10 lines to cover metadata rows (usually 1-2 lines)
            for(let i=0; i<Math.min(10, lines.length); i++) {
                const line = lines[i].trim();
                // Remove BOM and double quotes for schema validation
                const cleanLine = line.replace(/^\uFEFF/, '').replace(/"/g, '');
                
                // Check for key columns that must exist in the header
                // Using includes is safer than exact match for robust detection
                if (cleanLine.includes('測定年') && cleanLine.includes('電柱番号')) {
                    resolve(cleanLine);
                    return;
                }
            }
            
            // Fallback: return empty string if no valid header found
            // This will cause checkCsvSchema to fail, which is correct
            resolve("");
        };
        reader.onerror = () => resolve("");
        const slice = file.slice(0, 1024 * 4);
        // Default to Shift_JIS as per legacy system requirement
        reader.readAsText(slice, 'Shift_JIS');
    });
};

export default function UploadPage() {
  const [mcSelect, setMcSelect] = useState('');
  const [prefix, setPrefix] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('待機中...');
  const [logs, setLogs] = useState<{msg: string, type: 'info'|'success'|'error'}[]>([]);
  const [serverFiles, setServerFiles] = useState<ServerFile[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  
  // Using the CloudFront relative path which routes to the backend Lambda URL
  const UPLOAD_API_URL = '/api/upload/';

  // Restore selection from localStorage on mount
  useEffect(() => {
    const savedMc = localStorage.getItem('selectedMc');
    if (savedMc) {
      setMcSelect(savedMc);
      setPrefix(savedMc);
    }
  }, []);

  const log = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setLogs(prev => [...prev, {msg, type}]);
  };

  const handleMcChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setMcSelect(val);
    setPrefix(val);
    
    if (val) {
      localStorage.setItem('selectedMc', val);
    } else {
      localStorage.removeItem('selectedMc');
    }
  };

  // 1. ファイル選択 (フォルダ選択含む想定)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const checkCsvSchema = async (file: File) => {
        const header = await getCsvHeader(file);
        // Simple check: does it look like our expected header?
        // Ideally we should match exact expected columns but for now let's just check for key columns
        if (header.includes('測定年月日') && header.includes('行路名称') && header.includes('電柱番号')) {
            return true;
        }
        console.warn(`Schema check failed for ${file.name}. Header read: ${header}`);
        return false;
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
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET) {
            headers['X-Origin-Verify'] = process.env.NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET;
        }

        const res = await fetch(UPLOAD_API_URL, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            action: 'getUploadUrls',
            fileName: fileName,
            prefix: prefix,
            fileSize: file.size,
            csvHeader: await getCsvHeader(file)
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
        } else if (urlsData.uploadType === 'multipart') {
            // Multipart Upload Implementation
            const parts = urlsData.parts;
            const uploadId = urlsData.uploadId;
            const completeKey = urlsData.objectKey;
            const completedParts = [];
            
            const PART_SIZE = 5 * 1024 * 1024;
            const numParts = parts.length;

            for (const partInfo of parts) {
                const partNumber = partInfo.partNumber;
                const url = partInfo.url;
                const start = (partNumber - 1) * PART_SIZE;
                const end = Math.min(start + PART_SIZE, file.size);
                const blob = file.slice(start, end);

                const putRes = await fetch(url, {
                    method: 'PUT',
                    body: blob
                });

                if (!putRes.ok) throw new Error(`S3 UploadPart Error: ${putRes.statusText} at part ${partNumber}`);

                const eTag = putRes.headers.get("ETag");
                completedParts.push({ ETag: eTag, PartNumber: partNumber });

                // Update progress
                const fileProgress = partNumber / numParts;
                const totalProgress = ((i + fileProgress) / selectedFiles.length) * 100;
                setProgress(totalProgress);
                setProgressText(`File ${i + 1}/${selectedFiles.length}: ${file.name} (Part ${partNumber}/${numParts})`);
            }

            // Complete Multipart Upload
            const completeRes = await fetch(UPLOAD_API_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    action: 'completeUpload',
                    uploadId: uploadId,
                    objectKey: completeKey,
                    parts: completedParts
                })
            });

            if (!completeRes.ok) throw new Error(`Backend Complete Error: ${completeRes.statusText}`);
        } else {
             throw new Error(`Unknown upload type: ${urlsData.uploadType}`);
        }
        
        successCount++;
        log(`Success: ${fileName}`, 'success');
      } catch (err: unknown) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        log(`Error uploading ${fileName}: ${msg}`, 'error');
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
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET) {
        headers['X-Origin-Verify'] = process.env.NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET;
    }

    try {
      const res = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          action: 'listObjects',
          prefix: pre
        })
      });

      if (!res.ok) throw new Error(`Backend Error: ${res.statusText}`);

      const data = await res.json();
      setServerFiles(data.objects || []);
      log(`Fetched ${data.objects?.length || 0} objects for prefix: ${pre}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Error listing objects: ${msg}`, 'error');
      setServerFiles([]);
    } finally {
      setFetchingFiles(false);
    }
  };

  const deleteServerFile = async (key: string) => {
    if (!confirm(`本当に「${key}」を削除しますか？\n(復元にはシステム管理者の作業が必要です)`)) return;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET) {
        headers['X-Origin-Verify'] = process.env.NEXT_PUBLIC_X_ORIGIN_VERIFY_SECRET;
    }

    try {
      const res = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        headers: headers,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Error deleting object ${key}: ${msg}`, 'error');
      alert('ファイルの削除に失敗しました');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900 overflow-y-auto">
      <header className="bg-white px-6 py-4 shadow-sm z-10">
        <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800">Twins デジタルデータ アップロードツール</h1>
            <Link href="/" className="text-blue-600 hover:underline text-sm font-semibold">ダッシュボードへ戻る</Link>
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
                    <option key={`${bIdx}-${iIdx}`} value={item.path}>{item.name}</option>
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
                // @ts-expect-error - webkitdirectory is non-standard but works
                webkitdirectory="true" 
                {...{ directory: "true" }}
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
