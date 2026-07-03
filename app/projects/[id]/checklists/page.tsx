'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { Checklist } from '@/lib/types';

export default function ChecklistsTab() {
  const { id } = useParams<{ id: string }>();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    // The global /api/checklists endpoint returns checklists joined to their project.
    // Filter to just this project's checklists client-side.
    const res = await fetch('/api/checklists');
    const data = await res.json();
    if (Array.isArray(data)) {
      setChecklists(data.filter((c: any) => c.project_id === id));
    } else {
      setChecklists([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const columns: Column<Checklist>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    { key: 'name', header: 'Checklist Name', render: (c) => <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span> },
    { key: 'created', header: 'Created', render: (c) => <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</span> },
  ];

  return (
    <TabsPageShell
      title="Checklists"
      description="Quality checklists defined for this project"
      onAdd={() => setShowAdd(true)}
      addLabel="Add Checklist"
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}</div>
      ) : (
        <DataTable columns={columns} rows={checklists} rowKey={(c) => c.id} emptyMessage="No checklists yet" />
      )}

      {showAdd && <AddChecklistModal projectId={id} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </TabsPageShell>
  );
}

function AddChecklistModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to save'); }
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Add Checklist</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Checklist Name *</label>
            <input className="input" placeholder="Pre-pour Concrete Check" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
