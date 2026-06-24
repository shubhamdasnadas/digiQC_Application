'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, X, Loader2, Upload, ChevronDown, FileDown } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Team, Organization } from '@/lib/types';

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [form, setForm] = useState({ organization_id: '', name: '', type: 'inspection', team_lead_name: '', spoc_name: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [tRes, oRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/organizations'),
    ]);
    const t = await tRes.json();
    const o = await oRes.json();
    setTeams(t);
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
        name: sanitizeString(r.name || r.team_name || 'Unnamed'),
        type: sanitizeString(r.type || 'inspection'),
        team_lead_name: sanitizeString(r.team_lead_name || r.team_lead || ''),
        spoc_name: sanitizeString(r.spoc_name || r.spoc || ''),
      }));
      const res = await fetch('/api/teams', {
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
    await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  };

  const typeColors: Record<string, string> = { inspection: 'badge-active', audit: 'badge-completed', compliance: 'badge-on_hold' };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{teams.length} teams configured</p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadSampleExcel('teams')} className="btn-secondary"><FileDown size={15} /> Template</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Team</button>
        </div>
      </div>

      {!loading && teams.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Teams Table</h3>
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
                    {['Team Name', 'Type', 'Team Lead', 'SPOC', 'Created'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {teams.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{t.name}</td>
                      <td className="px-5 py-3"><span className={`badge ${typeColors[t.type] ?? 'badge-active'} capitalize text-xs`}>{t.type}</span></td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{t.team_lead_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{t.spoc_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAdd(false)} />
          <div className="relative card w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Team</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Organization</label>
                <select className="input" value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Team Name *</label>
                <input required className="input" placeholder="QC Team Alpha" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="inspection">Inspection</option>
                  <option value="audit">Audit</option>
                  <option value="compliance">Compliance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Team Lead</label>
                  <input className="input" placeholder="Name" value={form.team_lead_name} onChange={e => setForm(f => ({ ...f, team_lead_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">SPOC</label>
                  <input className="input" placeholder="Name" value={form.spoc_name} onChange={e => setForm(f => ({ ...f, spoc_name: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving...' : 'Add Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => { setShowImport(false); load(); }}
        title="Import Teams"
        description="Upload an Excel or CSV file with columns: name, type, team_lead_name, spoc_name"
        onImport={handleImport}
      />
    </div>
  );
}
