'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, Loader2, Target as TargetIcon } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import type { ProjectTarget } from '@/lib/types';

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'project'] as const;

export default function TargetTab() {
  const { id } = useParams<{ id: string }>();
  const [targets, setTargets] = useState<ProjectTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${id}/targets`);
    const data = await res.json();
    setTargets(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  return (
    <TabsPageShell
      title="Targets"
      description="Performance and quality targets for this project"
      onAdd={() => setShowAdd(true)}
      addLabel="Add Target"
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
      ) : targets.length === 0 ? (
        <div className="card p-12 text-center text-sm text-gray-400">
          <TargetIcon size={40} className="mx-auto mb-3 opacity-30" />
          No targets defined yet
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {targets.map((t) => {
            const pct = t.target_value > 0 ? Math.min(100, Math.round((t.current_value / t.target_value) * 100)) : 0;
            return (
              <div key={t.id} className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.metric}</p>
                  <span className="text-xs text-gray-500 capitalize">{t.period}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  <span className="font-medium text-teal-600 dark:text-teal-400">{t.current_value}{t.unit}</span>
                  {' / '}{t.target_value}{t.unit}
                </p>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">{pct}% complete</p>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddTargetModal projectId={id} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </TabsPageShell>
  );
}

function AddTargetModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState({ metric: '', target_value: 0, current_value: 0, unit: '', period: 'monthly' as ProjectTarget['period'] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.metric.trim()) { setError('Metric name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/targets`, {
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
          <h2 className="text-lg font-semibold">Add Target</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Metric *</label>
            <input className="input" placeholder="Inspections per day" value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Current</label>
              <input type="number" className="input" value={form.current_value} onChange={(e) => setForm((f) => ({ ...f, current_value: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Target</label>
              <input type="number" className="input" value={form.target_value} onChange={(e) => setForm((f) => ({ ...f, target_value: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Unit</label>
              <input className="input" placeholder="pcs" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Period</label>
            <select className="input" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as any }))}>
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
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
