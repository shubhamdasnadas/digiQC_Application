'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, X, Loader2, Upload, ChevronDown, FileDown, Edit2, Copy, Trash2, Download } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import EditChecklistModal from '@/components/EditChecklistModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString, parseBoolean, getField } from '@/lib/excelImport';
import { exportToXlsx } from '@/lib/excelExport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Checklist, Project } from '@/lib/types';

export default function Checklists() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<(Checklist & { project?: { name: string } })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [form, setForm] = useState({ project_id: '', name: '', uom: '', reference_number: '', template_id: '' });
  const [isTemplate, setIsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [clRes, pRes] = await Promise.all([
      fetch('/api/checklists'),
      fetch('/api/projects'),
    ]);
    const cl = await clRes.json();
    const p = await pRes.json();
    setChecklists(Array.isArray(cl) ? cl : []);
    setProjects(Array.isArray(p) ? p : []);
    if (p.length > 0) setForm(f => ({ ...f, project_id: p[0].id }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showAdd && !editingChecklist) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAdd(false);
        setEditingChecklist(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdd, editingChecklist]);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    let lastChecklistName = '';
    let lastRefNum = '';
    let lastStageName = 'Single Stage';

    const normalizedData = data.map(r => {
      let name = sanitizeString(getField(r, 'Checklist Name', 'Checklist', 'checklist_name', 'checklist', 'name', 'Name'));
      let refNum = sanitizeString(getField(r, 'REFERENCE NUMBER', 'Reference Number', 'Reference No', 'reference_number', 'reference_no', 'Ref No', 'ref_no'));
      let stageName = sanitizeString(getField(r, 'Stage Name', 'Stage', 'stage_name', 'stage'));
      const checkpoint = sanitizeString(getField(r, 'Checkpoint', 'checkpoint', 'Checkpoint Name', 'checkpoint_name', 'Question', 'question'));

      if (name) {
        lastChecklistName = name;
      } else if (checkpoint && lastChecklistName) {
        name = lastChecklistName;
      }

      if (refNum) {
        lastRefNum = refNum;
      } else if (checkpoint && lastRefNum && name === lastChecklistName) {
        refNum = lastRefNum;
      }

      if (stageName) {
        lastStageName = stageName;
      } else if (checkpoint && lastStageName) {
        stageName = lastStageName;
      }

      const rawType = sanitizeString(getField(r, 'Type', 'type', 'yn', 'Input Type', 'input_type') || 'yes_no');
      const uom = sanitizeString(getField(r, 'UOM', 'uom', 'Unit', 'unit') || '');

      let inputType: 'yes_no' | 'text' | 'numeric' | 'options' | 'date' = 'yes_no';
      const typeUpper = rawType.toUpperCase().trim();
      if (typeUpper === 'TEXT' || typeUpper === 'STRING') {
        inputType = 'text';
      } else if (typeUpper === 'NUMERIC' || typeUpper === 'NUMBER') {
        inputType = 'numeric';
      } else if (typeUpper === 'DATE') {
        inputType = 'date';
      } else if (typeUpper === 'OPTIONS') {
        inputType = 'options';
      } else {
        inputType = 'yes_no';
      }

      const photoRaw = getField(r, 'Photo', 'photo', 'Photo Required', 'photo_required');
      const remarkRaw = getField(r, 'Remark', 'remark', 'Remark Required', 'remark_required');

      return {
        project_id: null,
        name: name || lastChecklistName || 'Unnamed Checklist',
        reference_number: refNum || '',
        uom,
        stage_name: stageName || lastStageName || 'Single Stage',
        checkpoint,
        input_type: inputType,
        photo_required: parseBoolean(photoRaw),
        remark_required: parseBoolean(remarkRaw),
      };
    }).filter(r => r.name && (r.checkpoint || r.stage_name));

    return bulkInsertWithChunking(async (chunk) => {
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: chunk }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (await res.text()) || 'Failed to import checklists');
      }
    }, normalizedData);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAdd(false);
    setForm({ project_id: projects[0]?.id || '', name: '', uom: '', reference_number: '', template_id: '' });
    load();
  };

  const handleDelete = async (c: Checklist, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete checklist "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/checklists/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete checklist');
      load();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete checklist.');
    }
  };

  const handleCopy = async (c: Checklist, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      // Fetch details of this checklist
      const res = await fetch(`/api/checklists/${c.id}`);
      if (!res.ok) throw new Error('Failed to fetch checklist details');
      const detail = await res.json();

      // Create new checklist with (Copy) name
      const copyName = `${c.name} (Copy)`;
      const clRes = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: copyName,
          reference_number: c.reference_number ? `${c.reference_number}-COPY` : null,
          uom: c.uom,
          project_id: c.project_id || null,
          library_checklist_id: c.id,
        }),
      });

      if (!clRes.ok) throw new Error('Failed to copy checklist');

      // Reload and open the new list
      await load();
    } catch (err) {
      console.error('Copy error:', err);
      alert('Failed to copy checklist.');
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/checklists?export=true');
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          exportToXlsx(rows, 'valid8-checklists');
          return;
        }
      }
      // Fallback to table metadata export if detailed query is empty
      const fallbackRows = checklists.map(c => ({
        'Checklist Name': c.name,
        'REFERENCE NUMBER': c.reference_number || '',
        'UOM': c.uom || '',
        'Status': c.status === 'live' ? 'Live' : 'Draft',
        'Updated By': c.updated_by || 'Admin',
        'Updated At': c.updated_at ? new Date(c.updated_at).toLocaleString('en-IN') : new Date(c.created_at).toLocaleString('en-IN'),
      }));
      if (fallbackRows.length > 0) {
        exportToXlsx(fallbackRows, 'valid8-checklists');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export checklists.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{checklists.length} checklists</p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadSampleExcel('checklists')} className="btn-secondary flex items-center gap-1.5"><FileDown size={15} /> Template</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5"><Upload size={15} /> Import</button>
          <button onClick={handleExport} disabled={exporting || checklists.length === 0} className="btn-secondary flex items-center gap-1.5">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5"><Plus size={15} /> Add Checklist</button>
        </div>
      </div>

      {!loading && checklists.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Checklists Table</h3>
            <button
              onClick={() => setShowTable(!showTable)}
              className="text-orange-500 dark:text-orange-400 text-xs font-medium hover:underline flex items-center gap-1"
            >
              <ChevronDown size={14} className={`transition-transform ${showTable ? 'rotate-180' : ''}`} />
              {showTable ? 'Hide' : 'Show'} Table
            </button>
          </div>
          {showTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr className="text-[11px] uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400 w-10">#</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Checklist</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">UOM</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reference Number</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Updated By</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Updated At</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {checklists.map((c, idx) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/checklists/${c.id}?name=${encodeURIComponent(c.name)}`)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium text-sm">{c.name}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.uom ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.reference_number ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {c.status === 'live' ? 'Live' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.updated_by ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {c.updated_at ? new Date(c.updated_at).toLocaleString('en-IN') : new Date(c.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChecklist(c);
                            }}
                            className="p-1 hover:text-orange-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(c, e)}
                            className="p-1 hover:text-orange-500 transition-colors"
                            title="Copy"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(c, e)}
                            className="p-1 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      )}

      {!loading && checklists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <ClipboardList size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">No checklists yet</p>
          <p className="text-xs mt-1">Create a checklist to get started</p>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Checklist</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    <span className="text-red-500 mr-1">*</span> Name
                  </label>
                  <input
                    required
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    placeholder="Enter Name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    <span className="text-red-500 mr-1">*</span> UOM
                  </label>
                  <div className="relative">
                    <select
                      required
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 appearance-none transition-all"
                      value={form.uom}
                      onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                    >
                      <option value="">Select UOM</option>
                      <option value="m">Meters (m)</option>
                      <option value="mm">Millimeters (mm)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="nos">Numbers (nos)</option>
                      <option value="sqm">Square Meters (sqm)</option>
                      <option value="cum">Cubic Meters (cum)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reference Number</label>
                  <input
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    placeholder="Reference Number"
                    value={form.reference_number}
                    onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Create Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingChecklist && (
        <EditChecklistModal
          isOpen={!!editingChecklist}
          onClose={() => setEditingChecklist(null)}
          onSaved={load}
          checklistId={editingChecklist.id}
          checklist={editingChecklist}
        />
      )}

      {showImport && (
        <ImportModal
          isOpen={showImport}
          onClose={() => {
            setShowImport(false);
            load();
          }}
          onImport={handleImport}
          title="Import Checklists"
          description="Upload an Excel file (.xlsx, .xls) or CSV containing Checklist Name, REFERENCE NUMBER, Stage Name, Checkpoint, Type, Photo, and Remark columns."
          columns={['Checklist Name', 'REFERENCE NUMBER', 'Stage Name', 'Checkpoint', 'Type', 'Photo', 'Remark', 'UOM']}
          sampleData={[
            {
              'Checklist Name': 'Arch - Beam & Slab Checking',
              'REFERENCE NUMBER': 'PCPL/ARCH/BEAM-SLAB-SHT/2024/0001',
              'Stage Name': 'Single Stage',
              'Checkpoint': 'Slab Shuttering Measurements checked properly?',
              'Type': 'Y/N',
              'Photo': 'FALSE',
              'Remark': 'TRUE',
              'UOM': '',
            }
          ]}
        />
      )}
    </div>
  );
}
