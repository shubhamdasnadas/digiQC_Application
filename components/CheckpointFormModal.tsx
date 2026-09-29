'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon, List, ListOrdered, Type, Loader2 } from 'lucide-react';
import type { Checkpoint } from '@/lib/types';

interface CheckpointFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    checklistId: string;
    stageId: string;
    checkpoint?: Checkpoint | null;
}

const DEFAULT_FORM = {
    name: '',
    question: '',
    input_type: 'yes_no',
    photo_required: false,
    remark_required: false,
    drawing_required: false,
    witness_required: false,
    options: [
        { value: 'Yes', qc_fail: false },
        { value: 'No', qc_fail: true }
    ],
    numeric_condition: {
        operator: '<=',
        value: '',
        qc_result: 'fail' as 'fail' | 'pass'
    }
};

export default function CheckpointFormModal({
    isOpen,
    onClose,
    onSaved,
    checklistId,
    stageId,
    checkpoint
}: CheckpointFormModalProps) {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const questionRef = useRef<HTMLDivElement>(null);
    const [uploadType, setUploadType] = useState<'link' | 'image' | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (checkpoint) {
                setForm({
                    name: checkpoint.question || '',
                    question: checkpoint.question || '',
                    input_type: checkpoint.input_type || 'yes_no',
                    photo_required: !!(checkpoint as any).photo_required,
                    remark_required: !!(checkpoint as any).remark_required,
                    drawing_required: !!checkpoint.drawing_required,
                    witness_required: !!checkpoint.witness_required,
                    options: [
                        { value: 'Yes', qc_fail: false },
                        { value: 'No', qc_fail: true }
                    ],
                    numeric_condition: {
                        operator: '<=',
                        value: '',
                        qc_result: 'fail'
                    }
                });
                if (questionRef.current) {
                    questionRef.current.innerHTML = checkpoint.question || '';
                }
            } else {
                setForm(DEFAULT_FORM);
                if (questionRef.current) {
                    questionRef.current.innerHTML = '';
                }
            }
            setError('');
        }
    }, [isOpen, checkpoint]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const effectiveQuestion = form.question.trim() || form.name.trim();
        if (!effectiveQuestion) {
            setError('Please enter a checkpoint question or name.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const isEdit = !!checkpoint?.id;
            const url = '/api/checklists/checkpoints';
            const payload = isEdit
                ? {
                    id: checkpoint.id,
                    question: effectiveQuestion,
                    input_type: form.input_type,
                    photo_required: form.photo_required,
                    remark_required: form.remark_required,
                    drawing_required: form.drawing_required,
                    witness_required: form.witness_required,
                }
                : {
                    checklist_id: checklistId,
                    stage_id: stageId,
                    question: effectiveQuestion,
                    name: form.name,
                    input_type: form.input_type,
                    photo_required: form.photo_required,
                    remark_required: form.remark_required,
                    drawing_required: form.drawing_required,
                    witness_required: form.witness_required,
                };

            const res = await fetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || (isEdit ? 'Failed to update checkpoint' : 'Failed to save checkpoint'));
            }

            onSaved();
            onClose();
            setForm(DEFAULT_FORM);
            if (questionRef.current) questionRef.current.innerHTML = '';
        } catch (err) {
            setError((err as Error).message);
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

    const updateNumericCondition = (field: 'operator' | 'value' | 'qc_result', val: any) => {
        setForm({
            ...form,
            numeric_condition: { ...form.numeric_condition, [field]: val }
        });
    };

    const executeCommand = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (uploadType === 'image') {
                executeCommand('insertImage', base64);
            } else if (uploadType === 'link') {
                executeCommand('createLink', base64);
            }
        };
        reader.readAsDataURL(file);
        setUploadType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileUpload = (type: 'link' | 'image') => {
        setUploadType(type);
        fileInputRef.current?.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {checkpoint ? 'Edit Stage Item' : 'Add Stage Item'}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                <span className="text-red-500 mr-1">*</span> Checkpoint Name / Title
                            </label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => {
                                    setForm({ ...form, name: e.target.value, question: e.target.value });
                                    if (questionRef.current && (!questionRef.current.innerHTML || questionRef.current.innerHTML === form.question)) {
                                        questionRef.current.innerHTML = e.target.value;
                                    }
                                }}
                                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                placeholder="e.g. Foundation Level Check"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                Checklist Point Details / Question
                            </label>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-500">
                                <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <button type="button" onClick={() => executeCommand('bold')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Bold size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('italic')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Italic size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('underline')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Underline size={14} /></button>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
                                    <button type="button" onClick={() => triggerFileUpload('link')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><LinkIcon size={14} /></button>
                                    <button type="button" onClick={() => triggerFileUpload('image')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><ImageIcon size={14} /></button>
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
                                    <button type="button" onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><List size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('insertOrderedList')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><ListOrdered size={14} /></button>
                                    <button type="button" onClick={() => executeCommand('removeFormat')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"><Type size={14} /></button>
                                </div>
                                <div
                                    ref={questionRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => {
                                        const html = e.currentTarget.innerHTML;
                                        setForm((f) => ({ ...f, question: html }));
                                    }}
                                    className="w-full p-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none min-h-[80px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 items-center pt-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Input Type</label>
                            <div className="relative">
                                <select
                                    value={form.input_type}
                                    onChange={(e) => setForm({ ...form, input_type: e.target.value })}
                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 appearance-none px-3"
                                >
                                    <option value="yes_no">Yes/No</option>
                                    <option value="options">Options</option>
                                    <option value="text">Text</option>
                                    <option value="numeric">Numeric</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Photo Required</label>
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, photo_required: !f.photo_required }))}
                                className={`w-11 h-6 rounded-full transition-colors relative ${form.photo_required ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.photo_required ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                        <div className="flex flex-col items-center">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Remarks Required</label>
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, remark_required: !f.remark_required }))}
                                className={`w-11 h-6 rounded-full transition-colors relative ${form.remark_required ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.remark_required ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    {form.input_type === 'yes_no' && (
                        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Yes/No Configuration</h3>
                            <div className="space-y-2">
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
                        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Options Configuration</h3>
                            <div className="space-y-3">
                                {form.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            value={opt.value}
                                            onChange={(e) => updateOption(idx, 'value', e.target.value)}
                                            className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 px-3"
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
                        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Numeric Criteria</h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                                <span className="text-xs text-gray-600 dark:text-gray-400">If value is</span>
                                <select
                                    value={form.numeric_condition.operator}
                                    onChange={(e) => updateNumericCondition('operator', e.target.value)}
                                    className="p-1.5 border border-orange-400 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 px-2"
                                >
                                    {['<=', '>=', '=', '<', '>'].map(op => (
                                        <option key={op} value={op}>{op}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={form.numeric_condition.value}
                                    onChange={(e) => updateNumericCondition('value', e.target.value)}
                                    className="p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-orange-500 w-28 px-2"
                                    placeholder="Number"
                                />
                                <span className="text-xs text-gray-600 dark:text-gray-400">then,</span>
                                <div className="flex items-center gap-3 ml-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                        <input
                                            type="radio"
                                            name="qc_result"
                                            checked={form.numeric_condition.qc_result === 'fail'}
                                            onChange={() => updateNumericCondition('qc_result', 'fail')}
                                            className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                                        />
                                        <span>QC Fail</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                        <input
                                            type="radio"
                                            name="qc_result"
                                            checked={form.numeric_condition.qc_result === 'pass'}
                                            onChange={() => updateNumericCondition('qc_result', 'pass')}
                                            className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                                        />
                                        <span>QC Pass</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-xs text-red-500 text-center">{error}</p>}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            {checkpoint ? 'Save Changes' : 'Add Item'}
                        </button>
                    </div>
                </form>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept={uploadType === 'image' ? 'image/*' : '*'}
                />
            </div>
        </div>
    );
}
