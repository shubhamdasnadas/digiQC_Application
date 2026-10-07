'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Trash2, ChevronDown } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { ProjectMember, Member, Team, EQC } from '@/lib/types';

const ROLES = ['Project Admin', 'Inspector', 'Auditor', 'Associate'] as const;

// project_members.role is constrained to admin/member/inspector/approver/viewer at the DB level
const ROLE_TO_DB_ROLE: Record<typeof ROLES[number], string> = {
  'Project Admin': 'admin',
  'Inspector': 'inspector',
  'Auditor': 'approver',
  'Associate': 'member',
};

const ROLE_DEFAULTS = {
  'Project Admin': { location: true, authentication: true, webAccess: 'Project', raiseInstruction: true },
  'Inspector': { location: true, authentication: true, webAccess: 'Team', raiseInstruction: false },
  'Auditor': { location: false, authentication: false, webAccess: 'Project', raiseInstruction: false },
  'Associate': { location: false, authentication: false, webAccess: 'Team', raiseInstruction: false },
};

interface ProjectTeamLink {
  team_id: string;
  team_name: string;
}

export default function UsersTab() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [eqcs, setEqcs] = useState<EQC[]>([]);
  const [projectTeams, setProjectTeams] = useState<ProjectTeamLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const [mRes, uRes, eRes, ptRes] = await Promise.all([
      fetch(`/api/projects/${id}/members`),
      fetch('/api/members'),
      fetch(`/api/projects/${id}/eqcs`),
      fetch(`/api/projects/${id}/teams`),
    ]);
    const m = await mRes.json();
    const u = await uRes.json();
    const e = await eRes.json();
    const pt = await ptRes.json();
    setMembers(Array.isArray(m) ? m : []);
    setAllMembers(Array.isArray(u) ? u : []);
    setEqcs(Array.isArray(e) ? e : []);
    setProjectTeams(Array.isArray(pt) ? pt : []);
    setLoading(false);
  };

  const assignedChecklistNames = (userId: string) => {
    const names = new Set(
      eqcs
        .filter((e) => e.assigned_user_ids?.includes(userId) && e.checklist_name)
        .map((e) => e.checklist_name as string)
    );
    return Array.from(names);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const removeMember = async (userId: string) => {
    const removed = members.find((m) => m.user_id === userId);
    const remaining = members.filter((m) => m.user_id !== userId);
    setMembers(remaining);
    await fetch(`/api/projects/${id}/members?user_id=${userId}`, { method: 'DELETE' });

    // If that was the last remaining project member from any of the removed
    // user's teams, unlink that team from the project too.
    const removedTeamNames = (removed?.user_teams || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (removedTeamNames.length === 0) return;

    const teamsToUnlink = removedTeamNames.filter((teamName) =>
      !remaining.some((m) => (m.user_teams || '').split(',').map((t) => t.trim().toLowerCase()).includes(teamName))
    );
    if (teamsToUnlink.length === 0) return;

    const linkedTeamIds = projectTeams
      .filter((pt) => teamsToUnlink.includes(pt.team_name.trim().toLowerCase()))
      .map((pt) => pt.team_id);
    if (linkedTeamIds.length === 0) return;

    setProjectTeams((arr) => arr.filter((pt) => !linkedTeamIds.includes(pt.team_id)));
    await Promise.all(
      linkedTeamIds.map((teamId) =>
        fetch(`/api/projects/${id}/teams?team_id=${teamId}`, { method: 'DELETE' })
      )
    );
  };

  const columns: Column<ProjectMember>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    {
      key: 'name', header: 'Name',
      render: (m) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-xs text-white font-semibold">
            {(m.user_name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{m.user_name ?? '—'}</p>
            <p className="text-xs text-gray-500">{m.user_email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      render: (m) => <span className="badge badge-active text-xs capitalize">{m.role}</span>,
    },
    {
      key: 'added', header: 'Added',
      render: (m) => <span className="text-xs text-gray-500">{new Date(m.added_at).toLocaleDateString('en-IN')}</span>,
    },
    {
      key: 'assigned_teams', header: 'Assigned Teams',
      render: (m) => <span className="text-xs text-gray-500">{m.user_teams || '—'}</span>,
    },
    {
      key: 'assigned_checklist', header: 'Assigned Checklists',
      render: (m) => {
        const names = assignedChecklistNames(m.user_id);
        if (names.length === 0) return <span className="text-xs text-gray-500">—</span>;
        if (names.length === 1) return <span className="text-xs text-gray-500">{names[0]}</span>;
        return (
          <div className="relative group inline-block">
            <span className="text-xs text-gray-500 underline decoration-dotted decoration-gray-400 underline-offset-2">
              {names[0]} + {names.length - 1}
            </span>
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 max-w-xs opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-top-left">
              <div className="rounded-lg bg-gray-900 dark:bg-gray-800 text-white text-xs leading-relaxed p-3 shadow-xl border border-gray-800 dark:border-gray-700">
                {names.join(', ')}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'assigned_rfi', header: 'Assigned RFI',
      render: () => <span className="text-xs text-gray-500">—</span>,
    },
    {
      key: 'actions', header: '',
      render: (m) => (
        <button onClick={() => removeMember(m.user_id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  // Filter out members already on the project from the "Add" picker
  const available = allMembers.filter((u) => !members.some((m) => m.user_id === u.id));

  return (
    <TabsPageShell
      title="Users"
      description="Users assigned to this project"
      onAdd={() => setShowAdd(true)}
      addLabel="Assign User"
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}</div>
      ) : (
        <DataTable columns={columns} rows={members} rowKey={(m) => m.id} emptyMessage="No users assigned yet" />
      )}

      {showAdd && (
        <AddMemberModal
          projectId={id}
          available={available}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </TabsPageShell>
  );
}

function AddMemberModal({
  projectId, available, onClose, onSaved,
}: { projectId: string; available: Member[]; onClose: () => void; onSaved: () => void; }) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [role, setRole] = useState<typeof ROLES[number]>('Project Admin');
  const [permissions, setPermissions] = useState(ROLE_DEFAULTS['Project Admin']);
  const [access, setAccess] = useState({ webAccess: 'Team', raiseInstruction: false });
  const [checklists, setChecklists] = useState<{ id: string; name: string }[]>([]);
  const [selectedChecklists, setSelectedChecklists] = useState<string[]>([]);
  const [rfis, setRfis] = useState<{ id: string; name: string }[]>([]);
  const [selectedRfi, setSelectedRfi] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const [roleSearch, setRoleSearch] = useState('');
  const [checklistSearch, setChecklistSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isChecklistDropdownOpen, setIsChecklistDropdownOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cRes = await fetch('/api/checklists');
        if (cRes.ok) {
          const c = await cRes.json();
          setChecklists(Array.isArray(c) ? c : []);
        }
      } catch (e) { console.error('Failed to fetch checklists', e); }

      try {
        const rRes = await fetch('/api/rfis');
        if (rRes.ok) {
          const r = await rRes.json();
          setRfis(Array.isArray(r) ? r : []);
        }
      } catch (e) { console.error('Failed to fetch RFIs', e); }

      try {
        const tRes = await fetch('/api/teams');
        if (tRes.ok) {
          const t = await tRes.json();
          setTeams(Array.isArray(t) ? t : []);
        }
      } catch (e) { console.error('Failed to fetch teams', e); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setPermissions(ROLE_DEFAULTS[role]);
    setAccess({ 
      webAccess: ROLE_DEFAULTS[role].webAccess, 
      raiseInstruction: ROLE_DEFAULTS[role].raiseInstruction 
    });
  }, [role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) { setError('Select at least one user.'); return; }
    setSaving(true);
    try {
      // In a real app, we'd send all this data to the backend
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: selectedUsers.map((user_id) => ({ user_id, role: ROLE_TO_DB_ROLE[role] })),
          permissions,
          access,
          checklists: selectedChecklists,
          rfi: selectedRfi,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to assign'); }

      // Any team a newly-assigned user belongs to (whether just one member or the
      // whole team was picked) should show up on the project's Teams tab.
      const selectedMembers = available.filter(u => selectedUsers.includes(u.id));
      const teamNames = new Set(
        selectedMembers.flatMap(m => (m.teams || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean))
      );
      const teamIds = teams.filter(t => teamNames.has(t.name.trim().toLowerCase())).map(t => t.id);
      if (teamIds.length > 0) {
        await fetch(`/api/projects/${projectId}/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: teamIds.map(team_id => ({ team_id })) }),
        });
      }

      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  };

  const toggleTeamOpen = (team: string) => {
    setOpenTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  };

  const toggleTeam = (team: string, teamMemberIds: string[]) => {
    setSelectedUsers(prev => {
      const allSelected = teamMemberIds.every(id => prev.includes(id));
      return allSelected
        ? prev.filter(id => !teamMemberIds.includes(id))
        : Array.from(new Set([...prev, ...teamMemberIds]));
    });
    // Selecting a team should reveal its members rather than leaving the list collapsed.
    setOpenTeams(prev => new Set(prev).add(team));
  };

  const toggleChecklist = (id: string) => {
    setSelectedChecklists(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const selectAllChecklists = () => setSelectedChecklists(checklists.map(c => c.id));
  const deselectAllChecklists = () => setSelectedChecklists([]);

  // Group members by team for hierarchical view (a member with multiple comma-separated
  // teams appears under each of them)
  const groupedUsers = available.reduce((acc, member) => {
    const teamNames = (member.teams || '').split(',').map(t => t.trim()).filter(Boolean);
    const groups = teamNames.length > 0 ? teamNames : ['Unassigned'];
    for (const team of groups) {
      if (!acc[team]) acc[team] = [];
      acc[team].push(member);
    }
    return acc;
  }, {} as Record<string, typeof available>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Add Users to Project ({selectedUsers.length} Users Selected)</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        
        <form onSubmit={submit} className="space-y-6">
          {/* Users Selection */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">* Users</label>
            <div 
              className={`input flex items-center justify-between cursor-pointer ${selectedUsers.length === 0 ? 'border-orange-500' : ''}`}
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            >
              <span className="text-gray-400">{selectedUsers.length > 0 ? `${selectedUsers.length} Users Selected` : 'Select Users'}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
              </div>
            </div>
            {isUserDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-xl max-h-60 overflow-y-auto p-2">
                <div className="sticky -top-2 z-20 -mx-2 -mt-2 mb-2 px-2 pt-2 pb-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                  <input
                    className="input w-full"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                {Object.entries(groupedUsers).map(([team, users]) => {
                  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));
                  if (filteredUsers.length === 0) return null;
                  const teamMemberIds = filteredUsers.map(u => u.id);
                  const allSelected = teamMemberIds.every(mid => selectedUsers.includes(mid));
                  const someSelected = !allSelected && teamMemberIds.some(mid => selectedUsers.includes(mid));
                  const isCollapsed = !openTeams.has(team);
                  return (
                    <div key={team} className="mb-2">
                      <div
                        className="flex items-center gap-2 p-1 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                        onClick={() => toggleTeamOpen(team)}
                      >
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected; }}
                          readOnly
                          className="rounded text-teal-600"
                          onClick={(e) => { e.stopPropagation(); toggleTeam(team, teamMemberIds); }}
                        />
                        <span className="flex-1">{team} - {filteredUsers.length}</span>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      </div>
                      {!isCollapsed && (
                        <div className="pl-6 space-y-1">
                          {filteredUsers.map(u => (
                            <div key={u.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer" onClick={() => toggleUser(u.id)}>
                              <input type="checkbox" checked={selectedUsers.includes(u.id)} readOnly className="rounded text-teal-600" />
                              <span className="text-xs text-gray-600 dark:text-gray-400">{u.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">* Role</label>
            <div 
              className={`input flex items-center justify-between cursor-pointer ${!role ? 'border-orange-500' : ''}`}
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            >
              <span className={!role ? 'text-gray-400' : 'text-gray-900 dark:text-white'}>{role || 'Select Role'}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            {isRoleDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-xl max-h-60 overflow-y-auto p-2">
                <div className="sticky -top-2 z-20 -mx-2 -mt-2 mb-2 px-2 pt-2 pb-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                  <input
                    className="input w-full"
                    placeholder="Search role..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                  />
                </div>
                {ROLES.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())).map(r => (
                  <div 
                    key={r} 
                    className={`p-2 text-sm rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${role === r ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-600 dark:text-gray-400'}`}
                    onClick={() => { setRole(r); setIsRoleDropdownOpen(false); }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Permissions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <span className="text-xs text-gray-600 dark:text-gray-400">Location</span>
                <button 
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, location: !p.location }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${permissions.location ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${permissions.location ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <span className="text-xs text-gray-600 dark:text-gray-400">Authentication</span>
                <button 
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, authentication: !p.authentication }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${permissions.authentication ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${permissions.authentication ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Access */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Access</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="block text-xs text-gray-600 dark:text-gray-400">Web Access</span>
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
                  <button 
                    type="button"
                    onClick={() => setAccess(a => ({ ...a, webAccess: 'Team' }))}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${access.webAccess === 'Team' ? 'bg-white dark:bg-gray-700 shadow-sm text-teal-700 font-medium' : 'text-gray-500'}`}
                  >
                    Team
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAccess(a => ({ ...a, webAccess: 'Project' }))}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${access.webAccess === 'Project' ? 'bg-white dark:bg-gray-700 shadow-sm text-teal-700 font-medium' : 'text-gray-500'}`}
                  >
                    Project
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-xs text-gray-600 dark:text-gray-400">Raise Instruction</span>
                <button 
                  type="button"
                  onClick={() => setAccess(a => ({ ...a, raiseInstruction: !a.raiseInstruction }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${access.raiseInstruction ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${access.raiseInstruction ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="relative">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Checklist</label>
              <button 
                type="button" 
                onClick={deselectAllChecklists} 
                className="text-[10px] text-orange-500 hover:underline"
              >
                Deselect All
              </button>
            </div>
            <div 
              className="input flex items-center justify-between cursor-pointer"
              onClick={() => setIsChecklistDropdownOpen(!isChecklistDropdownOpen)}
            >
              <span className="text-gray-400">{selectedChecklists.length > 0 ? `${selectedChecklists.length} Selected` : 'Select Checklist'}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            {isChecklistDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-xl max-h-60 overflow-y-auto p-2">
                <div className="sticky -top-2 z-20 -mx-2 -mt-2 mb-2 px-2 pt-2 pb-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                  <input
                    className="input w-full"
                    placeholder="Search checklist..."
                    value={checklistSearch}
                    onChange={(e) => setChecklistSearch(e.target.value)}
                  />
                </div>
                <div 
                  className="p-2 text-sm rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium"
                  onClick={selectAllChecklists}
                >
                  Select All
                </div>
                {checklists.filter(c => c.name.toLowerCase().includes(checklistSearch.toLowerCase())).map(c => (
                  <div 
                    key={c.id} 
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                    onClick={() => toggleChecklist(c.id)}
                  >
                    <input type="checkbox" checked={selectedChecklists.includes(c.id)} readOnly className="rounded text-teal-600" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RFI */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">RFI</label>
            <select 
              className="input w-full" 
              value={selectedRfi} 
              onChange={(e) => setSelectedRfi(e.target.value)}
            >
              <option value="">Select RFI</option>
              {rfis.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <p className="text-xs text-amber-500 font-medium">Checklist are not linked with RFI</p>

          {error && <p className="text-xs text-red-500">{error}</p>}
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving || selectedUsers.length === 0 || !role}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
