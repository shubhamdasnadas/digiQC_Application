'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Checklist } from '@/lib/types';

interface EditChecklistValues {
    name: string;
    reference_number: string;
    uom: string;
}

interface EditChecklistModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    checklistId: string;
    checklist: Checklist | null;
}

export default function EditChecklistModal({
    isOpen,
    onClose,
    onSaved,
    checklistId,
    checklist,
}: EditChecklistModalProps) {
    const [values, setValues] = useState<EditChecklistValues>({ name: '', reference_number: '', uom: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setValues({
                name: checklist?.name || '',
                reference_number: checklist?.reference_number || '',
                uom: checklist?.uom || '',
            });
            setError('');
        }
    }, [isOpen, checklist]);

    const handleChange = (key: keyof EditChecklistValues, value: string) => {
        setValues((v) => ({ ...v, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!values.name.trim()) {
            setError('Checklist name is required.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const res = await fetch(`/api/checklists/${checklistId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Failed to update checklist');
            }

            onSaved();
            onClose();
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
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Checklist</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            Checklist Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="input w-full"
                            placeholder="Enter checklist name"
                            value={values.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            Reference Number
                        </label>
                        <input
                            className="input w-full"
                            placeholder="e.g. REF-001"
                            value={values.reference_number}
                            onChange={(e) => handleChange('reference_number', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            UOM
                        </label>
                        <input
                            className="input w-full"
                            placeholder="e.g. Nos, Sqm, Cum"
                            value={values.uom}
                            onChange={(e) => handleChange('uom', e.target.value)}
                        />
                    </div>

                    {error && <p className="text-xs text-red-500 text-center">{error}</p>}

                    <div className="flex gap-3 pt-2">
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
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
