'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, X, Loader2, Upload, ChevronDown, FileDown, Download } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import { exportToXlsx } from '@/lib/excelExport';
import type { Team, Organization, Member } from '@/lib/types';

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({ organization_id: '', name: '', type: 'inspection', team_lead_name: '', spoc_name: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [tRes, oRes, mRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/organizations'),
        fetch('/api/members'),
      ]);
      const t = await tRes.json();
      const o = await oRes.json();
      const m = await mRes.json();
      setTeams(Array.isArray(t) ? t : []);
      setOrgs(Array.isArray(o) ? o : []);
      setMembers(Array.isArray(m) ? m : []);
      if (Array.isArray(o) && o.length > 0) setForm(f => ({ ...f, organization_id: o[0].id }));
    } catch (err) {
      console.error('Failed to load teams data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const org = orgs[0];
      const rows = chunk.map(r => ({
        organization_id: org?.id || '',
        name: sanitizeString(r.name || r.team_name || r.Name || 'Unnamed'),
        type: sanitizeString(r.type || r.Type || 'inspection'),
        team_lead_name: sanitizeString(r.team_lead_name || r.team_lead || ''),
        spoc_name: sanitizeString(r.spoc_name || r.spoc || ''),
        active_projects: sanitizeString(r.active_projects || r['Active Assigned Projects'] || ''),
        inactive_projects: sanitizeString(r.inactive_projects || r['Inactive Assigned Projects'] || ''),
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

  const formatProjectList = (value: string | null | undefined, visible: number = 3) => {
    const items = (value || '').split(',').map(s => s.trim()).filter(Boolean);
    if (items.length <= visible) return items.join(', ') || '—';
    return `${items.slice(0, visible).join(', ')} + ${items.length - visible} others`;
  };

  const membersOfTeam = (team: Team) =>
    (Array.isArray(members) ? members : []).filter(m => (m.teams || '').split(',').map(s => s.trim().toLowerCase()).includes(team.name.trim().toLowerCase()));

  const exportRows = () => teams.map(t => ({
    Name: t.name,
    Type: t.type,
    'Team Lead': t.team_lead_name,
    SPOC: t.spoc_name,
    'Active Assigned Projects': t.active_projects,
    'Inactive Assigned Projects': t.inactive_projects,
  }));

  return (
    <div className="p-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">{teams.length} teams configured</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => downloadSampleExcel('teams')} className="btn-secondary"><FileDown size={15} /> Template</button>
              <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
              <button onClick={() => exportRows().length && exportToXlsx(exportRows(), 'digiqc-teams')} className="btn-secondary"><Download size={15} /> Export XLSX</button>
              <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Team</button>
            </div>
          </div>
          {!loading && teams.length > 0 && (
            <div className="card">
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
                        {['Team Name', 'Type', 'Team Lead', 'SPOC', 'Active Projects', 'Inactive Projects', 'Created'].map(h => (
                          <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {teams.map(t => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTeam(t)}
                          className={`cursor-pointer transition-colors ${selectedTeam?.id === t.id ? 'bg-teal-50 dark:bg-teal-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                        >
                          <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{t.name}</td>
                          <td className="px-5 py-3"><span className={`badge ${typeColors[t.type] ?? 'badge-active'} capitalize text-xs`}>{t.type}</span></td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{t.team_lead_name || '—'}</td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{t.spoc_name || '—'}</td>
                          <td className="px-5 py-3 text-xs max-w-xs">
                            <div className="relative group inline-block max-w-full">
                              <span className="text-gray-600 dark:text-gray-300 truncate block underline decoration-dotted decoration-gray-400 underline-offset-2 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                                {formatProjectList(t.active_projects)}
                              </span>
                              {t.active_projects && (
                                <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 max-w-xs opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-top-left">
                                  <div className="rounded-lg bg-gray-900 dark:bg-gray-800 text-white text-xs leading-relaxed p-3 shadow-xl border border-gray-800 dark:border-gray-700">
                                    {t.active_projects}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs max-w-xs truncate" title={t.inactive_projects}>{formatProjectList(t.inactive_projects)}</td>
                          <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          {selectedTeam ? (
            <div className="card">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedTeam.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{membersOfTeam(selectedTeam).length} member{membersOfTeam(selectedTeam).length === 1 ? '' : 's'}</p>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[32rem] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {membersOfTeam(selectedTeam).length === 0 ? (
                  <p className="p-5 text-sm text-gray-500 dark:text-gray-400">No members found for this team.</p>
                ) : (
                  membersOfTeam(selectedTeam).map(m => (
                    <div key={m.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email}</p>
                        {m.phone && <p className="text-xs text-gray-500 dark:text-gray-400">{m.phone}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`badge ${m.active ? 'badge-active' : 'badge-on_hold'} text-xs`}>{m.active ? 'Active' : 'Inactive'}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{m.access_type}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card p-10 flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
              <Users size={28} className="mb-3 opacity-50" />
              <p className="text-sm">Click a team on the left to view its members</p>
            </div>
          )}
        </div>
      </div>

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
        description="Upload an Excel or CSV file with columns: Name, Type, Team Lead, SPOC, Active Assigned Projects, Inactive Assigned Projects"
        onImport={handleImport}
      />
    </div>
  );
}
