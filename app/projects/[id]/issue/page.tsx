'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Search } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { Issue } from '@/lib/types';

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const;
const STATUS_LABEL: Record<string, string> = {
  all: 'All',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const SEVERITY_FILTERS = ['all', 'low', 'medium', 'high', 'critical'] as const;
const SEVERITY_LABEL: Record<string, string> = {
  all: 'All',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const statusBadge: Record<string, string> = {
  open: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  in_progress: 'badge-on_hold',
  resolved: 'badge-active',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const severityColor: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600 dark:text-blue-400',
  high: 'text-amber-600 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
};

export default function IssueTab() {
  const { id } = useParams<{ id: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [severityFilter, setSeverityFilter] = useState<typeof SEVERITY_FILTERS[number]>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (search) params.set('q', search);
    const res = await fetch(`/api/projects/${id}/issues?${params.toString()}`);
    const data = await res.json();
    setIssues(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, statusFilter, severityFilter, search]);

  const columns: Column<Issue>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    {
      key: 'title', header: 'Title',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{r.title}</p>
          {r.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{r.description}</p>}
        </div>
      ),
    },
    {
      key: 'severity', header: 'Severity',
      render: (r) => <span className={`text-xs font-medium ${severityColor[r.severity]}`}>{SEVERITY_LABEL[r.severity]}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <span className={`badge ${statusBadge[r.status] ?? 'badge-on_hold'} text-xs`}>{STATUS_LABEL[r.status] ?? r.status}</span>,
    },
    {
      key: 'due', header: 'Due Date',
      render: (r) => <span className="text-xs text-gray-500">{r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}</span>,
    },
    {
      key: 'created', header: 'Created',
      render: (r) => <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>,
    },
  ];

  return (
    <TabsPageShell
      title="Issues"
      description="Track and manage project issues"
      onAdd={() => setShowAdd(true)}
      addLabel="Report Issue"
      filters={
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} labelMap={STATUS_LABEL} />
          <FilterPills options={SEVERITY_FILTERS} value={severityFilter} onChange={setSeverityFilter} labelMap={SEVERITY_LABEL} />
          <div className="relative flex items-center ml-auto">
            <Search size={13} className="absolute left-3 text-gray-400" />
            <input className="input pl-8 w-48" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={issues} rowKey={(r) => r.id} emptyMessage="No issues reported" />
      )}

      {showAdd && (
        <AddIssueModal projectId={id} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </TabsPageShell>
  );
}

function FilterPills<T extends string>({
  options, value, onChange, labelMap,
}: {
  options: readonly T[]; value: T; onChange: (v: T) => void; labelMap: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            value === o
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {labelMap[o] ?? o}
        </button>
      ))}
    </div>
  );
}

function AddIssueModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as Issue['severity'],
    status: 'open' as Issue['status'],
    due_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, due_date: form.due_date || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Report Issue</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Description</label>
            <textarea rows={3} className="input resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Severity</label>
              <select className="input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as any }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Due Date</label>
            <input type="date" className="input" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
