'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    GripVertical,
    Trash2,
    Pencil,
    CheckCircle2,
    XCircle,
    Rocket,
    X,
    Loader2,
} from 'lucide-react';
import { Checklist, ChecklistStage, Checkpoint, ProjectMember, ProjectTeam } from '@/lib/types';
import StageFormModal from '@/components/StageFormModal';
import CheckpointFormModal from '@/components/CheckpointFormModal';

export default function ProjectChecklistDetail() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = params.id as string;
    const checklistId = params.checklistId as string;
    const initialName = searchParams.get('name');

    const [checklist, setChecklist] = useState<Checklist | null>(null);
    const [stages, setStages] = useState<ChecklistStage[]>([]);
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [activeStageId, setActiveStageId] = useState<string | null>(null);
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
    const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/checklists/${checklistId}`);
            if (!res.ok) throw new Error('Failed to fetch checklist');
            const data = await res.json();

            setChecklist(data);
            setStages(data.stages);
            setCheckpoints(data.checkpoints);
        } catch (error) {
            console.error('Error loading checklist:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [checklistId]);

    const handleReorderStages = async (newStages: ChecklistStage[]) => {
        const stageIds = newStages.map(s => s.id);
        setStages(newStages);
        setSaving(true);
        try {
            await fetch(`/api/checklists/${checklistId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reorder_stages: stageIds }),
            });
        } catch (error) {
            console.error('Error reordering stages:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReorderCheckpoints = async (newCheckpoints: Checkpoint[]) => {
        const reorderData = newCheckpoints.map((cp, idx) => ({
            id: cp.id,
            sr_no: idx + 1
        }));
        setCheckpoints(newCheckpoints);
        setSaving(true);
        try {
            await fetch(`/api/checklists/${checklistId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reorder_checkpoints: reorderData }),
            });
        } catch (error) {
            console.error('Error reordering checkpoints:', error);
        } finally {
            setSaving(false);
        }
    };

    // Native Drag and Drop Handlers for Stages
    const [draggedStageIdx, setDraggedStageIdx] = useState<number | null>(null);

    const onDragStartStage = (idx: number) => setDraggedStageIdx(idx);
    const onDragOverStage = (e: React.DragEvent) => e.preventDefault();
    const onDropStage = (idx: number) => {
        if (draggedStageIdx === null) return;
        const newStages = [...stages];
        const [removed] = newStages.splice(draggedStageIdx, 1);
        newStages.splice(idx, 0, removed);
        handleReorderStages(newStages);
        setDraggedStageIdx(null);
    };

    // Native Drag and Drop Handlers for Checkpoints
    const [draggedCpIdx, setDraggedCpIdx] = useState<number | null>(null);

    const onDragStartCp = (idx: number) => setDraggedCpIdx(idx);
    const onDragOverCp = (e: React.DragEvent) => e.preventDefault();
    const onDropCp = (idx: number) => {
        if (draggedCpIdx === null) return;
        const newCheckpoints = [...checkpoints];
        const [removed] = newCheckpoints.splice(draggedCpIdx, 1);
        newCheckpoints.splice(idx, 0, removed);
        handleReorderCheckpoints(newCheckpoints);
        setDraggedCpIdx(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    const activeStage = stages.find(s => s.id === activeStageId);
    const stageCheckpoints = checkpoints.filter(cp => cp.stage_id === activeStageId);

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                        {checklist?.name || initialName || 'Loading checklist...'}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsLiveModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full text-sm font-medium transition-colors"
                    >
                        <Rocket size={16} /> Go Live
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Stages */}
                <div className="w-80 flex flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
                    <div className="p-6 flex items-center justify-between">
                        <h2 className="text-base font-medium text-gray-900 dark:text-white">Stages</h2>
                        <button
                            onClick={() => setIsStageModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full text-xs font-medium hover:bg-slate-800 transition-colors"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>

                    <div className="px-6 pb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">NAME</span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 space-y-1">
                        {stages.map((stage, idx) => (
                            <div
                                key={stage.id}
                                draggable
                                onDragStart={() => onDragStartStage(idx)}
                                onDragOver={onDragOverStage}
                                onDrop={() => onDropStage(idx)}
                                onClick={() => setActiveStageId(stage.id)}
                                className={`group flex items-center gap-3 py-2 cursor-pointer transition-all ${activeStageId === stage.id
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <GripVertical size={14} className="text-gray-300 group-hover:text-gray-400 cursor-grab" />
                                <span className="text-sm font-medium flex-1 truncate">{stage.name}</span>
                                <div className="flex items-center gap-1">
                                    <button className="p-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><Pencil size={14} /></button>
                                    <button className="p-1 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50">1</button>
                        </div>
                        <span className="text-xs text-gray-400">10 / page</span>
                    </div>
                </div>

                {/* Main Content: Checkpoints */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 p-8">
                    {activeStage ? (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-medium text-gray-900 dark:text-white">{activeStage.name}</h2>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsCheckpointModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full text-xs font-medium hover:bg-slate-800 transition-colors"
                                    >
                                        <Plus size={14} /> Item
                                    </button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                        <Plus size={14} /> Bulk Items
                                    </button>
                                </div>
                            </div>

                            {/* Stage Requirements */}
                            <div className="flex items-center gap-8 border-b border-gray-100 dark:border-gray-800 pb-4">
                                <div className="relative">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">Stage Requirements</span>
                                    <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-orange-500 rounded-full" />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Witness Required</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Drawing Required</span>
                                </label>
                            </div>

                            {/* Checkpoints Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                                            <th className="pb-3 font-medium w-12">ID</th>
                                            <th className="pb-3 font-medium">Checkpoint</th>
                                            <th className="pb-3 font-medium w-24">Input</th>
                                            <th className="pb-3 font-medium w-24">Photos</th>
                                            <th className="pb-3 font-medium w-24">Remarks</th>
                                            <th className="pb-3 font-medium text-right w-20"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {stageCheckpoints.map((cp, idx) => (
                                            <tr
                                                key={cp.id}
                                                draggable
                                                onDragStart={() => onDragStartCp(idx)}
                                                onDragOver={onDragOverCp}
                                                onDrop={() => onDropCp(idx)}
                                                className="group hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                                            >
                                                <td className="py-4 text-gray-400 dark:text-gray-500 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical size={12} className="opacity-0 group-hover:opacity-40 cursor-grab" />
                                                        {idx + 1}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-gray-600 dark:text-gray-300 font-normal">{cp.question}</td>
                                                <td className="py-4 text-gray-400 dark:text-gray-500">{cp.input_type === 'yes_no' ? 'Y/N' : cp.input_type}</td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 size={16} className="text-green-500" />
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-2">
                                                        <XCircle size={16} className="text-red-500" />
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><Pencil size={14} /></button>
                                                        <button className="p-1 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p>Select a stage to view checkpoints</p>
                        </div>
                    )}
                </div>
            </div>

            {saving && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-full text-xs flex items-center gap-2 animate-bounce">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                    Saving changes...
                </div>
            )}

            <StageFormModal
                isOpen={isStageModalOpen}
                onClose={() => setIsStageModalOpen(false)}
                onSaved={loadData}
                checklistId={checklistId}
            />

            <CheckpointFormModal
                isOpen={isCheckpointModalOpen}
                onClose={() => setIsCheckpointModalOpen(false)}
                onSaved={loadData}
                checklistId={checklistId}
                stageId={activeStageId || ''}
            />

            {isLiveModalOpen && checklist && (
                <LiveChecklistModal
                    projectId={projectId}
                    checklist={checklist}
                    onClose={() => setIsLiveModalOpen(false)}
                    onSuccess={() => setIsLiveModalOpen(false)}
                />
            )}
        </div>
    );
}

function LiveChecklistModal({
    projectId, checklist, onClose, onSuccess,
}: { projectId: string; checklist: Checklist; onClose: () => void; onSuccess: () => void; }) {
    const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
    const [projectTeams, setProjectTeams] = useState<ProjectTeam[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [mRes, tRes] = await Promise.all([
                fetch(`/api/projects/${projectId}/members`),
                fetch(`/api/projects/${projectId}/teams`),
            ]);
            const m = await mRes.json();
            const t = await tRes.json();
            setProjectMembers(Array.isArray(m) ? m : []);
            setProjectTeams(Array.isArray(t) ? t : []);
            setLoading(false);
        };
        load();
    }, [projectId]);

    const selectedTeamNames = projectTeams
        .filter(t => selectedTeamIds.includes(t.team_id))
        .map(t => t.team_name);

    const availableMembers = projectMembers.filter(m =>
        (m.user_teams || '').split(',').map(t => t.trim()).some(t => selectedTeamNames.includes(t))
    );

    const toggleUser = (id: string) => {
        setSelectedUserIds(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
    };

    const toggleTeam = (id: string) => {
        setSelectedTeamIds(prev => {
            const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
            const nextTeamNames = projectTeams.filter(t => next.includes(t.team_id)).map(t => t.team_name);
            const stillAvailable = new Set(
                projectMembers
                    .filter(m => (m.user_teams || '').split(',').map(t => t.trim()).some(t => nextTeamNames.includes(t)))
                    .map(m => m.user_id)
            );
            setSelectedUserIds(u => u.filter(uid => stillAvailable.has(uid)));
            return next;
        });
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedUserIds.length === 0) { setError('Select at least one user.'); return; }
        if (selectedTeamIds.length === 0) { setError('Select at least one team.'); return; }
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/projects/${projectId}/eqcs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checklist_id: checklist.id,
                    assigned_user_ids: selectedUserIds,
                    assigned_team_ids: selectedTeamIds,
                }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to go live'); }
            onSuccess();
        } catch (e) { setError((e as Error).message); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Checklist</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">* Name</label>
                        <input className="input w-full" value={checklist.name} disabled readOnly />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">* UOM</label>
                        <select className="input w-full" disabled defaultValue="">
                            <option value="">—</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Reference Number</label>
                        <input className="input w-full" value={checklist.reference_number ?? ''} disabled readOnly />
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">* Team</label>
                        <div
                            className={`input flex items-center justify-between cursor-pointer ${selectedTeamIds.length === 0 ? 'border-orange-500' : ''}`}
                            onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
                        >
                            <span className="text-gray-400">{selectedTeamIds.length > 0 ? `${selectedTeamIds.length} Teams Selected` : 'Select teams'}</span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        {isTeamDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-xl max-h-48 overflow-y-auto p-2">
                                {loading && <p className="text-xs text-gray-400 p-2">Loading…</p>}
                                {!loading && projectTeams.length === 0 && <p className="text-xs text-gray-400 p-2">No teams linked to this project yet.</p>}
                                {projectTeams.map(t => (
                                    <div key={t.team_id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer" onClick={() => toggleTeam(t.team_id)}>
                                        <input type="checkbox" checked={selectedTeamIds.includes(t.team_id)} readOnly className="rounded text-teal-600" />
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{t.team_name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">* User</label>
                        <div
                            className={`input flex items-center justify-between ${selectedTeamIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${selectedUserIds.length === 0 ? 'border-orange-500' : ''}`}
                            onClick={() => { if (selectedTeamIds.length > 0) setIsUserDropdownOpen(!isUserDropdownOpen); }}
                        >
                            <span className="text-gray-400">
                                {selectedTeamIds.length === 0
                                    ? 'Select a team first'
                                    : selectedUserIds.length > 0 ? `${selectedUserIds.length} Users Selected` : 'Select users'}
                            </span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        {isUserDropdownOpen && selectedTeamIds.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-xl max-h-48 overflow-y-auto p-2">
                                {loading && <p className="text-xs text-gray-400 p-2">Loading…</p>}
                                {!loading && availableMembers.length === 0 && <p className="text-xs text-gray-400 p-2">No members of the selected team(s) are assigned to this project.</p>}
                                {availableMembers.map(m => (
                                    <div key={m.user_id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer" onClick={() => toggleUser(m.user_id)}>
                                        <input type="checkbox" checked={selectedUserIds.includes(m.user_id)} readOnly className="rounded text-teal-600" />
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{m.user_name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
                        <button type="submit" className="btn-primary flex-1 justify-center bg-orange-500 hover:bg-orange-600" disabled={saving}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                            {saving ? 'Going live…' : 'Go Live'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
