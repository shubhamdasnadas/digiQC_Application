'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus,
  X,
  Search,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Camera,
  FileText,
  Printer,
  Download,
  ArrowLeft,
  Clock,
  MapPin,
  Check,
  Loader2,
  Eye,
  Trash2,
} from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { EQC, Checklist, ChecklistStage, Checkpoint, CheckpointResult, EQCStageData, Team, Member } from '@/lib/types';
import { useProject } from '@/context/ProjectContext';

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

const WITNESS_OPTIONS = [
  'Client',
  'Contractor',
  'Vendor',
  'Consultant',
  'Developer',
  'Other',
];

export default function EQCTab() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const [eqcs, setEqcs] = useState<EQC[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [rfiFilter, setRfiFilter] = useState<'all' | 'rfi' | 'overdue'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [checklistFilter, setChecklistFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [makerTeamFilter, setMakerTeamFilter] = useState<string>('all');
  const [stageStatusFilter, setStageStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Dropdown options lists
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<EQC | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteInspection = async (inspection: EQC) => {
    const loc = inspection.location || inspection.checklist_name || 'this inspection entry';
    if (!window.confirm(`Are you sure you want to delete "${loc}"? This will permanently remove it from the database.`)) {
      return;
    }

    setDeletingId(inspection.id);
    try {
      const res = await fetch(`/api/projects/${id}/eqcs?eqc_id=${inspection.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete inspection');
      }
      // Optimistically remove from state
      setEqcs((prev) => prev.filter((item) => item.id !== inspection.id));
      if (selectedInspection?.id === inspection.id) {
        setSelectedInspection(null);
      }
    } catch (err) {
      alert((err as Error).message || 'Failed to delete inspection');
    } finally {
      setDeletingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (rfiFilter === 'rfi') params.set('rfi', '1');
      if (rfiFilter === 'overdue') params.set('rfi', 'overdue');
      if (checklistFilter !== 'all') params.set('checklist_id', checklistFilter);
      if (userFilter !== 'all') params.set('user_id', userFilter);
      if (makerTeamFilter !== 'all') params.set('maker_team', makerTeamFilter);
      if (stageStatusFilter !== 'all') params.set('stage_status', stageStatusFilter);
      if (search) params.set('q', search);

      const [eqcRes, clRes, teamRes, memRes] = await Promise.all([
        fetch(`/api/projects/${id}/eqcs?${params.toString()}`),
        fetch(`/api/checklists?project_id=${id}`),
        fetch(`/api/projects/${id}/teams`),
        fetch('/api/members'),
      ]);

      const [eqcData, clData, teamData, memData] = await Promise.all([
        eqcRes.json().catch(() => []),
        clRes.json().catch(() => []),
        teamRes.json().catch(() => []),
        memRes.json().catch(() => []),
      ]);

      setEqcs(Array.isArray(eqcData) ? eqcData : []);
      setChecklists(Array.isArray(clData) ? clData : []);
      setTeams(Array.isArray(teamData) ? teamData : []);
      setMembers(Array.isArray(memData) ? memData : []);
    } catch (err) {
      console.error('Failed to load EQC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, statusFilter, rfiFilter, checklistFilter, userFilter, makerTeamFilter, stageStatusFilter, search]);

  const counts = {
    total: eqcs.length,
    passed: eqcs.filter((e) => e.status === 'passed').length,
    failed: eqcs.filter((e) => e.status === 'failed').length,
    pending: eqcs.filter((e) => e.status === 'pending').length,
  };

  const columns: Column<EQC>[] = [
    {
      key: 'idx',
      header: '#',
      width: '50px',
      render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span>,
      className: 'text-gray-500 text-xs',
    },
    {
      key: 'location',
      header: 'LOCATION',
      render: (e) => (
        <button
          onClick={() => setSelectedInspection(e)}
          className="text-left font-medium text-xs text-gray-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 hover:underline transition-colors block max-w-[220px] truncate"
          title={e.location || '—'}
        >
          {e.location || '—'}
        </button>
      ),
    },
    {
      key: 'checklist',
      header: 'CHECKLIST',
      render: (e) => (
        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
          {e.checklist_name || 'General Quality Check'}
        </span>
      ),
    },
    {
      key: 'stage_status',
      header: 'STAGE STATUS',
      render: (e) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Stage {e.stage_index || 1} ({e.stage_index || 1}/{e.total_stages || 1})
          </span>
          <span
            className={`badge text-[10px] w-fit ${
              e.stage_result === 'pass'
                ? 'badge-active'
                : e.stage_result === 'fail'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                : 'badge-on_hold'
            }`}
          >
            {e.stage_result === 'pass' ? 'Completed' : e.stage_result === 'fail' ? 'Failed' : 'Pending'}
          </span>
        </div>
      ),
    },
    {
      key: 'approver',
      header: 'APPROVAL DETAILS',
      render: (e) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {e.approver_name || e.approver_log || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'INSPECTION STATUS',
      render: (e) => (
        <span
          className={`badge text-xs ${
            e.status === 'passed'
              ? 'badge-active'
              : e.status === 'failed'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
              : statusBadge[e.status] ?? 'badge-on_hold'
          }`}
        >
          {STATUS_LABEL[e.status] ?? e.status}
        </span>
      ),
    },
    {
      key: 'inspected_by',
      header: 'LAST ACTION BY',
      render: (e) => (
        <span className="text-xs text-gray-700 dark:text-gray-300">
          {e.inspector_display_name || e.inspector_name || 'Inspector'}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'LAST ACTION DATE',
      render: (e) => {
        const d = e.completed_at || e.inspected_at || e.created_at;
        return (
          <span className="text-xs text-gray-500">
            {d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (e) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedInspection(e)}
            className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition-colors"
            title="View Inspection Details"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => handleDeleteInspection(e)}
            disabled={deletingId === e.id}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
            title="Delete Inspection Entry"
          >
            {deletingId === e.id ? (
              <Loader2 size={15} className="animate-spin text-red-500" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <TabsPageShell
      title="Inspections"
      description="Engineering Quality Checks for this project"
      onAdd={() => setShowAddModal(true)}
      addLabel="Add EQC"
    >
      {/* Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="Total" value={counts.total} color="teal" />
        <SummaryTile label="Passed" value={counts.passed} color="green" />
        <SummaryTile label="Failed" value={counts.failed} color="rose" />
        <SummaryTile label="Pending" value={counts.pending} color="amber" />
      </div>

      {/* Filter Bar (Image #20) */}
      <div className="card p-3 space-y-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* RFI Filter buttons */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {(['all', 'rfi', 'overdue'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRfiFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  rfiFilter === r
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {r === 'all' ? 'All' : r === 'rfi' ? 'RFI' : 'RFI Overdue'}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative flex items-center min-w-[220px]">
            <Search size={14} className="absolute left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by location, checklist..."
              className="input pl-9 pr-3 py-1.5 text-xs w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Dropdown Filters row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/60">
          {/* Checklist filter */}
          <div className="relative">
            <select
              value={checklistFilter}
              onChange={(e) => setChecklistFilter(e.target.value)}
              className="input text-xs py-1.5 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Checklist: All</option>
              {checklists.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* User / Inspector filter */}
          <div className="relative">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="input text-xs py-1.5 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">User: All</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Maker Team filter */}
          <div className="relative">
            <select
              value={makerTeamFilter}
              onChange={(e) => setMakerTeamFilter(e.target.value)}
              className="input text-xs py-1.5 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Maker Team: All</option>
              {teams.map((t) => (
                <option key={t.id} value={t.name || (t as any).team_name}>
                  {t.name || (t as any).team_name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Stage Status filter */}
          <div className="relative">
            <select
              value={stageStatusFilter}
              onChange={(e) => setStageStatusFilter(e.target.value)}
              className="input text-xs py-1.5 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Stage Status: All</option>
              <option value="pass">Completed / Pass</option>
              <option value="fail">Fail</option>
              <option value="pending">Pending</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Inspection Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-xs py-1.5 pl-3 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">Inspection Status: All</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {(statusFilter !== 'all' || checklistFilter !== 'all' || userFilter !== 'all' || makerTeamFilter !== 'all' || stageStatusFilter !== 'all' || rfiFilter !== 'all' || search) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setChecklistFilter('all');
                setUserFilter('all');
                setMakerTeamFilter('all');
                setStageStatusFilter('all');
                setRfiFilter('all');
                setSearch('');
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
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

      {/* Floating Add Button for quick access */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-xl shadow-teal-500/30 transition-all font-medium text-sm z-20 active:scale-95"
      >
        <Plus size={18} /> Add EQC
      </button>

      {/* Add EQC Wizard Modal (Images #17 & #18) */}
      {showAddModal && (
        <AddEQCWizardModal
          projectId={id}
          projectName={project?.name || 'Current Project'}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}

      {/* Inspection Detail / Summary View (Image #21) */}
      {selectedInspection && (
        <InspectionDetailModal
          inspection={selectedInspection}
          projectName={project?.name || 'Project'}
          onClose={() => setSelectedInspection(null)}
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
    <div className={`card p-4 bg-gradient-to-br ${palette[color]} rounded-2xl border border-gray-200/60 dark:border-gray-800`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────
 * ADD EQC WIZARD MODAL (Two-Step Flow: Step 1 = Image #17, Step 2 = Image #18)
 * ─────────────────────────────────────────────────────────────────
 */
function AddEQCWizardModal({
  projectId,
  projectName,
  onClose,
  onSuccess,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(true);
  const [selectedChecklistId, setSelectedChecklistId] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);

  // Location Hierarchy / Breadcrumbs
  const [locationSegments, setLocationSegments] = useState<string[]>([
    'TP',
    'Wing - NA',
    'F2',
    'Flat 201',
    'Bedroom',
    'Uut',
  ]);
  const [newSegment, setNewSegment] = useState('');
  const [customLocationText, setCustomLocationText] = useState('');
  const [useCustomLocation, setUseCustomLocation] = useState(false);

  // Step 2 state
  const [stages, setStages] = useState<ChecklistStage[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // Stage this submission covers — an inspection continues its existing entry
  // stage by stage instead of creating one row per stage.
  const [stageIndex, setStageIndex] = useState(1);

  const [selectedWitnesses, setSelectedWitnesses] = useState<string[]>(['Client', 'Contractor']);
  const [witnessPhotos, setWitnessPhotos] = useState<string[]>([]);
  const [drawingPhotos, setDrawingPhotos] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMakerTeam, setSelectedMakerTeam] = useState('Civil Execution Team');

  // Interactive Checkpoint Responses
  const [checkpointResponses, setCheckpointResponses] = useState<Record<number, {
    response: 'Yes' | 'No' | 'Skip';
    remark: string;
    photos: string[];
  }>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape key press and prevent background scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  // Fetch checklists on load
  useEffect(() => {
    async function loadChecklists() {
      setLoadingChecklists(true);
      try {
        const [projRes, libRes] = await Promise.all([
          fetch(`/api/checklists?project_id=${projectId}`),
          fetch('/api/checklists/library'),
        ]);
        const pList = await projRes.json().catch(() => []);
        const lList = await libRes.json().catch(() => []);

        const combinedMap = new Map<string, Checklist>();
        if (Array.isArray(pList)) pList.forEach((c) => combinedMap.set(c.id, c));
        if (Array.isArray(lList)) lList.forEach((c) => { if (!combinedMap.has(c.id)) combinedMap.set(c.id, c); });

        const list = Array.from(combinedMap.values());
        setChecklists(list);
        if (list.length > 0) {
          setSelectedChecklistId(list[0].id);
          setSelectedChecklist(list[0]);
        }
      } catch {
        // fallback
      } finally {
        setLoadingChecklists(false);
      }
    }
    loadChecklists();

    // Fetch teams
    fetch(`/api/projects/${projectId}/teams`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTeams(data);
          setSelectedMakerTeam(data[0].team_name || data[0].name || 'Civil Execution Team');
        }
      })
      .catch(() => {});
  }, [projectId]);

  // Load checklist details (stages + checkpoints) when moving to step 2
  const handleProceedToStep2 = async () => {
    if (!selectedChecklistId) {
      setError('Please select a checklist.');
      return;
    }
    setError('');
    setLoadingDetails(true);

    const location = (useCustomLocation
      ? customLocationText
      : locationSegments.filter(Boolean).join(' / ')
    ).trim();

    try {
      const [clRes, eqcRes] = await Promise.all([
        fetch(`/api/checklists/${selectedChecklistId}`),
        location
          ? fetch(
              `/api/projects/${projectId}/eqcs?checklist_id=${selectedChecklistId}&location=${encodeURIComponent(location)}`
            )
          : Promise.resolve(null),
      ]);
      const data = await clRes.json();

      const stgList: ChecklistStage[] = Array.isArray(data.stages) && data.stages.length > 0
        ? data.stages
        : [{ id: 'stage-1', checklist_id: selectedChecklistId, sr_no: 1, name: 'Pre-pour Inspection', created_at: '' }];

      // An inspection that is still mid-way is continued from its current stage
      // rather than started over as a new entry.
      const existingRows = eqcRes ? await eqcRes.json().catch(() => []) : [];
      const pendingEntry = Array.isArray(existingRows)
        ? existingRows.find((e: EQC) => e.stage_result === 'pending')
        : null;
      const nextStage = pendingEntry
        ? Math.min(Math.max(Number(pendingEntry.stage_index) || 1, 1), stgList.length)
        : 1;

      let cpList: Checkpoint[] = Array.isArray(data.checkpoints) ? data.checkpoints : [];

      // If the checklist has no checkpoints, provide standard quality checkpoints
      if (cpList.length === 0) {
        const stageId = stgList[nextStage - 1]?.id || stgList[0].id;
        cpList = [
          { id: 'cp-1', stage_id: stageId, sr_no: 1, question: 'Check reinforcement placement and concrete cover clearance', input_type: 'yes_no', photo_required: false, remark_required: false, created_at: '' },
          { id: 'cp-2', stage_id: stageId, sr_no: 2, question: 'Verify formwork alignment, plumbness, and structural stability', input_type: 'yes_no', photo_required: false, remark_required: false, created_at: '' },
          { id: 'cp-3', stage_id: stageId, sr_no: 3, question: 'Check cleanliness of pour area and removal of debris/slurry', input_type: 'yes_no', photo_required: false, remark_required: false, created_at: '' },
          { id: 'cp-4', stage_id: stageId, sr_no: 4, question: 'Confirm embedded conduits, boxes, and sleeve fixtures positioning', input_type: 'yes_no', photo_required: false, remark_required: false, created_at: '' },
          { id: 'cp-5', stage_id: stageId, sr_no: 5, question: 'Inspect dowel bars, lap lengths, and tie-wire anchoring', input_type: 'yes_no', photo_required: false, remark_required: false, created_at: '' },
          { id: 'cp-6', stage_id: stageId, sr_no: 6, question: 'Review safety barriers, working platforms, and access points', input_type: 'yes_no', photo_required: false, remark_required: false, created_at: '' },
        ];
      }

      // Only the stage being inspected now is answered; earlier stages stay as recorded.
      const stageId = stgList[nextStage - 1]?.id;
      const stageCheckpoints = cpList.filter((cp) => cp.stage_id === stageId);
      const visibleCheckpoints = stageCheckpoints.length > 0 ? stageCheckpoints : cpList;

      setStages(stgList);
      setStageIndex(nextStage);
      setCheckpoints(visibleCheckpoints);
      setWitnessPhotos([]);
      setDrawingPhotos([]);

      // Pre-initialize responses default
      const initialResponses: Record<number, { response: 'Yes' | 'No' | 'Skip'; remark: string; photos: string[] }> = {};
      for (let idx = 0; idx < visibleCheckpoints.length; idx++) {
        initialResponses[idx] = {
          response: 'Yes',
          remark: '',
          photos: [],
        };
      }
      setCheckpointResponses(initialResponses);
      setStep(2);
    } catch (err) {
      setError('Failed to load checklist checkpoints: ' + (err as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formattedLocation = useCustomLocation
    ? customLocationText
    : locationSegments.filter(Boolean).join(' / ');

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setter((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCheckpointPhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    cpIndex: number
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCheckpointResponses((prev) => {
            const current = prev[cpIndex] || { response: 'Yes', remark: '', photos: [] };
            return {
              ...prev,
              [cpIndex]: {
                ...current,
                photos: [...(current.photos || []), reader.result as string],
              },
            };
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const answeredCount = Object.values(checkpointResponses).filter((r) => r.response).length;
  const totalCheckpoints = checkpoints.length;

  const handleSubmit = async () => {
    setSubmittedAttempt(true);
    setError('');

    // Defensive validation for required fields
    const missing: string[] = [];

    const currentStage = stages[stageIndex - 1];
    if (currentStage?.witness_required && selectedWitnesses.length === 0) {
      missing.push('Witness Selection');
    }
    if (currentStage?.drawing_required && drawingPhotos.length === 0) {
      missing.push('Drawing Details Photo');
    }

    checkpoints.forEach((cp, idx) => {
      const resp = checkpointResponses[idx] || { response: 'Yes', remark: '', photos: [] };
      if (cp.remark_required && !resp.remark?.trim()) {
        missing.push(`Checkpoint #${cp.sr_no || idx + 1} Remark`);
      }
      if (cp.photo_required && (!resp.photos || resp.photos.length === 0)) {
        missing.push(`Checkpoint #${cp.sr_no || idx + 1} Photo`);
      }
    });

    if (missing.length > 0) {
      setError(`Please complete all required fields marked with * (${missing.join(', ')}).`);
      return;
    }

    setSubmitting(true);

    try {
      const results: CheckpointResult[] = checkpoints.map((cp, idx) => {
        const resp = checkpointResponses[idx] || { response: 'Yes', remark: '', photos: [] };
        return {
          checkpoint_id: cp.id,
          stage_id: cp.stage_id,
          sr_no: cp.sr_no || idx + 1,
          question: cp.question,
          response: resp.response,
          status: resp.response === 'Yes' ? 'pass' : resp.response === 'No' ? 'fail' : 'skip',
          remark: resp.remark,
          photos: resp.photos,
        };
      });

      const hasFail = results.some((r) => r.response === 'No');
      const stageResult = hasFail ? 'fail' : 'pass';
      const status = hasFail ? 'failed' : 'passed';
      const stageName = stages[stageIndex - 1]?.name || `Stage ${stageIndex}`;
      const now = new Date().toISOString();

      const payload = {
        project_id: projectId,
        location: formattedLocation || 'Main Block / Level 1',
        checklist_id: selectedChecklistId,
        stage_index: stageIndex,
        total_stages: stages.length || 1,
        stage_result: stageResult,
        status: status,
        maker_team: selectedMakerTeam,
        witness_types: selectedWitnesses,
        witness_photos: witnessPhotos,
        drawing_photos: drawingPhotos,
        inspection_data: results,
        // Per-stage summary so the detail view can show each stage on its own tab
        stage_data: {
          stage_id: stages[stageIndex - 1]?.id,
          stage_index: stageIndex,
          name: stageName,
          stage_result: stageResult,
          completed_at: now,
          synced_at: now,
          time_taken: '12 mins',
          geo_tag: '19.0760° N, 72.8777° E',
          maker_team: selectedMakerTeam,
          witnesses: selectedWitnesses,
          witness_photos: witnessPhotos,
          drawing_photos: drawingPhotos,
          total_checkpoints: results.length,
          passed_checkpoints: results.filter((r) => r.response === 'Yes').length,
        },
        geo_tag: '19.0760° N, 72.8777° E',
        time_taken: '12 mins',
        completed_at: now,
        synced_at: now,
        inspector_name: 'Inspector',
      };

      const res = await fetch(`/api/projects/${projectId}/eqcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save inspection');
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-6 animate-scale-in cursor-default"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ─── STEP 1: Project, Checklist & Location (Image #17) ─── */}
        {step === 1 && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add EQC</h2>
                <p className="text-xs text-gray-500">Step 1 of 2: Select Checklist & Location</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Project display */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Project
                </label>
                <input
                  type="text"
                  disabled
                  value={projectName}
                  className="input bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium cursor-not-allowed"
                />
              </div>

              {/* Checklist Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Checklist *
                </label>
                {loadingChecklists ? (
                  <div className="py-4 flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 size={14} className="animate-spin text-teal-500" />
                    <span>Loading checklists…</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedChecklistId}
                      onChange={(e) => {
                        setSelectedChecklistId(e.target.value);
                        setSelectedChecklist(checklists.find((c) => c.id === e.target.value) || null);
                      }}
                      className="input appearance-none pr-10 text-sm font-medium"
                    >
                      {checklists.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.reference_number ? `(${c.reference_number})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Location Tag / Breadcrumb Builder (Image #17) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Location Tags / Breadcrumbs *
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomLocation(!useCustomLocation)}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    {useCustomLocation ? 'Use Tag Builder' : 'Custom Text Input'}
                  </button>
                </div>

                {!useCustomLocation ? (
                  <div className="space-y-3">
                    {/* Active tags pills */}
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-700">
                      {locationSegments.map((segment, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 shadow-sm"
                        >
                          <span>{segment}</span>
                          <button
                            type="button"
                            onClick={() => setLocationSegments(locationSegments.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-rose-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      {/* Add segment inline */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="+ Add tag (e.g. F2, Flat 101)"
                          value={newSegment}
                          onChange={(e) => setNewSegment(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSegment.trim()) {
                              e.preventDefault();
                              setLocationSegments([...locationSegments, newSegment.trim()]);
                              setNewSegment('');
                            }
                          }}
                          className="px-2.5 py-1 text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 outline-none w-44"
                        />
                        {newSegment.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setLocationSegments([...locationSegments, newSegment.trim()]);
                              setNewSegment('');
                            }}
                            className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Live Preview */}
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 p-2.5 bg-teal-50/50 dark:bg-teal-500/10 rounded-xl border border-teal-200/50 dark:border-teal-500/20">
                      <MapPin size={14} className="text-teal-600 shrink-0" />
                      <span className="font-semibold text-teal-900 dark:text-teal-300">Path:</span>
                      <span className="font-mono text-gray-800 dark:text-gray-200">
                        {formattedLocation || 'No location specified'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. TP / Wing - NA / F2 / Flat 201 / Bedroom / Uut"
                      value={customLocationText}
                      onChange={(e) => setCustomLocationText(e.target.value)}
                      className="input"
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToStep2}
                disabled={loadingDetails || !selectedChecklistId}
                className="btn-primary flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loadingDetails ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>Next: Inspection Details</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Execution & Response Screen (Image #18) ─── */}
        {step === 2 && (
          <div>
            {/* Header with Checklist and Progress */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Step 1"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {selectedChecklist?.name || 'Inspection'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Stage {stageIndex} of {stages.length || 1}: {stages[stageIndex - 1]?.name || 'Execution Check'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-full text-xs font-semibold">
                  <CheckCircle size={13} />
                  <span>{answeredCount}/{totalCheckpoints} Answered</span>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable execution content */}
            <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
              {/* Location Bar */}
              <div className="flex items-center gap-2 p-3 bg-teal-500/10 text-teal-800 dark:text-teal-200 rounded-2xl border border-teal-500/20 text-xs">
                <MapPin size={15} className="text-teal-600 shrink-0" />
                <span className="font-medium">Location:</span>
                <span className="font-mono font-semibold">{formattedLocation}</span>
              </div>

              {/* 1. Inspection Witness Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Inspection Witness {stages[stageIndex - 1]?.witness_required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
                  </label>
                  {stages[stageIndex - 1]?.witness_required && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded-full">
                      Required *
                    </span>
                  )}
                </div>
                <div className={`flex flex-wrap gap-2 p-2 rounded-2xl transition-all ${
                  submittedAttempt && stages[stageIndex - 1]?.witness_required && selectedWitnesses.length === 0
                    ? 'border-2 border-rose-400 bg-rose-50/30 dark:bg-rose-500/10'
                    : ''
                }`}>
                  {WITNESS_OPTIONS.map((w) => {
                    const active = selectedWitnesses.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setSelectedWitnesses(selectedWitnesses.filter((item) => item !== w));
                          } else {
                            setSelectedWitnesses([...selectedWitnesses, w]);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                          active
                            ? 'bg-teal-600 text-white shadow-sm shadow-teal-300/40'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {active && <Check size={11} className="inline mr-1" />}
                        {w}
                      </button>
                    );
                  })}
                </div>

                {submittedAttempt && stages[stageIndex - 1]?.witness_required && selectedWitnesses.length === 0 && (
                  <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 pl-1">
                    <AlertCircle size={12} /> Please select at least one inspection witness
                  </p>
                )}

                {/* Witness Photo upload */}
                <div className="pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer text-xs text-gray-600 dark:text-gray-300 font-medium transition-colors">
                      <Camera size={14} className="text-teal-600 dark:text-teal-400" />
                      <span>+ Add Witness Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setWitnessPhotos)}
                      />
                    </label>

                    {witnessPhotos.map((photo, i) => (
                      <div key={i} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Witness ${i}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setWitnessPhotos(witnessPhotos.filter((_, idx) => idx !== i))}
                          className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Drawing Details Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Drawing Details {stages[stageIndex - 1]?.drawing_required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
                  </label>
                  {stages[stageIndex - 1]?.drawing_required && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded-full">
                      Required *
                    </span>
                  )}
                </div>
                <div className={`flex flex-wrap items-center gap-3 p-2 rounded-2xl transition-all ${
                  submittedAttempt && stages[stageIndex - 1]?.drawing_required && drawingPhotos.length === 0
                    ? 'border-2 border-rose-400 bg-rose-50/30 dark:bg-rose-500/10'
                    : ''
                }`}>
                  <label className={`flex items-center gap-2 px-3 py-2 border rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold transition-colors ${
                    submittedAttempt && stages[stageIndex - 1]?.drawing_required && drawingPhotos.length === 0
                      ? 'border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                      : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300'
                  }`}>
                    <FileText size={14} className={stages[stageIndex - 1]?.drawing_required ? 'text-rose-500' : 'text-teal-600 dark:text-teal-400'} />
                    <span>+ Add Drawing Photo</span>
                    {stages[stageIndex - 1]?.drawing_required && <span className="text-rose-500 font-bold">*</span>}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setDrawingPhotos)}
                    />
                  </label>

                  {drawingPhotos.map((photo, i) => (
                    <div key={i} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`Drawing ${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setDrawingPhotos(drawingPhotos.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {submittedAttempt && stages[stageIndex - 1]?.drawing_required && drawingPhotos.length === 0 && (
                  <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 pl-1">
                    <AlertCircle size={12} /> Drawing details photo is required for this stage
                  </p>
                )}
              </div>

              {/* 3. Maker Team Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Maker Team
                </label>
                <select
                  value={selectedMakerTeam}
                  onChange={(e) => setSelectedMakerTeam(e.target.value)}
                  className="input max-w-sm text-xs font-medium"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name || (t as any).team_name}>
                      {t.name || (t as any).team_name}
                    </option>
                  ))}
                  <option value="Civil Execution Team">Civil Execution Team</option>
                  <option value="Finishing Team">Finishing Team</option>
                  <option value="MEP Team">MEP Team</option>
                  <option value="Developer Team">Developer Team</option>
                </select>
              </div>

              {/* 4. Checkpoints Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Checkpoints ({checkpoints.length})
                  </label>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Fields marked with <span className="text-rose-500 font-bold">*</span> are required
                  </span>
                </div>

                <div className="space-y-3">
                  {checkpoints.map((cp, idx) => {
                    const current = checkpointResponses[idx] || { response: 'Yes', remark: '', photos: [] };
                    const isRemarkMissing = submittedAttempt && cp.remark_required && !current.remark?.trim();
                    const isPhotoMissing = submittedAttempt && cp.photo_required && (!current.photos || current.photos.length === 0);
                    const hasError = isRemarkMissing || isPhotoMissing;

                    return (
                      <div
                        key={cp.id || idx}
                        className={`p-4 rounded-2xl border transition-all shadow-sm space-y-3 ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-500/10 dark:border-rose-500/40 ring-1 ring-rose-400'
                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="text-xs font-medium text-gray-900 dark:text-white leading-relaxed flex-1">
                            <span className="font-bold text-teal-600 dark:text-teal-400 mr-2">{idx + 1}.</span>
                            <span>{cp.question}</span>
                            <div className="inline-flex items-center gap-1.5 ml-2 align-middle">
                              {cp.photo_required && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-1.5 py-0.5 rounded">
                                  Photo *
                                </span>
                              )}
                              {cp.remark_required && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-1.5 py-0.5 rounded">
                                  Remark *
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Yes / No / Skip */}
                          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900/80 p-1 rounded-xl shrink-0 border border-gray-200/60 dark:border-gray-700/60">
                            <button
                              type="button"
                              onClick={() =>
                                setCheckpointResponses({
                                  ...checkpointResponses,
                                  [idx]: { ...current, response: 'Yes' },
                                })
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                current.response === 'Yes'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCheckpointResponses({
                                  ...checkpointResponses,
                                  [idx]: { ...current, response: 'No' },
                                })
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                current.response === 'No'
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400'
                              }`}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCheckpointResponses({
                                  ...checkpointResponses,
                                  [idx]: { ...current, response: 'Skip' },
                                })
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                current.response === 'Skip'
                                  ? 'bg-gray-600 text-white shadow-sm'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                              Skip
                            </button>
                          </div>
                        </div>

                        {/* Optional / Required Remarks and Photo Upload per Checkpoint */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder={cp.remark_required ? 'Add remark (required) *' : 'Add remark (optional)…'}
                                value={current.remark || ''}
                                onChange={(e) =>
                                  setCheckpointResponses({
                                    ...checkpointResponses,
                                    [idx]: { ...current, remark: e.target.value },
                                  })
                                }
                                className={`input py-1.5 text-xs w-full rounded-xl border transition-colors ${
                                  isRemarkMissing
                                    ? 'border-rose-400 bg-rose-50/40 text-rose-900 dark:text-rose-200 focus:ring-rose-500'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                                }`}
                              />
                            </div>

                            <label className={`flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold transition-colors shrink-0 ${
                              isPhotoMissing
                                ? 'border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}>
                              <Camera size={13} className={cp.photo_required ? 'text-rose-500' : 'text-teal-600 dark:text-teal-400'} />
                              <span>Photo</span>
                              {cp.photo_required && <span className="text-rose-500 font-bold">*</span>}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleCheckpointPhotoUpload(e, idx)}
                              />
                            </label>
                          </div>

                          {/* Individual error messages for missing checkpoint photo or remark */}
                          {isRemarkMissing && (
                            <p className="text-[10px] text-rose-500 font-semibold pl-1 flex items-center gap-1">
                              <AlertCircle size={10} /> Remark is required for this checkpoint
                            </p>
                          )}
                          {isPhotoMissing && (
                            <p className="text-[10px] text-rose-500 font-semibold pl-1 flex items-center gap-1">
                              <AlertCircle size={10} /> Photo upload is required for this checkpoint
                            </p>
                          )}
                        </div>

                        {/* Checkpoint Photos Previews */}
                        {current.photos && current.photos.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            {current.photos.map((ph, pi) => (
                              <div key={pi} className="relative group w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ph} alt={`CP ${idx} photo ${pi}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = current.photos.filter((_, pidx) => pidx !== pi);
                                    setCheckpointResponses({
                                      ...checkpointResponses,
                                      [idx]: { ...current, photos: updated },
                                    });
                                  }}
                                  className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertCircle size={14} className="shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex items-center gap-1 text-xs"
              >
                <ArrowLeft size={13} /> Back
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-full shadow-lg shadow-teal-500/20"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                <span>{submitting ? 'Submitting…' : 'Submit EQC'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────
 * INSPECTION DETAIL MODAL (Summary & Stage Details - Image #21)
 * ─────────────────────────────────────────────────────────────────
 */
function InspectionDetailModal({
  inspection,
  projectName,
  onClose,
}: {
  inspection: EQC;
  projectName: string;
  onClose: () => void;
}) {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  // Checklist stages + checkpoints for the checklist this EQC ran against, so
  // recorded responses can be shown stage-wise
  const [stageDefs, setStageDefs] = useState<ChecklistStage[]>([]);
  const [checkpointDefs, setCheckpointDefs] = useState<Checkpoint[]>([]);
  const [checkpointStageMap, setCheckpointStageMap] = useState<Record<string, string>>({});

  // Close modal or enlarged photo on Escape key press, lock background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (enlargedImage) {
          setEnlargedImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose, enlargedImage]);

  const rawInspectionData = inspection.inspection_data;
  let parsedCheckpoints: CheckpointResult[] = [];
  if (Array.isArray(rawInspectionData)) {
    parsedCheckpoints = rawInspectionData;
  } else if (typeof rawInspectionData === 'string') {
    try {
      parsedCheckpoints = JSON.parse(rawInspectionData);
    } catch {
      parsedCheckpoints = [];
    }
  }

  // Load the checklist's stage definitions so checkpoints can be shown stage-wise
  useEffect(() => {
    let cancelled = false;
    if (!inspection.checklist_id) {
      setStageDefs([]);
      setCheckpointDefs([]);
      setCheckpointStageMap({});
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/checklists/${inspection.checklist_id}`);
        const data = await res.json();
        if (cancelled) return;
        setStageDefs(Array.isArray(data?.stages) ? data.stages : []);
        const defs: Checkpoint[] = Array.isArray(data?.checkpoints) ? data.checkpoints : [];
        setCheckpointDefs(defs);
        const map: Record<string, string> = {};
        defs.forEach((cp) => {
          if (cp?.id && cp?.stage_id) map[cp.id] = cp.stage_id;
        });
        setCheckpointStageMap(map);
      } catch {
        if (!cancelled) {
          setStageDefs([]);
          setCheckpointDefs([]);
          setCheckpointStageMap({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inspection.checklist_id]);

  /**
   * Group the recorded checkpoints into stages.
   * A checkpoint is matched to its stage by its recorded stage_id, or by the
   * checklist's own checkpoint→stage mapping. A stage that has not been
   * inspected yet still lists the checkpoints it will ask for, and anything
   * left unmatched is spread across the stages in order so older inspections
   * without stage ids also render stage-wise.
   */
  const stageGroups = (() => {
    const totalStages = Math.max(inspection.total_stages || 1, stageDefs.length, 1);

    const groups = Array.from({ length: totalStages }, (_, i) => {
      const def = stageDefs[i];
      return {
        key: def?.id ?? `stage-${i + 1}`,
        name: def?.name || `Stage ${i + 1}`,
        index: def?.index ?? def?.sr_no ?? i + 1,
        total: totalStages,
        witnessRequired: !!def?.witness_required,
        drawingRequired: !!def?.drawing_required,
        recorded: [] as CheckpointResult[],
        expected: 0,
      };
    });

    const unassigned: CheckpointResult[] = [];
    parsedCheckpoints.forEach((cp) => {
      const stageId = cp.stage_id || (cp.checkpoint_id ? checkpointStageMap[cp.checkpoint_id] : undefined);
      const pos = stageId ? groups.findIndex((g) => g.key === stageId) : -1;
      if (pos >= 0) {
        groups[pos].recorded.push(cp);
      } else {
        unassigned.push(cp);
      }
    });

    // Spread checkpoints with no stage reference across the stages in order
    if (unassigned.length > 0) {
      const open = groups.filter((g) => g.recorded.length === 0);
      const targets = open.length > 0 ? open : groups;
      unassigned.forEach((cp, i) => {
        targets[i % targets.length].recorded.push(cp);
      });
    }

    // How many checkpoints each stage will ask for, and the placeholders for
    // the ones the inspector has not reached yet.
    const defsByStage = new Map<string, Checkpoint[]>();
    checkpointDefs.forEach((cp) => {
      const list = defsByStage.get(cp.stage_id) ?? [];
      list.push(cp);
      defsByStage.set(cp.stage_id, list);
    });

    return groups.map((g) => {
      const answered = new Set(g.recorded.map((cp) => cp.checkpoint_id).filter(Boolean));
      const pending: CheckpointResult[] = (defsByStage.get(g.key) ?? [])
        .filter((cp) => !answered.has(cp.id))
        .sort((a, b) => (a.sr_no || 0) - (b.sr_no || 0))
        .map((cp) => ({
          checkpoint_id: cp.id,
          stage_id: cp.stage_id,
          sr_no: cp.sr_no,
          question: cp.question,
          response: '',
          status: 'pending' as const,
        }));

      return {
        ...g,
        recorded: g.recorded.sort((a, b) => (a.sr_no || 0) - (b.sr_no || 0)),
        checkpoints: [...g.recorded, ...pending],
        expected: g.recorded.length + pending.length,
      };
    });
  })();

  const stageCount = stageGroups.length;
  const activeStage = stageGroups[Math.min(activeStageIndex, stageCount - 1)] ?? stageGroups[0];
  const activeCheckpoints = activeStage?.checkpoints ?? [];

  const stageStats = (cps: CheckpointResult[]) => ({
    pass: cps.filter((c) => c.response === 'Yes').length,
    fail: cps.filter((c) => c.response === 'No').length,
    skip: cps.filter((c) => c.response !== 'Yes' && c.response !== 'No').length,
  });

  // Per-stage summary recorded when that stage was submitted; older entries that
  // predate stage-wise storage fall back to the row-level values.
  const stageSummaries: EQCStageData[] = Array.isArray(inspection.stages_data) ? inspection.stages_data : [];
  const activeStageSummary =
    stageSummaries.find((s) => Number(s.stage_index) === Number(activeStage?.index)) ??
    stageSummaries.find((s) => s.stage_id && s.stage_id === activeStage?.key) ??
    null;

  const stageResultOf = (stage: typeof activeStage, summary: EQCStageData | null) => {
    const stats = stageStats(stage?.checkpoints ?? []);
    if (stats.fail > 0) return 'fail';
    if (stats.pass > 0 || summary) return 'pass';
    return 'pending';
  };
  const activeResult = stageResultOf(activeStage, activeStageSummary);

  const witnessList =
    (activeStageSummary?.witnesses?.length ? activeStageSummary.witnesses : null) ??
    (Array.isArray(inspection.witness_types) && inspection.witness_types.length > 0
      ? inspection.witness_types
      : []);

  const witnessPhotos = activeStageSummary?.witness_photos ?? inspection.witness_photos ?? [];
  const drawingPhotos = activeStageSummary?.drawing_photos ?? inspection.drawing_photos ?? [];

  const completedTime =
    activeStageSummary?.completed_at || inspection.completed_at || inspection.inspected_at || inspection.created_at;
  const syncedTime =
    activeStageSummary?.synced_at || inspection.synced_at || inspection.inspected_at || inspection.created_at;
  const geoTag = activeStageSummary?.geo_tag || inspection.geo_tag || '';
  const timeTaken = activeStageSummary?.time_taken || inspection.time_taken || '';
  const makerTeam = activeStageSummary?.maker_team || inspection.maker_team || '';
  const inspectedBy = activeStageSummary?.inspector_name || inspection.inspector_display_name || inspection.inspector_name || 'Inspector';
  const inspectedByTeam = activeStageSummary?.inspector_team || inspection.inspector_team || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-6 animate-scale-in cursor-default"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
                <span>Valid8</span>
                <span>/</span>
                <span>{projectName}</span>
                <span>/</span>
                <span>Inspections</span>
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Inspection Detail
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Printer size={13} /> Detailed Report
            </button>
            <button
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Download size={13} /> Final Report
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ml-2"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

          {/* 1. Inspection Summary */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Inspection Summary</h3>
              <button
                onClick={() => {
                  const el = document.getElementById('eqc-approver-comment-input');
                  el?.focus();
                }}
                className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                title="Jump to the approver comment column below"
              >
                <FileText size={13} /> Auditor Comments
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</p>
                <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 truncate" title={inspection.location}>
                  {inspection.location || '—'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Checklist</p>
                <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 truncate" title={inspection.checklist_name}>
                  {inspection.checklist_name || 'Quality Inspection'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UOM</p>
                <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                  {inspection.checklist_uom || 'Nos'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inspection Status</p>
                <span
                  className={`badge text-xs mt-0.5 inline-block ${
                    inspection.status === 'passed'
                      ? 'badge-active'
                      : inspection.status === 'failed'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      : 'badge-on_hold'
                  }`}
                >
                  {STATUS_LABEL[inspection.status] ?? inspection.status}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time Taken</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                  <Clock size={12} className="text-teal-600 shrink-0" />
                  <span>{inspection.time_taken || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Stage tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
            {stageGroups.map((stage, idx) => {
              const stats = stageStats(stage.recorded);
              const isActive = idx === Math.min(activeStageIndex, stageCount - 1);
              return (
                <button
                  key={stage.key}
                  onClick={() => setActiveStageIndex(idx)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-teal-600 text-teal-700 dark:text-teal-400 bg-teal-50/60 dark:bg-teal-500/10'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                  title={`${stage.name} — ${stats.pass} of ${stage.expected} checkpoint(s) passed`}
                >
                  <span className="truncate max-w-[190px]">{stage.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      stats.fail > 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'
                        : stage.recorded.length > 0
                        ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    }`}
                  >
                    {stats.pass}/{stage.expected}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. Active stage details */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {activeStage?.name || 'Stage'}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Stage {activeStage?.index ?? 1} of {stageCount}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`badge text-[11px] ${
                    activeResult === 'fail'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      : activeResult === 'pass'
                      ? 'badge-active'
                      : 'badge-on_hold'
                  }`}
                >
                  {activeResult === 'fail' ? 'Failed' : activeResult === 'pass' ? 'Pass' : 'Pending'}
                </span>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary flex items-center gap-1.5 text-[11px] py-1.5 px-3"
                >
                  <Download size={12} /> Download Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-xs">
              <div>
                <p className="text-gray-400 font-medium">Inspected By</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {inspectedBy[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {inspectedBy}
                  </span>
                </div>
                {inspectedByTeam && (
                  <p className="text-[11px] text-gray-400 mt-1 pl-8">{inspectedByTeam}</p>
                )}
              </div>

              <div>
                <p className="text-gray-400 font-medium">Completed On</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 mt-1">
                  {completedTime ? new Date(completedTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-400 font-medium">Synced On</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 mt-1">
                  {syncedTime ? new Date(syncedTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-400 font-medium">Geo Tag</p>
                <div className="flex items-center gap-1 font-mono text-gray-700 dark:text-gray-300 mt-1">
                  <MapPin size={12} className="text-teal-600 shrink-0" />
                  <span>{geoTag || '—'}</span>
                </div>
              </div>

              <div>
                <p className="text-gray-400 font-medium">Time Taken</p>
                <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 mt-1">
                  <Clock size={12} className="text-teal-600 shrink-0" />
                  <span>{timeTaken || '—'}</span>
                </div>
              </div>

              <div>
                <p className="text-gray-400 font-medium">Maker Team</p>
                <p className="font-semibold text-gray-800 dark:text-gray-200 mt-1">
                  {makerTeam || '—'}
                </p>
              </div>

              <div>
                <p className="text-gray-400 font-medium">Stage Status</p>
                <span
                  className={`badge text-[11px] mt-1 inline-block ${
                    activeResult === 'fail'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      : activeResult === 'pass'
                      ? 'badge-active'
                      : 'badge-on_hold'
                  }`}
                >
                  {activeResult === 'fail' ? 'Fail' : activeResult === 'pass' ? 'Pass' : 'Pending'}
                </span>
              </div>

              <div>
                <p className="text-gray-400 font-medium">Witnesses</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {witnessList.length > 0 ? (
                    witnessList.map((w, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-500/20 rounded-full text-[10px] font-medium">
                        {w}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Photos recorded against this stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs font-bold text-gray-400 mb-2">Witness Photos</p>
                {witnessPhotos.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {witnessPhotos.map((photo, pi) => (
                      <button
                        key={pi}
                        onClick={() => setEnlargedImage(photo)}
                        className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="Witness" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No witness photos attached</p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 mb-2">Drawing Details</p>
                {drawingPhotos.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {drawingPhotos.map((photo, pi) => (
                      <button
                        key={pi}
                        onClick={() => setEnlargedImage(photo)}
                        className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="Drawing" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No drawings attached</p>
                )}
              </div>
            </div>
          </div>

          {/* 4. Checkpoints of the active stage */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {activeStage?.name || 'Stage'} Checkpoints ({activeCheckpoints.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                  <tr className="text-gray-500 uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-2.5 text-left font-semibold w-12">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Checkpoint</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-24">Response</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-20">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Remark</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-24">Photo</th>
                    <th className="px-4 py-2.5 text-left font-semibold w-28">Approver Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {activeCheckpoints.map((cp, idx) => {
                    const passed = cp.response === 'Yes';
                    const failed = cp.response === 'No';
                    const answered = !!cp.response;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 font-semibold text-gray-400">{cp.sr_no || idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {cp.question}
                        </td>
                        <td className="px-4 py-3">
                          {answered ? (
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-block ${
                                passed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : failed
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {cp.response}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {answered ? (
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-block ${
                                failed
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                                  : passed
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                              }`}
                            >
                              {cp.status
                                ? cp.status.charAt(0).toUpperCase() + cp.status.slice(1)
                                : failed
                                ? 'Fail'
                                : passed
                                ? 'Pass'
                                : 'Skip'}
                            </span>
                          ) : (
                            <span className="badge badge-on_hold text-[10px]">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {cp.remark?.trim() ? cp.remark : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {cp.photos && cp.photos.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {cp.photos.map((ph, pi) => (
                                <button
                                  key={pi}
                                  onClick={() => setEnlargedImage(ph)}
                                  className="w-7 h-7 rounded-lg overflow-hidden border border-gray-200 shrink-0 hover:scale-105 transition-transform"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={ph} alt="CP attachment" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            id={idx === 0 ? 'eqc-approver-comment-input' : undefined}
                            type="text"
                            defaultValue={cp.approver_comment || ''}
                            placeholder="Add comment…"
                            className="input py-1 px-2 text-[11px] w-full min-w-[110px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {activeCheckpoints.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                        No checkpoints defined for this stage
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>

      {/* Enlarged Image Viewer */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 font-bold text-sm flex items-center gap-1"
            >
              <X size={18} /> Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlargedImage}
              alt="Enlarged inspection view"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
