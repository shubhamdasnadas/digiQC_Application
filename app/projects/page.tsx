'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, Plus, Search, Upload, X, Loader2, ChevronDown, FileDown } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Project, Organization } from '@/lib/types';

const statusOptions = ['all', 'active', 'completed', 'on_hold'];
const statusLabel: Record<string, string> = { all: 'All', active: 'Active', completed: 'Completed', on_hold: 'On Hold' };

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [form, setForm] = useState({
    organization_id: '',
    name: '',
    nomenclature: '',
    instruction: '',
    profile: '',
    image_url: '',
    status: 'active' as Project['status'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [pRes, oRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/organizations'),
    ]);
    const p = await pRes.json();
    const o = await oRes.json();
    setProjects(p);
    setOrgs(o);
    if (o.length > 0) setForm(f => ({ ...f, organization_id: o[0].id }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const org = orgs[0];
      const rows = chunk.map(r => ({
        organization_id: org?.id || '',
        name: sanitizeString(r.name || r.project_name || 'Unnamed'),
        nomenclature: sanitizeString(r.nomenclature || r.code || ''),
        instruction: sanitizeString(r.instruction || r.description || ''),
        profile: sanitizeString(r.profile || r.type || ''),
        image_url: sanitizeString(r.image_url || r.image || ''),
        status: (r.status || 'active').toLowerCase(),
      }));
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(await res.text());
    }, data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required.'); return; }
    setSaving(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); return; }
    setShowAdd(false);
    setError('');
    load();
  };

  const filtered = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.nomenclature.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const badgeClass: Record<string, string> = { active: 'badge-active', completed: 'badge-completed', on_hold: 'badge-on_hold' };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search projects..."
              className="input pl-8 w-48"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {statusOptions.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadSampleExcel('projects')} className="btn-secondary"><FileDown size={15} /> Template</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Project</button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        {loading ? 'Loading...' : `Showing ${filtered.length} of ${projects.length} projects`}
      </p>

      {!loading && filtered.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Projects Table</h3>
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
                    {['Project Name', 'Code', 'Profile', 'Status', 'Created', 'Instruction'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium text-sm">{p.name}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.nomenclature || '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">{p.profile || '—'}</td>
                      <td className="px-5 py-3"><span className={`badge ${badgeClass[p.status] ?? 'badge-active'} text-xs`}>{statusLabel[p.status] ?? p.status}</span></td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs max-w-xs truncate">{p.instruction || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <FolderKanban size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">No projects found</p>
          <p className="text-xs mt-1">Try adjusting your filters or add a new project</p>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAdd(false)} />
          <div className="relative card w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Project</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Organization</label>
                <select className="input" value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Project Name *</label>
                  <input className="input" placeholder="Block-A Foundation" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nomenclature</label>
                  <input className="input" placeholder="BLK-A-001" value={form.nomenclature} onChange={e => setForm(f => ({ ...f, nomenclature: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Image URL</label>
                <input className="input" placeholder="https://images.pexels.com/..." value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                {form.image_url && (
                  <div className="mt-2 h-24 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={() => setForm(f => ({ ...f, image_url: '' }))} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Instruction</label>
                <textarea className="input resize-none" rows={2} placeholder="QC instructions..." value={form.instruction} onChange={e => setForm(f => ({ ...f, instruction: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Profile</label>
                  <input className="input" placeholder="Civil structural" value={form.profile} onChange={e => setForm(f => ({ ...f, profile: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Project['status'] }))}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving...' : 'Add Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => { setShowImport(false); load(); }}
        title="Import Projects"
        description="Upload an Excel or CSV file with columns: name, nomenclature, instruction, profile, image_url, status"
        onImport={handleImport}
      />
    </div>
  );
}
