import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string; // 'Projects' | 'Teams' | 'Organizations' | 'Checklists'
  onImportSubmit: (rows: any[]) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  entityName,
  onImportSubmit,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    let headers: string[] = [];
    let sampleData: any[] = [];

    if (entityName === 'Projects') {
      headers = ['Name', 'Unique Code', 'Client Name', 'Nomenclature', 'Profile', 'Status'];
      sampleData = [
        ['AURORA Tower B', 'PCPL-AUR-B-2026', 'Sunrise Realty', 'AUR-T2', 'High-Rise Civil', 'active'],
        ['MERIDIAN Plaza', 'PCPL-MER-2026', 'Meridian Corp', 'MER-P1', 'Commercial Glazing', 'active'],
      ];
    } else if (entityName === 'Teams') {
      headers = ['Name', 'Type', 'Team Lead Name', 'SPOC Name', 'Active Assigned Projects'];
      sampleData = [
        ['Structural Quality Cell', 'inspection', 'Sarvesh Gupta', 'Mayuresh Jadhav', 'AURORA Tower A, 42 AURA'],
        ['Fire Safety Audit Team', 'compliance', 'Vishal Kadam', 'Pankti Mehta', 'FALCON CREST'],
      ];
    } else if (entityName === 'Organizations') {
      headers = ['Name', 'Licensing', 'User Limit', 'Expiry Date'];
      sampleData = [
        ['Shree Infrastructure Ltd', 'Enterprise', '50', '2027-12-31'],
        ['Urban Apex Builders', 'Professional', '20', '2026-11-30'],
      ];
    } else {
      headers = ['Name', 'Reference Number', 'UOM', 'Stage Name', 'Checkpoint Question', 'Input Type'];
      sampleData = [
        ['Arch - Beam & Slab Checking', 'PCPL/ARCH/BEAM-SLAB/2026/01', 'Slab Pour (Sft)', 'Pre-Concreting', 'Slab shuttering level verified?', 'yes_no'],
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${entityName.toLowerCase()}_import_template.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws);
        setParsedRows(rows);
      } catch (err) {
        console.error('Failed to parse file:', err);
        setStatusMessage('Error parsing file format. Ensure it is a valid .xlsx, .xls or .csv file.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleProcessImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      await onImportSubmit(parsedRows);
      setStatusMessage(`Successfully imported ${parsedRows.length} records!`);
      setTimeout(() => {
        setIsProcessing(false);
        setFile(null);
        setParsedRows([]);
        onClose();
      }, 1200);
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage(`Import failed: ${err.message || 'Server error'}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Import ${entityName} (Excel / CSV)`}>
      <div className="space-y-6">
        {/* Step 1: Download Sample Template */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-teal-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-200">1. Download Sample Excel Template</div>
              <div className="text-[11px] text-slate-400">Pre-formatted header structure for bulk data ingestion</div>
            </div>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-teal-400 rounded-lg flex items-center gap-1.5 transition shrink-0"
            id="download-template-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
        </div>

        {/* Step 2: Upload File */}
        <div className="border-2 border-dashed border-slate-700 hover:border-teal-500/60 rounded-xl p-6 text-center bg-slate-950/30 transition">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
            id="excel-file-input"
          />
          <label htmlFor="excel-file-input" className="cursor-pointer flex flex-col items-center">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-xs font-semibold text-slate-200">
              {file ? file.name : 'Click to select or drag .xlsx / .csv file'}
            </span>
            <span className="text-[10px] text-slate-500 mt-1">Maximum file size 10MB</span>
          </label>
        </div>

        {/* Parse Summary */}
        {parsedRows.length > 0 && (
          <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center justify-between text-xs text-teal-300">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              Ready to import {parsedRows.length} rows
            </span>
            <span className="text-[10px] bg-teal-500/20 px-2 py-0.5 rounded font-mono">
              Batch size: 100
            </span>
          </div>
        )}

        {/* Status Alert */}
        {statusMessage && (
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center gap-2 text-xs text-slate-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProcessImport}
            disabled={parsedRows.length === 0 || isProcessing}
            className="px-5 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-teal-500/20 flex items-center gap-2 transition"
            id="execute-import-btn"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Start Bulk Import'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
