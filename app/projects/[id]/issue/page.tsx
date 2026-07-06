'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Search } from 'lucide-react';
import DataTable, { type Column } from '@/components/DataTable';
import type { Issue } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  all: 'All',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

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
  const [isOverdueFilter, setIsOverdueFilter] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    const res = await fetch(`/api/projects/${id}/issues?${params.toString()}`);
    const data = await res.json();
    setIssues(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, search]);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(search.toLowerCase()) ||
      issue.description.toLowerCase().includes(search.toLowerCase());

    if (isOverdueFilter) {
      if (!issue.due_date) return false;
      const dueDate = new Date(issue.due_date);
      const now = new Date();
      return dueDate < now && issue.status !== 'closed' && issue.status !== 'resolved';
    }

    return matchesSearch;
  });

  const columns: Column<Issue>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    { key: 'location', header: 'LOCATION', render: (r) => <span className="text-xs text-gray-500">—</span> },
    {
      key: 'type', header: 'TYPE',
      render: (r) => <span className={`text-xs font-medium ${severityColor[r.severity]}`}>{SEVERITY_LABEL[r.severity] || r.severity}</span>
    },
    {
      key: 'status', header: 'STATUS',
      render: (r) => <span className={`badge ${statusBadge[r.status] ?? 'badge-on_hold'} text-xs`}>{STATUS_LABEL[r.status] ?? r.status}</span>
    },
    { key: 'tags', header: 'TAGS', render: (r) => <span className="text-xs text-gray-500">—</span> },
    { key: 'team', header: 'ASSIGNED TEAM', render: (r) => <span className="text-xs text-gray-500">—</span> },
    { key: 'assignee', header: 'ASSIGNED USER', render: (r) => <span className="text-xs text-gray-900 dark:text-white">{r.assignee_name || '—'}</span> },
    { key: 'responded', header: 'RESPONDED BY', render: (r) => <span className="text-xs text-gray-500">—</span> },
    {
      key: 'due', header: 'DUE DATE',
      render: (r) => <span className="text-xs text-gray-500">{r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}</span>
    },
    { key: 'updated', header: 'UPDATED BY', render: (r) => <span className="text-xs text-gray-500">—</span> },
    {
      key: 'raised', header: 'RAISED AT',
      render: (r) => <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-8 mb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Issue Details</h2>
          <p className="text-sm text-gray-500">{issues.length} Issue</p>
        </div>

        <button
          onClick={() => setIsOverdueFilter(!isOverdueFilter)}
          className={`text-sm font-medium transition-colors ${isOverdueFilter
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
        >
          Overdue
        </button>
      </div>

      <div className="flex justify-end mb-6">
        <div className="relative flex items-center">
          <Search
            size={18}
            className="text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => document.getElementById('issue-search')?.focus()}
          />
          <input
            id="issue-search"
            className="input pl-9 w-64 text-xs opacity-0 focus:opacity-100 transition-opacity absolute right-0"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredIssues}
          rowKey={(r) => r.id}
          emptyMessage="No data"
        />
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-8 right-8 btn-primary rounded-full p-3 shadow-lg z-10"
        title="Report Issue"
      >
        <Plus size={20} />
      </button>

      {showAdd && (
        <AddIssueModal projectId={id} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
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