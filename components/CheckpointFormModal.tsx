'use client';

import React, { useState } from 'react';
import { X, Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon, List, ListOrdered, Type } from 'lucide-react';

interface CheckpointFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    checklistId: string;
    stageId: string;
}

export default function CheckpointFormModal({ isOpen, onClose, onSaved, checklistId, stageId }: CheckpointFormModalProps) {
    const [form, setForm] = useState({
        name: '',
        question: '',
        input_type: 'yes_no',
        photo_required: false,
        remark_required: false,
        options: [
            { value: 'Yes', qc_fail: false },
            { value: 'No', qc_fail: true }
        ],
        numeric_condition: {
            value: '',
            qc_fail: false,
            qc_pass: false
        }
    });
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/checklists/checkpoints', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checklist_id: checklistId,
                    stage_id: stageId,
                    ...form
                }),
            });
            if (!res.ok) throw new Error('Failed to save checkpoint');
            onSaved();
            onClose();
        } catch (error) {
            console.error('Error saving checkpoint:', error);
        } finally {
            setSaving(false);
        }
    };

    const addOption = () => {
        setForm({
            ...form,
            options: [...form.options, { value: '', qc_fail: false }]
        });
    };

    const updateOption = (index: number, field: 'value' | 'qc_fail', val: any) => {
        const newOptions = [...form.options];
        newOptions[index] = { ...newOptions[index], [field]: val };
        setForm({ ...form, options: newOptions });
    };

    const updateNumericCondition = (field: 'value' | 'qc_fail' | 'qc_pass', val: any) => {
        setForm({
            ...form,
            numeric_condition: { ...form.numeric_condition, [field]: val }
        });
    };

    const executeCommand = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Stage Item</h2>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                <span className="text-red-500 mr-1">*</span> Checkpoint Name
                            </label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                placeholder="e.g. Foundation Level Check"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                <span className="text-red-500 mr-1">*</span> Checklist Point
                            </label>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                                <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <button type="button" onClick={() => executeCommand('bold')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Bold size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('italic')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Italic size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('underline')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Underline size={14} /></button>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
                                    <button type="button" onClick={() => executeCommand('createLink', prompt('Enter URL:') || '')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><LinkIcon size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('insertImage', prompt('Enter image URL:') || '')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><ImageIcon size={14} /></button>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
                                    <button type="button" onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><List size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('insertOrderedList')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><ListOrdered size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('removeFormat')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Type size={14} /></button>
                                </div>
                                <div
                                    contentEditable
                                    onInput={(e) => setForm({ ...form, question: e.currentTarget.innerHTML })}
                                    className="w-full p-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none min-h-[80px]"
                                    dangerouslySetInnerHTML={{ __html: form.question }}
                                    onBlur={(e) => {
                                        if (e.currentTarget.innerHTML === '') {
                                            // Handle required validation if empty
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Type</label>
                            <select
                                value={form.input_type}
                                onChange={(e) => setForm({ ...form, input_type: e.target.value })}
                                className="w-full p-2 border-2 border-orange-400 rounded-full text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none appearance-none px-3"
                            >
                                <option value="yes_no">Yes/No</option>
                                <option value="options">Options</option>
                                <option value="text">Text</option>
                                <option value="numeric">Numeric</option>
                                <option value="date">Date</option>
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">EQC Photo</label>
                            <div className="flex items-center h-9">
                                <input
                                    type="checkbox"
                                    checked={form.photo_required}
                                    onChange={(e) => setForm({ ...form, photo_required: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Remarks</label>
                            <div className="flex items-center h-9">
                                <input
                                    type="checkbox"
                                    checked={form.remark_required}
                                    onChange={(e) => setForm({ ...form, remark_required: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                    </div>

                    {form.input_type === 'yes_no' && (
                        <div className="space-y-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Yes/No Configuration</h3>
                            <div className="space-y-4">
                                {form.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-4">
                                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{opt.value}</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={opt.qc_fail}
                                                onChange={(e) => updateOption(idx, 'qc_fail', e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Mark for QC fail</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {form.input_type === 'options' && (
                        <div className="space-y-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Options Configuration</h3>
                            <div className="space-y-4">
                                {form.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            value={opt.value}
                                            onChange={(e) => updateOption(idx, 'value', e.target.value)}
                                            className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-full text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 px-3"
                                            placeholder="Enter value"
                                        />
                                        <div className="flex items-center gap-2 shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={opt.qc_fail}
                                                onChange={(e) => updateOption(idx, 'qc_fail', e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">QC Fail</span>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addOption}
                                    className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                                >
                                    + Add Option
                                </button>
                            </div>
                        </div>
                    )}

                    {form.input_type === 'numeric' && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Numeric Condition</h3>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700 dark:text-gray-300">
                                <span className="text-gray-500">If value is</span>
                                <input
                                    type="text"
                                    value={form.numeric_condition.value}
                                    onChange={(e) => updateNumericCondition('value', e.target.value)}
                                    className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-full bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-orange-500 w-24 px-3"
                                    placeholder="value"
                                />
                                <span className="text-gray-500">then,</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.numeric_condition.qc_fail}
                                        onChange={(e) => updateNumericCondition('qc_fail', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-gray-500">QC Fail</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.numeric_condition.qc_pass}
                                        onChange={(e) => updateNumericCondition('qc_pass', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-gray-500">QC Pass</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}