'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, X, Loader2, Upload, ChevronDown, FileDown, Download, ChevronLeft, ChevronRight, Pencil, Trash2, Search } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString, getField } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import { exportToXlsx } from '@/lib/excelExport';
import type { Team, Organization, Member } from '@/lib/types';

const TEAMS_PAGE_SIZE = 10;
const MEMBERS_PAGE_SIZE = 5;

function Pagination({ page, totalItems, pageSize, onPageChange }: { page: number; totalItems: number; pageSize: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-300 px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [form, setForm] = useState({ organization_id: '', name: '', type: 'developer', team_lead_name: '', spoc_name: '' });
  const [saving, setSaving] = useState(false);
  const [teamsPage, setTeamsPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const [showAddMember, setShowAddMember] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    access_type: 'Paid',
    active: true,
  });

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
      const rows = chunk.map(r => {
        const name = sanitizeString(getField(r, 'Name', 'name', 'Team Name', 'team_name', 'Team', 'team'));
        const type = sanitizeString(getField(r, 'Type', 'type', 'Team Type', 'team_type') || 'inspection');
        const team_lead_name = sanitizeString(getField(r, 'Team Lead', 'team_lead', 'Team Lead Name', 'team_lead_name', 'Lead', 'lead'));
        const spoc_name = sanitizeString(getField(r, 'SPOC', 'spoc', 'SPOC Name', 'spoc_name'));
        const users = sanitizeString(getField(r, 'Users', 'users', 'Members', 'members', 'User', 'user', 'Team Members', 'team_members'));
        const active_projects = sanitizeString(getField(r, 'Active Assigned Projects', 'Active Projects', 'active_projects', 'active_assigned_projects'));
        const inactive_projects = sanitizeString(getField(r, 'Inactive Assigned Projects', 'Inactive Projects', 'inactive_projects', 'inactive_assigned_projects'));

        return {
          organization_id: org?.id || '',
          name: name || 'Unnamed',
          type: type || 'inspection',
          team_lead_name,
          spoc_name,
          users,
          active_projects,
          inactive_projects,
        };
      }).filter(r => r.name && r.name !== 'Unnamed');

      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (await res.text()) || 'Failed to import teams');
      }
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

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setForm({
      organization_id: team.organization_id || '',
      name: team.name || '',
      type: team.type || 'developer',
      team_lead_name: team.team_lead_name || '',
      spoc_name: team.spoc_name || '',
    });
    setShowAdd(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setSaving(true);
    await fetch(`/api/teams?id=${editingTeam.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAdd(false);
    setEditingTeam(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    setDeletingId(id);
    await fetch(`/api/teams?id=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (selectedTeam?.id === id) setSelectedTeam(null);
    load();
  };

  const closeModal = () => {
    setShowAdd(false);
    setEditingTeam(null);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setSavingMember(true);
    await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...memberForm, teams: selectedTeam.name }),
    });
    setSavingMember(false);
    setShowAddMember(false);
    setMemberForm({
      name: '',
      email: '',
      phone: '',
      access_type: 'Paid',
      active: true,
    });
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

  const filteredTeams = teams.filter(t => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (t.name || '').toLowerCase();
    const type = (t.type || '').toLowerCase();
    const activeProjects = (t.active_projects || '').toLowerCase();
    return name.includes(q) || type.includes(q) || activeProjects.includes(q);
  });

  const teamsTotalPages = Math.max(1, Math.ceil(filteredTeams.length / TEAMS_PAGE_SIZE));
  const teamsPageClamped = Math.min(teamsPage, teamsTotalPages);
  const paginatedTeams = filteredTeams.slice((teamsPageClamped - 1) * TEAMS_PAGE_SIZE, teamsPageClamped * TEAMS_PAGE_SIZE);

  const selectedTeamMembers = selectedTeam ? membersOfTeam(selectedTeam) : [];
  const filteredTeamMembers = selectedTeamMembers.filter(m => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (m.name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    const phone = (m.phone || '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const membersTotalPages = Math.max(1, Math.ceil(filteredTeamMembers.length / MEMBERS_PAGE_SIZE));
  const membersPageClamped = Math.min(membersPage, membersTotalPages);
  const paginatedMembers = filteredTeamMembers.slice((membersPageClamped - 1) * MEMBERS_PAGE_SIZE, membersPageClamped * MEMBERS_PAGE_SIZE);

  const handleSelectTeam = (t: Team) => {
    setSelectedTeam(t);
    setMembersPage(1);
    setMemberSearch('');
  };

  const exportRows = () => (filteredTeams.length > 0 ? filteredTeams : teams).map(t => {
    const teamMembers = membersOfTeam(t);
    const userNames = teamMembers.map(m => m.name).filter(Boolean).join(', ');
    return {
      Name: t.name,
      Type: t.type,
      'Team Lead': t.team_lead_name || '',
      SPOC: t.spoc_name || '',
      'Users': userNames || '',
      'Active Assigned Projects': t.active_projects || '',
      'Inactive Assigned Projects': t.inactive_projects || '',
    };
  });

  return (
    <div className="p-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            {/* <p className="text-sm text-gray-500 dark:text-gray-400">{teams.length} teams configured</p> */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => downloadSampleExcel('teams')} className="btn-secondary"><FileDown size={15} /> Template</button>
              <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
              <button onClick={() => exportRows().length && exportToXlsx(exportRows(), 'valid8-teams')} className="btn-secondary"><Download size={15} /> Export XLSX</button>
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
                <>
                  <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search teams by name, type, or project..."
                        className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder-gray-400"
                        value={teamSearch}
                        onChange={e => {
                          setTeamSearch(e.target.value);
                          setTeamsPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                        <tr>
                          {['Team Name', 'Type', 'Active Projects', 'Created', 'Action'].map(h => (
                            <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {paginatedTeams.map(t => (
                          <tr
                            key={t.id}
                            onClick={() => handleSelectTeam(t)}
                            className={`cursor-pointer transition-colors ${selectedTeam?.id === t.id ? 'bg-teal-50 dark:bg-teal-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                          >
                            <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{t.name}</td>
                            <td className="px-5 py-3"><span className={`badge ${typeColors[t.type] ?? 'badge-active'} capitalize text-xs`}>{t.type}</span></td>
                            {/* <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{t.team_lead_name || '—'}</td>
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{t.spoc_name || '—'}</td> */}
                            <td className="px-5 py-3 text-xs max-w-xs">
                              <div className="relative group inline-block max-w-full ">
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
                            {/* <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs max-w-xs truncate" title={t.inactive_projects}>{formatProjectList(t.inactive_projects)}</td> */}
                            <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                                  disabled={editingTeam !== null || deletingId === t.id || t.name?.toLowerCase() === 'main team'}
                                  title={t.name?.toLowerCase() === 'main team' ? 'Main team cannot be edited' : 'Edit team'}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                  disabled={editingTeam !== null || deletingId === t.id || t.name?.toLowerCase() === 'main team'}
                                  title={t.name?.toLowerCase() === 'main team' ? 'Main team cannot be deleted' : 'Delete team'}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  {deletingId === t.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredTeams.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400 text-xs">
                              {teamSearch ? 'No teams found matching your search.' : 'No teams configured.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={teamsPageClamped} totalItems={filteredTeams.length} pageSize={TEAMS_PAGE_SIZE} onPageChange={setTeamsPage} />
                </>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            {/* <p className="text-sm text-gray-500 dark:text-gray-400">{members.length} members configured</p> */}
            <div />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAddMember(true)}
                disabled={!selectedTeam}
                title={selectedTeam ? undefined : 'Select a team first'}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={15} /> Add Member
              </button>
            </div>
          </div>
          {selectedTeam ? (
            <div className="card">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedTeam.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedTeamMembers.length} member{selectedTeamMembers.length === 1 ? '' : 's'}</p>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search members in ${selectedTeam.name}...`}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder-gray-400"
                    value={memberSearch}
                    onChange={e => {
                      setMemberSearch(e.target.value);
                      setMembersPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="max-h-[32rem] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTeamMembers.length === 0 ? (
                  <p className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    {memberSearch ? 'No matching members found in this team.' : 'No members found for this team.'}
                  </p>
                ) : (
                  paginatedMembers.map(m => (
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
              <Pagination page={membersPageClamped} totalItems={filteredTeamMembers.length} pageSize={MEMBERS_PAGE_SIZE} onPageChange={setMembersPage} />
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
          <div className="absolute inset-0 bg-black/60 glass" onClick={closeModal} />
          <div className="relative card w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingTeam ? 'Edit Team' : 'Add Team'}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={editingTeam ? handleUpdate : handleAdd} className="space-y-3">
              {/* <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Organization</label>
                <select className="input" value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div> */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Team Name *</label>
                <input required className="input" placeholder="QC Team Alpha" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="DEFAULT">DEFAULT</option>
                  <option value="CONSULTANT">CONSULTANT</option>
                  <option value="AUDIT">AUDIT</option>
                  <option value="COMPLIANCE">COMPLIANCE</option>
                  <option value="CONTRACTOR">CONTRACTOR</option>
                  <option value="CLIENT">CLIENT</option>
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="VENDOR">VENDOR</option>
                  <option value="OTHERS">OTHERS</option>
                </select>

              </div>
              {/* <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Team Lead</label>
                  <input className="input" placeholder="Name" value={form.team_lead_name} onChange={e => setForm(f => ({ ...f, team_lead_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">SPOC</label>
                  <input className="input" placeholder="Name" value={form.spoc_name} onChange={e => setForm(f => ({ ...f, spoc_name: e.target.value }))} />
                </div>
              </div> */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : editingTeam ? <Pencil size={14} /> : <Plus size={14} />}
                  {saving ? 'Saving...' : editingTeam ? 'Update Team' : 'Add Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddMember && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAddMember(false)} />
          <div className="relative card w-full max-w-md p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Member</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedTeam.name}</p>
              </div>
              <button onClick={() => setShowAddMember(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Name *</label>
                <input required className="input" placeholder="Full name" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                <input type="email" className="input" placeholder="name@company.com" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone No</label>
                <input type="tel" className="input" placeholder="919876543210" value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              {/* <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Access Type</label>
                <select className="input" value={memberForm.access_type} onChange={e => setMemberForm(f => ({ ...f, access_type: e.target.value }))}>
                  <option value="Paid">Paid</option>
                  <option value="Complimentary">Complimentary</option>
                </select>
              </div> */}
              {/* <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Active</label>
                <select className="input" value={memberForm.active ? 'yes' : 'no'} onChange={e => setMemberForm(f => ({ ...f, active: e.target.value === 'yes' }))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div> */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={savingMember}>
                  {savingMember ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {savingMember ? 'Saving...' : 'Add Member'}
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
        description="Upload an Excel or CSV file with columns: Name, Type, Team Lead, SPOC, Users, Active Assigned Projects, Inactive Assigned Projects"
        columns={['Name', 'Type', 'Team Lead', 'SPOC', 'Users', 'Active Assigned Projects', 'Inactive Assigned Projects']}
        sampleData={[
          {
            'Name': 'QC Team Alpha',
            'Type': 'inspection',
            'Team Lead': 'Rajesh Kumar',
            'SPOC': 'Priya Singh',
            'Users': 'Rajesh Kumar, Priya Singh',
            'Active Assigned Projects': 'Block-A Foundation, MEP Installation Ph1',
            'Inactive Assigned Projects': '',
          },
          {
            'Name': 'Audit Team',
            'Type': 'audit',
            'Team Lead': 'David Williams',
            'SPOC': 'Emma Watson',
            'Users': 'David Williams, Emma Watson',
            'Active Assigned Projects': '',
            'Inactive Assigned Projects': 'Facade Cladding QC',
          },
        ]}
        onImport={handleImport}
      />
    </div>
  );
}
