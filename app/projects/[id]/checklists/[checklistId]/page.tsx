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
    X,
    Loader2,
    Download,
    Rocket,
} from 'lucide-react';
import { Checklist, ChecklistStage, Checkpoint } from '@/lib/types';
import { exportToXlsx } from '@/lib/excelExport';
import StageFormModal from '@/components/StageFormModal';
import CheckpointFormModal from '@/components/CheckpointFormModal';
import LiveChecklistModal from '@/components/LiveChecklistModal';

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
    const [editingStage, setEditingStage] = useState<ChecklistStage | null>(null);

    const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
    const [editingCheckpoint, setEditingCheckpoint] = useState<Checkpoint | null>(null);

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
            setStages(data.stages || []);
            setCheckpoints(data.checkpoints || []);

            if (data.stages?.length > 0 && !activeStageId) {
                setActiveStageId(data.stages[0].id);
            }
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

    const handleDeleteStage = async (stageId: string, stageName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete stage "${stageName}" and all its checkpoints?`)) {
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/checklists/${checklistId}/stages?stage_id=${stageId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete stage');

            if (activeStageId === stageId) {
                const remaining = stages.filter(s => s.id !== stageId);
                setActiveStageId(remaining.length > 0 ? remaining[0].id : null);
            }
            await loadData();
        } catch (err) {
            console.error('Error deleting stage:', err);
            alert('Failed to delete stage.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStageRequirement = async (field: 'witness_required' | 'drawing_required', val: boolean) => {
        if (!activeStageId) return;
        const targetStage = stages.find(s => s.id === activeStageId);
        if (!targetStage) return;

        // Optimistic update
        setStages(prev => prev.map(s => s.id === activeStageId ? { ...s, [field]: val } : s));

        try {
            await fetch(`/api/checklists/${checklistId}/stages`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stage_id: activeStageId,
                    [field]: val,
                }),
            });
        } catch (err) {
            console.error(`Error updating stage ${field}:`, err);
            await loadData();
        }
    };

    const handleDeleteCheckpoint = async (cpId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this checkpoint?')) {
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/checklists/checkpoints?id=${cpId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete checkpoint');
            await loadData();
        } catch (err) {
            console.error('Error deleting checkpoint:', err);
            alert('Failed to delete checkpoint.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCheckpointRequirement = async (cp: Checkpoint, field: 'photo_required' | 'remark_required', currentVal: boolean) => {
        const newVal = !currentVal;
        setCheckpoints(prev => prev.map(c => c.id === cp.id ? { ...c, [field]: newVal } : c));
        try {
            const res = await fetch('/api/checklists/checkpoints', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cp.id, [field]: newVal }),
            });
            if (!res.ok) throw new Error('Failed to update checkpoint');
        } catch (err) {
            console.error('Error toggling checkpoint requirement:', err);
            setCheckpoints(prev => prev.map(c => c.id === cp.id ? { ...c, [field]: currentVal } : c));
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
        const currentStageCps = checkpoints.filter(cp => cp.stage_id === activeStageId);
        const otherStageCps = checkpoints.filter(cp => cp.stage_id !== activeStageId);
        const [removed] = currentStageCps.splice(draggedCpIdx, 1);
        currentStageCps.splice(idx, 0, removed);
        const combined = [...otherStageCps, ...currentStageCps];
        handleReorderCheckpoints(combined);
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

    const handleExport = () => {
        if (!checklist) return;
        const rows: any[] = [];
        for (const stage of stages) {
            const scps = checkpoints.filter(cp => cp.stage_id === stage.id || (cp as any).library_stage_id === stage.id);
            if (scps.length === 0) {
                rows.push({
                    'Checklist Name': checklist.name,
                    'REFERENCE NUMBER': checklist.reference_number || '',
                    'Stage Name': stage.name,
                    'Checkpoint': '',
                    'Type': '',
                    'Photo': '',
                    'Remark': '',
                });
            } else {
                for (const cp of scps) {
                    rows.push({
                        'Checklist Name': checklist.name,
                        'REFERENCE NUMBER': checklist.reference_number || '',
                        'Stage Name': stage.name,
                        'Checkpoint': cp.question,
                        'Type': cp.input_type === 'yes_no' ? 'Y/N' : cp.input_type?.toUpperCase(),
                        'Photo': cp.photo_required ? 'TRUE' : 'FALSE',
                        'Remark': cp.remark_required ? 'TRUE' : 'FALSE',
                    });
                }
            }
        }
        if (rows.length === 0) {
            rows.push({
                'Checklist Name': checklist.name,
                'REFERENCE NUMBER': checklist.reference_number || '',
                'Stage Name': 'Single Stage',
                'Checkpoint': '',
                'Type': '',
                'Photo': '',
                'Remark': '',
            });
        }
        exportToXlsx(rows, `checklist-${(checklist.name || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    };

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
                    <div>
                        <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                            {checklist?.name || initialName || 'Loading checklist...'}
                        </h1>
                        {checklist?.reference_number && (
                            <span className="text-xs text-gray-400">Ref: {checklist.reference_number}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Download size={16} /> Export
                    </button>
                    <button
                        onClick={() => setIsLiveModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
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
                            onClick={() => {
                                setEditingStage(null);
                                setIsStageModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full text-xs font-medium transition-colors shadow-sm"
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
                                className={`group flex items-center gap-3 py-2.5 px-2 rounded-lg cursor-pointer transition-all ${activeStageId === stage.id
                                    ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 font-semibold'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                <GripVertical size={14} className="text-gray-300 group-hover:text-gray-400 cursor-grab shrink-0" />
                                <span className="text-sm flex-1 truncate">{stage.name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingStage(stage);
                                            setIsStageModalOpen(true);
                                        }}
                                        className="p-1 hover:text-teal-500 rounded transition-colors"
                                        title="Edit Stage"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteStage(stage.id, stage.name, e)}
                                        className="p-1 hover:text-red-500 rounded transition-colors"
                                        title="Delete Stage"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {stages.length === 0 && (
                            <div className="text-center py-8 text-xs text-gray-400">
                                No stages yet. Click "+ Add" to create one.
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
                        <span>{stages.length} stages</span>
                    </div>
                </div>

                {/* Main Content: Checkpoints */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 p-8">
                    {activeStage ? (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-medium text-gray-900 dark:text-white">{activeStage.name}</h2>
                                    <span className="text-xs text-gray-400">{stageCheckpoints.length} item(s)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setEditingCheckpoint(null);
                                            setIsCheckpointModalOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full text-xs font-medium transition-colors shadow-sm"
                                    >
                                        <Plus size={14} /> Item
                                    </button>
                                </div>
                            </div>

                            {/* Stage Requirements */}
                            <div className="flex items-center gap-8 border-b border-gray-100 dark:border-gray-800 pb-4">
                                <div className="relative">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Stage Requirements</span>
                                    <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-teal-500 rounded-full" />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={!!activeStage.witness_required}
                                        onChange={(e) => handleToggleStageRequirement('witness_required', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        Witness Required
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={!!activeStage.drawing_required}
                                        onChange={(e) => handleToggleStageRequirement('drawing_required', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        Drawing Required
                                    </span>
                                </label>
                            </div>

                            {/* Checkpoints Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                                            <th className="pb-3 font-medium w-12">#</th>
                                            <th className="pb-3 font-medium">Checkpoint</th>
                                            <th className="pb-3 font-medium w-24">Input</th>
                                            <th className="pb-3 font-medium w-24">Photos</th>
                                            <th className="pb-3 font-medium w-24">Remarks</th>
                                            <th className="pb-3 font-medium text-right w-20">Actions</th>
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
                                                        <GripVertical size={12} className="opacity-0 group-hover:opacity-40 cursor-grab shrink-0" />
                                                        {idx + 1}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-gray-700 dark:text-gray-200 font-normal">
                                                    <div dangerouslySetInnerHTML={{ __html: cp.question }} />
                                                </td>
                                                <td className="py-4 text-gray-500 dark:text-gray-400 capitalize">
                                                    {cp.input_type === 'yes_no' ? 'Yes / No' : cp.input_type}
                                                </td>
                                                <td className="py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleCheckpointRequirement(cp, 'photo_required', !!(cp as any).photo_required)}
                                                        className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                                        title={`Photo is ${(cp as any).photo_required ? 'Required (Click to disable)' : 'Not Required (Click to enable)'}`}
                                                    >
                                                        {(cp as any).photo_required ? (
                                                            <CheckCircle2 size={16} className="text-green-500" />
                                                        ) : (
                                                            <XCircle size={16} className="text-red-500" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleCheckpointRequirement(cp, 'remark_required', !!(cp as any).remark_required)}
                                                        className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                                        title={`Remark is ${(cp as any).remark_required ? 'Required (Click to disable)' : 'Not Required (Click to enable)'}`}
                                                    >
                                                        {(cp as any).remark_required ? (
                                                            <CheckCircle2 size={16} className="text-green-500" />
                                                        ) : (
                                                            <XCircle size={16} className="text-red-500" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingCheckpoint(cp);
                                                                setIsCheckpointModalOpen(true);
                                                            }}
                                                            className="p-1 hover:text-teal-600 dark:hover:text-teal-400 rounded transition-colors"
                                                            title="Edit Checkpoint"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteCheckpoint(cp.id, e)}
                                                            className="p-1 hover:text-red-500 rounded transition-colors"
                                                            title="Delete Checkpoint"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {stageCheckpoints.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                                                    No checkpoints in this stage yet. Click "+ Item" above to add one.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p>Select a stage on the left to view checkpoints</p>
                        </div>
                    )}
                </div>
            </div>

            {saving && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-full text-xs flex items-center gap-2 animate-bounce shadow-lg">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                    Saving changes...
                </div>
            )}

            <StageFormModal
                isOpen={isStageModalOpen}
                onClose={() => {
                    setIsStageModalOpen(false);
                    setEditingStage(null);
                }}
                onSaved={loadData}
                checklistId={checklistId}
                stage={editingStage}
            />

            <CheckpointFormModal
                isOpen={isCheckpointModalOpen}
                onClose={() => {
                    setIsCheckpointModalOpen(false);
                    setEditingCheckpoint(null);
                }}
                onSaved={loadData}
                checklistId={checklistId}
                stageId={activeStageId || ''}
                checkpoint={editingCheckpoint}
            />

            {isLiveModalOpen && checklist && (
                <LiveChecklistModal
                    isOpen={isLiveModalOpen}
                    projectId={projectId}
                    checklist={checklist}
                    onClose={() => setIsLiveModalOpen(false)}
                    onSuccess={() => {
                        setIsLiveModalOpen(false);
                        loadData();
                    }}
                />
            )}
        </div>
    );
}
