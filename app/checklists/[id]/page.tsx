'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function ChecklistDetail() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [checklist, setChecklist] = useState<Checklist | null>(null);
    const [stages, setStages] = useState<ChecklistStage[]>([]);
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [activeStageId, setActiveStageId] = useState<string | null>(null);
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
            if (data.stages.length > 0) {
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
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {checklist?.name}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn-secondary flex items-center gap-2"><Upload size={16} /> Import</button>
                    <button className="btn-secondary flex items-center gap-2"><Download size={16} /> Export</button>
                    <button className="btn-primary flex items-center gap-2"><Edit3 size={16} /> Edit</button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Stages */}
                <div className="w-80 border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col">
                    <div className="p-5 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 dark:text-white">Stages</h2>
                        <button className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 space-y-1">
                        {stages.map((stage, idx) => (
                            <div
                                key={stage.id}
                                draggable
                                onDragStart={() => onDragStartStage(idx)}
                                onDragOver={onDragOverStage}
                                onDrop={() => onDropStage(idx)}
                                onClick={() => setActiveStageId(stage.id)}
                                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeStageId === stage.id
                                        ? 'bg-white dark:bg-gray-800 shadow-sm ring-1 ring-teal-500/20 text-teal-600 dark:text-teal-400'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                <GripVertical size={14} className="opacity-0 group-hover:opacity-40 cursor-grab" />
                                <span className="text-xs font-medium w-4">{idx + 1}</span>
                                <span className="text-sm font-medium flex-1 truncate">{stage.name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                    <button className="p-1 hover:text-teal-600"><Pencil size={12} /></button>
                                    <button className="p-1 hover:text-red-600"><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content: Checkpoints */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 p-8">
                    {activeStage ? (
                        <div className="max-w-5xl mx-auto space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{activeStage.name}</h2>
                                <button className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
                                    <Plus size={16} /> Item
                                </button>
                            </div>

                            {/* Stage Requirements */}
                            <div className="card p-6 bg-gray-50 dark:bg-gray-900 border-none">
                                <div className="flex items-center gap-6">
                                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stage Requirements</span>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                        <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Witness Required</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                        <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Drawing Required</span>
                                    </label>
                                </div>
                            </div>

                            {/* Checkpoints Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                                            <th className="pb-3 font-medium w-12">ID</th>
                                            <th className="pb-3 font-medium">Checkpoint</th>
                                            <th className="pb-3 font-medium w-24">Input</th>
                                            <th className="pb-3 font-medium w-24">Photos</th>
                                            <th className="pb-3 font-medium w-24">Remarks</th>
                                            <th className="pb-3 font-medium text-center w-20">Actions</th>
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
                                                <td className="py-4 text-gray-500 dark:text-gray-400 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical size={12} className="opacity-0 group-hover:opacity-40 cursor-grab" />
                                                        {idx + 1}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-gray-900 dark:text-white font-medium">{cp.question}</td>
                                                <td className="py-4 text-gray-600 dark:text-gray-300">{cp.input_type === 'yes_no' ? 'Y/N' : cp.input_type}</td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 size={16} className="text-green-500" />
                                                        <span className="text-xs text-gray-500">Yes</span>
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-2">
                                                        <XCircle size={16} className="text-red-500" />
                                                        <span className="text-xs text-gray-500">No</span>
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-1 hover:text-teal-600"><Pencil size={14} /></button>
                                                        <button className="p-1 hover:text-red-600"><Trash2 size={14} /></button>
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
        </div>
    );
}