'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Trash2 } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { Team } from '@/lib/types';

interface ProjectTeamRow {
  id: string;
  project_id: string;
  team_id: string;
  team_name: string;
  team_type: string;
  team_lead_name: string;
  spoc_name: string;
  assigned_checklist: string;
  assigned_user: string;
  added_at: string;
}

export default function TeamsTab() {
  const { id } = useParams<{ id: string }>();
  const [linked, setLinked] = useState<ProjectTeamRow[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const [linkedRes, teamsRes] = await Promise.all([
      fetch(`/api/projects/${id}/teams`),
      fetch('/api/teams'),
    ]);
    const l = await linkedRes.json();
    const t = await teamsRes.json();
    setLinked(Array.isArray(l) ? l : []);
    setAllTeams(Array.isArray(t) ? t : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const unlink = async (teamId: string) => {
    setLinked((arr) => arr.filter((r) => r.team_id !== teamId));
    await fetch(`/api/projects/${id}/teams?team_id=${teamId}`, { method: 'DELETE' });
  };

  const columns: Column<ProjectTeamRow>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    { key: 'name', header: 'Team Name', render: (r) => <span className="text-sm font-medium text-gray-900 dark:text-white">{r.team_name}</span> },
    { key: 'type', header: 'Type', render: (r) => <span className="badge badge-on_hold text-xs capitalize">{r.team_type || '—'}</span> },
    { key: 'assigned_user', header: 'Assigned User', render: (r) => <span className="text-xs text-gray-700 dark:text-gray-300">{r.assigned_user || '—'}</span> },
    { key: 'assigned_checklist', header: 'Assigned Checklist', render: (r) => <span className="text-xs text-gray-700 dark:text-gray-300">{r.assigned_checklist || '—'}</span> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <button onClick={() => unlink(r.team_id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10">
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  const available = allTeams.filter((t) => !linked.some((l) => l.team_id === t.id));

  return (
    <TabsPageShell
      title="Teams"
      description="Teams linked to this project"
      onAdd={() => setShowAdd(true)}
      addLabel="Link Team"
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}</div>
      ) : (
        <DataTable columns={columns} rows={linked} rowKey={(r) => r.id} emptyMessage="No teams linked yet" />
      )}

      {showAdd && (
        <AddTeamModal
          projectId={id}
          available={available}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </TabsPageShell>
  );
}

function AddTeamModal({
  projectId, available, onClose, onSaved,
}: { projectId: string; available: Team[]; onClose: () => void; onSaved: () => void; }) {
  const [teamId, setTeamId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) { setError('Select a team.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to link'); }
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Link Team</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Team *</label>
            <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select team</option>
              {available.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select>
            {available.length === 0 && (
              <p className="text-[11px] text-amber-500 mt-1">All teams are already linked.</p>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving || !teamId}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
