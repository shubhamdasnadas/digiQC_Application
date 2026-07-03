'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Trash2 } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { ProjectMember } from '@/lib/types';

const ROLES = ['admin', 'member', 'inspector', 'approver', 'viewer'] as const;

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
}: { projectId: string; available: { id: string; name: string; email: string }[]; onClose: () => void; onSaved: () => void; }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<typeof ROLES[number]>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { setError('Select a user.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to assign'); }
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Assign User</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">User *</label>
            <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select user</option>
              {available.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
            {available.length === 0 && (
              <p className="text-[11px] text-amber-500 mt-1">All org users are already on this project.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Role *</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving || !userId}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
