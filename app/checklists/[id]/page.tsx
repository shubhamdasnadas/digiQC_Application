'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Download,
    Upload,
    Edit3,
    GripVertical,
    Trash2,
    Pencil,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { Checklist, ChecklistStage, Checkpoint } from '@/lib/types';
import StageFormModal from '@/components/StageFormModal';

export default function ChecklistDetail() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const initialName = searchParams.get('name');

    const [checklist, setChecklist] = useState<Checklist | null>(null);
    const [stages, setStages] = useState<ChecklistStage[]>([]);
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [activeStageId, setActiveStageId] = useState<string | null>(null);
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/checklists/${id}`);
            if (!res.ok) throw new Error('Failed to fetch checklist');
            const data = await res.json();

            setChecklist(data);
            setStages(data.stages);
            setCheckpoints(data.checkpoints);
            // Removed auto-selection of first stage to match demo behavior
            // where user must select a stage to view checkpoints.
        } catch (error) {
            console.error('Error loading checklist:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleReorderStages = async (newStages: ChecklistStage[]) => {
        const stageIds = newStages.map(s => s.id);
        setStages(newStages);
        setSaving(true);
        try {
            await fetch(`/api/checklists/${id}`, {
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
            await fetch(`/api/checklists/${id}`, {
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
                    <button className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <Upload size={16} /> Import
                    </button>
                    <button className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <Download size={16} /> Export
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-full text-sm font-medium transition-colors">
                        <Edit3 size={16} /> Edit
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
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full text-xs font-medium hover:bg-slate-800 transition-colors">
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
                checklistId={id}
            />
        </div>
    );
}