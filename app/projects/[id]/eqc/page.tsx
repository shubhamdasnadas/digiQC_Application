'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Search } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { EQC } from '@/lib/types';

const STATUS_FILTERS = ['all', 'passed', 'failed', 'pending', 'rfi'] as const;
const STATUS_LABEL: Record<string, string> = {
  all: 'All',
  passed: 'Passed',
  failed: 'Failed',
  pending: 'Pending',
  rfi: 'RFI',
};

const statusBadge: Record<string, string> = {
  passed: 'badge-active',
  failed: 'badge-completed',
  pending: 'badge-on_hold',
  rfi: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

const resultBadge: Record<string, string> = {
  pass: 'badge-active',
  fail: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  pending: 'badge-on_hold',
};

export default function EQCTab() {
  const { id } = useParams<{ id: string }>();
  const [eqcs, setEqcs] = useState<EQC[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [rfiFilter, setRfiFilter] = useState<'all' | 'rfi' | 'overdue'>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (rfiFilter === 'rfi') params.set('rfi', '1');
    if (rfiFilter === 'overdue') params.set('rfi', 'overdue');
    if (search) params.set('q', search);
    const res = await fetch(`/api/projects/${id}/eqcs?${params.toString()}`);
    const data = await res.json();
    setEqcs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, statusFilter, rfiFilter, search]);

  const counts = {
    total: eqcs.length,
    passed: eqcs.filter((e) => e.status === 'passed').length,
    failed: eqcs.filter((e) => e.status === 'failed').length,
    pending: eqcs.filter((e) => e.status === 'pending').length,
  };

  const columns: Column<EQC>[] = [
    {
      key: 'idx', header: '#', width: '50px',
      render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span>,
      className: 'text-gray-500 text-xs',
    },
    {
      key: 'location', header: 'Location',
      render: (e) => <span className="text-gray-900 dark:text-white text-xs font-medium">{e.location || '—'}</span>,
    },
    {
      key: 'checklist', header: 'Checklist',
      render: (e) => <span className="text-xs text-gray-700 dark:text-gray-300">{e.checklist_name || '—'}</span>,
    },
    {
      key: 'stage', header: 'Stage',
      render: (e) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-700 dark:text-gray-300">
            Single Stage ({e.stage_index}/{e.total_stages || 1})
          </span>
          {e.stage_result && (
            <span className={`badge ${resultBadge[e.stage_result] ?? 'badge-on_hold'} text-[10px] w-fit`}>
              {e.stage_result}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'approver', header: 'Approver',
      render: (e) => <span className="text-xs text-gray-600 dark:text-gray-400">{e.approver_log || '—'}</span>,
    },
    {
      key: 'status', header: 'EQC Status',
      render: (e) => (
        <span className={`badge ${statusBadge[e.status] ?? 'badge-on_hold'} text-xs`}>
          {STATUS_LABEL[e.status] ?? e.status}
        </span>
      ),
    },
    {
      key: 'inspected', header: 'Inspected By',
      render: (e) => <span className="text-xs text-gray-600 dark:text-gray-400">{e.inspected_by ? e.inspected_by.slice(0, 8) : '—'}</span>,
    },
    {
      key: 'date', header: 'Date',
      render: (e) => (
        <span className="text-xs text-gray-500">
          {e.inspected_at
            ? new Date(e.inspected_at).toLocaleDateString('en-IN')
            : new Date(e.created_at).toLocaleDateString('en-IN')}
        </span>
      ),
    },
  ];

  return (
    <TabsPageShell
      title="Inspections"
      description="Engineering Quality Checks for this project"
      filters={
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {(['all', 'rfi', 'overdue'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRfiFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  rfiFilter === r
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {r === 'all' ? 'All' : r === 'rfi' ? 'RFI' : 'RFI Overdue'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="relative flex items-center ml-auto">
            <Search size={13} className="absolute left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search…"
              className="input pl-8 w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      }
    >
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="Total" value={counts.total} color="teal" />
        <SummaryTile label="Passed" value={counts.passed} color="green" />
        <SummaryTile label="Failed" value={counts.failed} color="rose" />
        <SummaryTile label="Pending" value={counts.pending} color="amber" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-2xl" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={eqcs}
          rowKey={(e) => e.id}
          emptyMessage="No EQCs found for the selected filters"
        />
      )}
    </TabsPageShell>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  const palette: Record<string, string> = {
    teal: 'from-teal-500/10 to-teal-500/0 text-teal-600 dark:text-teal-400',
    green: 'from-green-500/10 to-green-500/0 text-green-600 dark:text-green-400',
    rose: 'from-rose-500/10 to-rose-500/0 text-rose-600 dark:text-rose-400',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className={`card p-4 bg-gradient-to-br ${palette[color]}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
