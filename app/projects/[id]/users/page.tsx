'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Trash2 } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { ProjectMember } from '@/lib/types';

const ROLES = ['Project Admin', 'Inspector', 'Auditor', 'Associate'] as const;

const ROLE_DEFAULTS = {
  'Project Admin': { location: true, authentication: true, webAccess: 'Project', raiseInstruction: true },
  'Inspector': { location: true, authentication: true, webAccess: 'Team', raiseInstruction: false },
  'Auditor': { location: false, authentication: false, webAccess: 'Project', raiseInstruction: false },
  'Associate': { location: false, authentication: false, webAccess: 'Team', raiseInstruction: false },
};

export default function UsersTab() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const [mRes, uRes] = await Promise.all([
      fetch(`/api/projects/${id}/members`),
      fetch('/api/users'),
    ]);
    const m = await mRes.json();
    const u = await uRes.json();
    setMembers(Array.isArray(m) ? m : []);
    setAllUsers(Array.isArray(u) ? u : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const removeMember = async (userId: string) => {
    setMembers((arr) => arr.filter((m) => m.user_id !== userId));
    await fetch(`/api/projects/${id}/members?user_id=${userId}`, { method: 'DELETE' });
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
      key: 'actions', header: '',
      render: (m) => (
        <button onClick={() => removeMember(m.user_id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  // Filter out users already on the project from the "Add" picker
  const available = allUsers.filter((u) => !members.some((m) => m.user_id === u.id));

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
}: { projectId: string; available: { id: string; name: string; email: string; company?: string }[]; onClose: () => void; onSaved: () => void; }) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [role, setRole] = useState<typeof ROLES[number]>('Project Admin');
  const [permissions, setPermissions] = useState(ROLE_DEFAULTS['Project Admin']);
  const [access, setAccess] = useState({ webAccess: 'Team', raiseInstruction: false });
  const [checklists, setChecklists] = useState<{ id: string; name: string }[]>([]);
  const [selectedChecklists, setSelectedChecklists] = useState<string[]>([]);
  const [rfis, setRfis] = useState<{ id: string; name: string }[]>([]);
  const [selectedRfi, setSelectedRfi] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [checklistSearch, setChecklistSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isChecklistDropdownOpen, setIsChecklistDropdownOpen] = useState(false);

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
          user_ids: selectedUsers, 
          role, 
          permissions, 
          access, 
          checklists: selectedChecklists, 
          rfi: selectedRfi 
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to assign'); }
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  };

  const toggleChecklist = (id: string) => {
    setSelectedChecklists(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const selectAllChecklists = () => setSelectedChecklists(checklists.map(c => c.id));
  const deselectAllChecklists = () => setSelectedChecklists([]);

  // Group users by company for hierarchical view
  const groupedUsers = available.reduce((acc, user) => {
    const company = user.company || 'Other';
    if (!acc[company]) acc[company] = [];
    acc[company].push(user);
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
                <div className="sticky top-0 bg-white dark:bg-gray-900 pb-2">
                  <input 
                    className="input w-full" 
                    placeholder="Search users..." 
                    value={userSearch} 
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                {Object.entries(groupedUsers).map(([company, users]) => {
                  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));
                  if (filteredUsers.length === 0) return null;
                  return (
                    <div key={company} className="mb-2">
                      <div className="flex items-center gap-2 p-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        {company} - {filteredUsers.length}
                      </div>
                      <div className="pl-6 space-y-1">
                        {filteredUsers.map(u => (
                          <div key={u.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer" onClick={() => toggleUser(u.id)}>
                            <input type="checkbox" checked={selectedUsers.includes(u.id)} readOnly className="rounded text-teal-600" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{u.name}</span>
                          </div>
                        ))}
                      </div>
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
                <div className="sticky top-0 bg-white dark:bg-gray-900 pb-2">
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
                <div className="sticky top-0 bg-white dark:bg-gray-900 pb-2">
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
