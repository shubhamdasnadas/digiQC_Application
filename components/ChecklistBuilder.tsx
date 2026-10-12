'use client';

import { useState } from 'react';
import { ChevronDown, Layers, Plus, Trash2 } from 'lucide-react';

export interface BuilderCheckpoint {
  question: string;
  input_type: string;
  photo_required: boolean;
  remark_required: boolean;
}

export interface BuilderStage {
  name: string;
  witness_required: boolean;
  drawing_required: boolean;
  checkpoints: BuilderCheckpoint[];
}

/** The stage names offered as one-click presets before a custom name is typed. */
export const DEFAULT_STAGE_NAMES = [
  'Stage 1',
  'Stage 2',
  'Stage 3',
  'Stage 4',
  'Stage 5',
  'Stage 6',
  'Stage 7',
  'Stage 8',
];

export const INPUT_TYPES: { value: string; label: string }[] = [
  { value: 'yes_no', label: 'Y/N' },
  { value: 'text', label: 'Text' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'options', label: 'Options' },
  { value: 'date', label: 'Date' },
];

export function emptyCheckpoint(): BuilderCheckpoint {
  return { question: '', input_type: 'yes_no', photo_required: false, remark_required: false };
}

export function emptyStage(name: string): BuilderStage {
  return {
    name,
    witness_required: false,
    drawing_required: false,
    checkpoints: [emptyCheckpoint()],
  };
}

/**
 * The stage-and-checkpoint editor shared by both Add Checklist forms. Purely
 * controlled: the parent owns the array and posts it as the nested `stages`
 * payload that POST /api/checklists accepts.
 */
export default function ChecklistBuilder({
  stages,
  onChange,
}: {
  stages: BuilderStage[];
  onChange: (stages: BuilderStage[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState(0);
  const [customName, setCustomName] = useState('');

  const addStage = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || stages.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...stages, emptyStage(trimmed)]);
    setOpenIndex(stages.length);
  };

  const removeStage = (index: number) => {
    onChange(stages.filter((_, i) => i !== index));
    setOpenIndex((prev) => (prev >= index ? Math.max(0, prev - 1) : prev));
  };

  const patchStage = (index: number, patch: Partial<BuilderStage>) => {
    onChange(stages.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addCheckpoint = (index: number) => {
    const stage = stages[index];
    patchStage(index, { checkpoints: [...stage.checkpoints, emptyCheckpoint()] });
  };

  const removeCheckpoint = (stageIndex: number, cpIndex: number) => {
    const stage = stages[stageIndex];
    patchStage(stageIndex, {
      checkpoints: stage.checkpoints.filter((_, i) => i !== cpIndex),
    });
  };

  const patchCheckpoint = (
    stageIndex: number,
    cpIndex: number,
    patch: Partial<BuilderCheckpoint>
  ) => {
    const stage = stages[stageIndex];
    patchStage(stageIndex, {
      checkpoints: stage.checkpoints.map((cp, i) => (i === cpIndex ? { ...cp, ...patch } : cp)),
    });
  };

  const unusedDefaults = DEFAULT_STAGE_NAMES.filter(
    (n) => !stages.some((s) => s.name.toLowerCase() === n.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
          Stages &amp; Checkpoints
        </label>
        <span className="text-[11px] text-gray-400">
          {stages.length} stage{stages.length === 1 ? '' : 's'}
        </span>
      </div>

      {stages.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-4 px-3 text-center">
          <Layers size={18} className="mx-auto mb-1.5 text-gray-300 dark:text-gray-600" />
          <p className="text-[11px] text-gray-400">Pick a stage below, or add a custom one.</p>
        </div>
      )}

      {stages.map((stage, stageIndex) => {
        const isOpen = openIndex === stageIndex;
        return (
          <div
            key={`${stage.name}-${stageIndex}`}
            className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : stageIndex)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
                <input
                  className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-0"
                  value={stage.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => patchStage(stageIndex, { name: e.target.value })}
                />
                <span className="shrink-0 text-[11px] text-gray-400">
                  {stage.checkpoints.length} checkpoint{stage.checkpoints.length === 1 ? '' : 's'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeStage(stageIndex)}
                className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 transition-colors"
                title="Remove stage"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {isOpen && (
              <div className="p-3 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-600"
                      checked={stage.witness_required}
                      onChange={(e) => patchStage(stageIndex, { witness_required: e.target.checked })}
                    />
                    Witness required
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-600"
                      checked={stage.drawing_required}
                      onChange={(e) => patchStage(stageIndex, { drawing_required: e.target.checked })}
                    />
                    Drawing required
                  </label>
                </div>

                <div className="space-y-2">
                  {stage.checkpoints.map((cp, cpIndex) => (
                    <div
                      key={cpIndex}
                      className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          className="flex-1 min-w-0 p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                          placeholder={`Checkpoint ${cpIndex + 1}`}
                          value={cp.question}
                          onChange={(e) =>
                            patchCheckpoint(stageIndex, cpIndex, { question: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeCheckpoint(stageIndex, cpIndex)}
                          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 transition-colors"
                          title="Remove checkpoint"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                          value={cp.input_type}
                          onChange={(e) =>
                            patchCheckpoint(stageIndex, cpIndex, { input_type: e.target.value })
                          }
                        >
                          {INPUT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600"
                            checked={cp.photo_required}
                            onChange={(e) =>
                              patchCheckpoint(stageIndex, cpIndex, { photo_required: e.target.checked })
                            }
                          />
                          Photo
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600"
                            checked={cp.remark_required}
                            onChange={(e) =>
                              patchCheckpoint(stageIndex, cpIndex, { remark_required: e.target.checked })
                            }
                          />
                          Remark
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addCheckpoint(stageIndex)}
                  className="w-full py-1.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={12} /> Add Checkpoint
                </button>
              </div>
            )}
          </div>
        );
      })}

      {unusedDefaults.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedDefaults.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => addStage(n)}
              className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              + {n}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          placeholder="Custom stage name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addStage(customName);
              setCustomName('');
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            addStage(customName);
            setCustomName('');
          }}
          disabled={!customName.trim()}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={12} /> Add Stage
        </button>
      </div>
    </div>
  );
}
