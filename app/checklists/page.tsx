'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Plus, X, Loader2, Upload, ChevronDown, FileDown } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Checklist, Project } from '@/lib/types';

export default function Checklists() {
  const [checklists, setChecklists] = useState<(Checklist & { project?: { name: string } })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [form, setForm] = useState({ project_id: '', name: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [clRes, pRes] = await Promise.all([
      fetch('/api/checklists'),
      fetch('/api/projects'),
    ]);
    const cl = await clRes.json();
    const p = await pRes.json();
    setChecklists(cl);
    setProjects(p);
    if (p.length > 0) setForm(f => ({ ...f, project_id: p[0].id }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const proj = projects[0];
      const rows = chunk.map(r => ({
        project_id: proj?.id || '',
        name: sanitizeString(r.name || r.checklist_name || 'Unnamed'),
      }));
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(await res.text());
    }, data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{checklists.length} checklists</p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadSampleExcel('checklists')} className="btn-secondary"><FileDown size={15} /> Template</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Checklist</button>
        </div>
      </div>

      {!loading && checklists.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Checklists Table</h3>
            <button
              onClick={() => setShowTable(!showTable)}
              className="text-teal-600 dark:text-teal-400 text-xs font-medium hover:underline flex items-center gap-1"
            >
              <ChevronDown size={14} className={`transition-transform ${showTable ? 'rotate-180' : ''}`} />
              {showTable ? 'Hide' : 'Show'} Table
            </button>
          </div>
          {showTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {['Checklist Name', 'Linked Project', 'Created'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {checklists.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.project?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
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
          <p className="text-xs mt-1">Create a checklist linked to a project</p>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAdd(false)} />
          <div className="relative card w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Checklist</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Project</label>
                <select className="input" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Checklist Name *</label>
                <input required className="input" placeholder="Structural QC Checklist" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => { setShowImport(false); load(); }}
        title="Import Checklists"
        description="Upload an Excel or CSV file with columns: name, checklist_name"
        onImport={handleImport}
      />
    </div>
  );
}
