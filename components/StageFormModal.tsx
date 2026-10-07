'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { ChecklistStage } from '@/lib/types';

interface StageFormValues {
    name: string;
    witness_required: boolean;
    drawing_required: boolean;
}

interface StageFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    checklistId: string;
    stage?: ChecklistStage | null;
}

const DEFAULT_VALUES: StageFormValues = {
    name: '',
    witness_required: false,
    drawing_required: false,
};

export default function StageFormModal({
    isOpen,
    onClose,
    onSaved,
    checklistId,
    stage,
}: StageFormModalProps) {
    const [values, setValues] = useState<StageFormValues>(DEFAULT_VALUES);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            if (stage) {
                setValues({
                    name: stage.name || '',
                    witness_required: !!stage.witness_required,
                    drawing_required: !!stage.drawing_required,
                });
            } else {
                setValues(DEFAULT_VALUES);
            }
            setError('');
        }
    }, [isOpen, stage]);

    const handleChange = (key: keyof StageFormValues, value: any) => {
        setValues((v) => ({ ...v, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!values.name.trim()) {
            setError('Stage name is required.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const isEdit = !!stage?.id;
            const res = await fetch(`/api/checklists/${checklistId}/stages`, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    isEdit
                        ? { stage_id: stage.id, ...values }
                        : values
                ),
            });

            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || (isEdit ? 'Failed to update stage' : 'Failed to add stage'));
            }

            onSaved();
            onClose();
            setValues(DEFAULT_VALUES);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
            <div className="relative card w-full max-w-md p-8 animate-scale-in bg-white dark:bg-gray-900 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {stage ? 'Edit Stage' : 'Add Stage'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="input w-full"
                            placeholder="Enter stage name"
                            value={values.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 text-center">
                                Witness Required
                            </label>
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                checked={values.witness_required}
                                onChange={(e) => handleChange('witness_required', e.target.checked)}
                            />
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 text-center">
                                Drawing Required
                            </label>
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                checked={values.drawing_required}
                                onChange={(e) => handleChange('drawing_required', e.target.checked)}
                            />
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-500 text-center">{error}</p>}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            {stage ? 'Save Changes' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
