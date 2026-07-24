import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ChecklistCheckpoint } from '../../types';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (cpData: Partial<ChecklistCheckpoint>) => Promise<void>;
  stageName: string;
  initialData?: ChecklistCheckpoint | null;
}

export const CheckpointModal: React.FC<CheckpointModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  stageName,
  initialData,
}) => {
  const [question, setQuestion] = useState('');
  const [inputType, setInputType] = useState<'yes_no' | 'options' | 'numeric' | 'date' | 'text'>('yes_no');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [failRule, setFailRule] = useState('No');
  const [drawingRequired, setDrawingRequired] = useState(false);
  const [witnessRequired, setWitnessRequired] = useState(true);
  const [photoRequired, setPhotoRequired] = useState(true);
  const [remarkRequired, setRemarkRequired] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setQuestion(initialData.question || '');
        setInputType(initialData.input_type || 'yes_no');
        setOptions(initialData.options || ['Option 1', 'Option 2']);
        setFailRule(initialData.fail_rule || 'No');
        setDrawingRequired(Boolean(initialData.drawing_required));
        setWitnessRequired(Boolean(initialData.witness_required));
        setPhotoRequired(Boolean(initialData.photo_required));
        setRemarkRequired(Boolean(initialData.remark_required));
      } else {
        setQuestion('');
        setInputType('yes_no');
        setOptions(['Option 1', 'Option 2']);
        setFailRule('No');
        setDrawingRequired(false);
        setWitnessRequired(true);
        setPhotoRequired(true);
        setRemarkRequired(false);
      }
    }
  }, [isOpen, initialData]);

  const handleAddOption = () => {
    setOptions(prev => [...prev, `Option ${prev.length + 1}`]);
  };

  const handleOptionChange = (idx: number, val: string) => {
    setOptions(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleRemoveOption = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question) return;

    await onSubmit({
      ...(initialData ? { id: initialData.id } : {}),
      question,
      input_type: inputType,
      options: inputType === 'options' ? options : undefined,
      fail_rule: failRule,
      drawing_required: drawingRequired,
      witness_required: witnessRequired,
      photo_required: photoRequired,
      remark_required: remarkRequired,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Checkpoint Item` : `Add Checkpoint Item to [${stageName}]`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Checkpoint Inspection Question *
          </label>
          <textarea
            rows={2}
            required
            placeholder="e.g. Concrete slump test result at pour site (target 120-140 mm)?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-3 text-xs text-slate-100 outline-none resize-none"
          />
        </div>

        {/* Input Type Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Response Type</label>
            <select
              value={inputType}
              onChange={e => {
                const type = e.target.value as any;
                setInputType(type);
                if (type === 'yes_no') setFailRule('No');
                if (type === 'numeric') setFailRule('<120');
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="yes_no">Yes / No Toggle</option>
              <option value="options">Multiple Choice Options</option>
              <option value="numeric">Numeric Value Entry</option>
              <option value="date">Date Picker</option>
              <option value="text">Free Text Input</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">QC Fail Rule / Condition</label>
            {inputType === 'yes_no' ? (
              <select
                value={failRule}
                onChange={e => setFailRule(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              >
                <option value="No">Mark as FAIL if answer is 'No'</option>
                <option value="Yes">Mark as FAIL if answer is 'Yes'</option>
              </select>
            ) : inputType === 'numeric' ? (
              <input
                type="text"
                placeholder="e.g. <120 or >250"
                value={failRule}
                onChange={e => setFailRule(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none font-mono"
              />
            ) : (
              <input
                type="text"
                placeholder="Fail threshold value..."
                value={failRule}
                onChange={e => setFailRule(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            )}
          </div>
        </div>

        {/* Dynamic Options for Multiple Choice */}
        {inputType === 'options' && (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Option Values</span>
              <button
                type="button"
                onClick={handleAddOption}
                className="text-[11px] text-teal-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={e => handleOptionChange(idx, e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mandatory Requirement Checkboxes */}
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={photoRequired}
              onChange={e => setPhotoRequired(e.target.checked)}
              className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <span>Photo Proof Required</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={witnessRequired}
              onChange={e => setWitnessRequired(e.target.checked)}
              className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <span>Witness Sign-off Required</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={drawingRequired}
              onChange={e => setDrawingRequired(e.target.checked)}
              className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <span>Drawing Reference Required</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={remarkRequired}
              onChange={e => setRemarkRequired(e.target.checked)}
              className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <span>Field Remark Mandatory</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-teal-500/20 transition"
            id="save-checkpoint-item-btn"
          >
            {initialData ? 'Save Changes' : 'Add Checkpoint'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
