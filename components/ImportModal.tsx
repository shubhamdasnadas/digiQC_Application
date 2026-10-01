'use client';

import { X, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { parseExcelFile, type ImportResult, type ParsedRow } from '@/lib/excelImport';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  columns?: string[];
  sampleData?: any[];
  onImport: (data: ParsedRow[]) => Promise<ImportResult>;
}

export default function ImportModal({
  isOpen,
  onClose,
  title,
  description = 'Upload an Excel file (.xlsx, .xls) or CSV to import data.',
  onImport
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'].includes(f.type)) {
      setError('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const data = await parseExcelFile(file);
      if (data.length === 0) throw new Error('File is empty or has no data');
      const res = await onImport(data);
      setResult(res);
      if (res.failed === 0) {
        setTimeout(() => {
          setFile(null);
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Upload File</label>
              <div className="relative border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-teal-500 transition-colors">
                  <Upload size={20} />
                  <div>
                    <p className="text-xs font-medium">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-[10px] mt-0.5">Excel (.xlsx, .xls) or CSV</p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-700 dark:text-red-400 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {file && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>File:</strong> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center" disabled={loading}>Cancel</button>
              <button onClick={handleImport} className="btn-primary flex-1 justify-center" disabled={!file || loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl ${result.failed === 0 ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
              <div className="flex items-center gap-3">
                {result.failed === 0 ? (
                  <CheckCircle2 size={20} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                ) : (
                  <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {result.failed === 0 ? 'Import Successful!' : 'Import Completed with Issues'}
                  </p>
                  <p className={`text-sm mt-1 ${result.failed === 0 ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {result.success} records imported{result.failed > 0 ? `, ${result.failed} failed` : ''}
                  </p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Errors ({result.errors.length})</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-500/10 rounded">
                      Row {err.row}: {err.message}
                    </div>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-xs text-gray-400 p-2">... and {result.errors.length - 10} more</p>
                  )}
                </div>
              </div>
            )}

            {result.failed === 0 ? (
              <div className="flex gap-3">
                <button onClick={() => { setResult(null); setFile(null); }} className="btn-secondary flex-1 justify-center">Import Another</button>
                <button onClick={onClose} className="btn-primary flex-1 justify-center">Done</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => { setResult(null); setFile(null); }} className="btn-secondary flex-1 justify-center">Retry</button>
                <button onClick={onClose} className="btn-primary flex-1 justify-center">Close</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
