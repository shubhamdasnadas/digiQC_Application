'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Search } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { RegisterEntry } from '@/lib/types';

const STATUS_FILTERS = ['all', 'active', 'superseded', 'void'] as const;
const STATUS_LABEL: Record<string, string> = { all: 'All', active: 'Active', superseded: 'Superseded', void: 'Void' };

const statusBadge: Record<string, string> = {
  active: 'badge-active',
  superseded: 'badge-on_hold',
  void: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
};

export default function RegisterTab() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('q', search);
    const res = await fetch(`/api/projects/${id}/register?${params.toString()}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, statusFilter, search]);

  const columns: Column<RegisterEntry>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    { key: 'doc', header: 'Document No', render: (r) => <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{r.document_no || '—'}</span> },
    { key: 'title', header: 'Title', render: (r) => <span className="text-sm font-medium text-gray-900 dark:text-white">{r.title}</span> },
    { key: 'rev', header: 'Revision', render: (r) => <span className="text-xs text-gray-500">{r.revision || 'R0'}</span> },
    { key: 'status', header: 'Status', render: (r) => <span className={`badge ${statusBadge[r.status] ?? 'badge-active'} text-xs`}>{STATUS_LABEL[r.status] ?? r.status}</span> },
    {
      key: 'file', header: 'File', render: (r) =>
        r.file_url ? (
          <a href={r.file_url} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline">View</a>
        ) : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'created', header: 'Created', render: (r) => <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>,
    },
  ];

  return (
    <TabsPageShell
      title="Register"
      description="Document and drawing register for this project"
      onAdd={() => setShowAdd(true)}
      addLabel="Add Entry"
      filters={
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {STATUS_FILTERS.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                }`}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="relative flex items-center ml-auto">
            <Search size={13} className="absolute left-3 text-gray-400" />
            <input className="input pl-8 w-48" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}</div>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage="No register entries" />
      )}

      {showAdd && <AddRegisterModal projectId={id} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </TabsPageShell>
  );
}

function AddRegisterModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState({ document_no: '', title: '', revision: 'R0', status: 'active' as RegisterEntry['status'], file_url: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          <h2 className="text-lg font-semibold">Add Register Entry</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Document No</label>
              <input className="input" value={form.document_no} onChange={(e) => setForm((f) => ({ ...f, document_no: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Revision</label>
              <input className="input" value={form.revision} onChange={(e) => setForm((f) => ({ ...f, revision: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">File URL</label>
            <input className="input" placeholder="https://…" value={form.file_url} onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}>
              <option value="active">Active</option>
              <option value="superseded">Superseded</option>
              <option value="void">Void</option>
            </select>
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
