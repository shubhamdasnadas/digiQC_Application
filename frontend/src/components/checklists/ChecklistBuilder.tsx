import React, { useState, useEffect } from 'react';
import { Checklist, ChecklistStage, ChecklistCheckpoint } from '../../types';
import { api } from '../../services/api';
import { CheckpointModal } from './CheckpointModal';
import { Modal } from '../common/Modal';
import {
  Layers,
  Plus,
  ArrowLeft,
  GripVertical,
  Camera,
  Eye,
  FileCheck,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit3,
} from 'lucide-react';

interface ChecklistBuilderProps {
  checklistId: string;
  onBack: () => void;
}

export const ChecklistBuilder: React.FC<ChecklistBuilderProps> = ({ checklistId, onBack }) => {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [stages, setStages] = useState<ChecklistStage[]>([]);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stage Modal & Editing State
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ChecklistStage | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [stageWitnessReq, setStageWitnessReq] = useState(true);
  const [stageDrawingReq, setStageDrawingReq] = useState(true);

  // Checkpoint Modal & Editing State
  const [isCpModalOpen, setIsCpModalOpen] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState<ChecklistCheckpoint | null>(null);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await api.getChecklistDetail(checklistId);
      setChecklist(data.checklist);
      setStages(data.stages || []);
      if (data.stages && data.stages.length > 0) {
        setActiveStageId(data.stages[0].id);
      }
    } catch (err) {
      console.error('Failed to load checklist detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [checklistId]);

  const handleOpenAddStage = () => {
    setEditingStage(null);
    setNewStageName('');
    setStageWitnessReq(true);
    setStageDrawingReq(true);
    setIsStageModalOpen(true);
  };

  const handleOpenEditStage = (stg: ChecklistStage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingStage(stg);
    setNewStageName(stg.name);
    setStageWitnessReq(stg.witness_required);
    setStageDrawingReq(stg.drawing_required);
    setIsStageModalOpen(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName) return;

    try {
      if (editingStage) {
        const res = await api.patchChecklist(checklistId, {
          edit_stage: {
            id: editingStage.id,
            name: newStageName,
            witness_required: stageWitnessReq,
            drawing_required: stageDrawingReq,
          },
        });
        setStages(res.stages || []);
      } else {
        const res = await api.patchChecklist(checklistId, {
          add_stage: {
            name: newStageName,
            witness_required: stageWitnessReq,
            drawing_required: stageDrawingReq,
          },
        });
        setStages(res.stages || []);
      }
      setIsStageModalOpen(false);
      setEditingStage(null);
      setNewStageName('');
    } catch (err) {
      console.error('Failed to save stage:', err);
    }
  };

  const handleDeleteStage = async (stgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this stage and all its checkpoint items?')) return;
    try {
      const res = await api.patchChecklist(checklistId, {
        delete_stage: { id: stgId },
      });
      setStages(res.stages || []);
      if (activeStageId === stgId) {
        const remaining = (res.stages || []).filter((s: ChecklistStage) => s.id !== stgId);
        setActiveStageId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete stage:', err);
    }
  };

  const handleOpenAddCheckpoint = () => {
    setEditingCheckpoint(null);
    setIsCpModalOpen(true);
  };

  const handleOpenEditCheckpoint = (cp: ChecklistCheckpoint) => {
    setEditingCheckpoint(cp);
    setIsCpModalOpen(true);
  };

  const handleSaveCheckpoint = async (cpData: Partial<ChecklistCheckpoint>) => {
    if (!activeStageId) return;

    try {
      if (editingCheckpoint) {
        const res = await api.patchChecklist(checklistId, {
          edit_checkpoint: {
            ...cpData,
            stage_id: activeStageId,
          },
        });
        setStages(res.stages || []);
      } else {
        const res = await api.patchChecklist(checklistId, {
          add_checkpoint: {
            ...cpData,
            stage_id: activeStageId,
          },
        });
        setStages(res.stages || []);
      }
      setIsCpModalOpen(false);
      setEditingCheckpoint(null);
    } catch (err) {
      console.error('Failed to save checkpoint:', err);
    }
  };

  const handleDeleteCheckpoint = async (cpId: string) => {
    if (!activeStageId) return;
    if (!confirm('Are you sure you want to delete this checkpoint item?')) return;

    try {
      const res = await api.patchChecklist(checklistId, {
        delete_checkpoint: {
          id: cpId,
          stage_id: activeStageId,
        },
      });
      setStages(res.stages || []);
    } catch (err) {
      console.error('Failed to delete checkpoint:', err);
    }
  };

  const activeStage = stages.find(s => s.id === activeStageId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
            id="builder-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">{checklist?.name || 'Checklist Builder'}</h2>
              <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 rounded shrink-0">
                {checklist?.reference_number}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Two-pane Stage workflow & conditional pass/fail checkpoint criteria builder
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading Checklist Builder...</div>
      ) : (
        /* Two-Pane Master-Detail Builder Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          {/* Left Pane: Stages List (4 Cols) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" /> Stages ({stages.length})
                </span>
                <button
                  onClick={handleOpenAddStage}
                  className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg transition flex items-center gap-1"
                  id="add-stage-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Stage
                </button>
              </div>

              <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {stages.map((stg, idx) => {
                  const isSelected = stg.id === activeStageId;
                  return (
                    <div
                      key={stg.id}
                      onClick={() => setActiveStageId(stg.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? 'bg-teal-500/15 border-teal-500 text-teal-300 font-bold shadow-md'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <GripVertical className="w-4 h-4 text-slate-600 shrink-0 cursor-grab" />
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono flex items-center justify-center text-slate-300 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <div className="text-xs truncate font-medium">{stg.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {stg.checkpoints?.length || 0} Checkpoints
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => handleOpenEditStage(stg, e)}
                          className="p-1 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition"
                          title="Edit stage"
                          id={`edit-stage-${stg.id}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {stages.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteStage(stg.id, e)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Delete stage"
                            id={`delete-stage-${stg.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Pane: Stage Checkpoints Table (8 Cols) */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            {activeStage ? (
              <div>
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <span>{activeStage.name}</span>
                      </h3>
                      <button
                        onClick={(e) => handleOpenEditStage(activeStage, e)}
                        className="p-1 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition"
                        title="Edit stage name & options"
                        id="edit-active-stage-btn"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                      {activeStage.witness_required && (
                        <span className="flex items-center gap-1 text-teal-400">
                          <Eye className="w-3.5 h-3.5" /> Witness Required
                        </span>
                      )}
                      {activeStage.drawing_required && (
                        <span className="flex items-center gap-1 text-sky-400">
                          <FileCheck className="w-3.5 h-3.5" /> Drawing Required
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleOpenAddCheckpoint}
                    className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20"
                    id="add-checkpoint-item-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>

                {/* Checkpoint Table */}
                <div className="mt-4">
                  {activeStage.checkpoints?.length === 0 ? (
                    <div className="p-12 text-center bg-slate-950/40 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">No checkpoints in this stage yet.</p>
                      <button
                        onClick={handleOpenAddCheckpoint}
                        className="mt-2 text-xs font-bold text-teal-400 hover:underline"
                      >
                        + Add first checkpoint question
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-2.5">#</th>
                            <th className="px-3 py-2.5">Question / Criteria</th>
                            <th className="px-3 py-2.5">Input Type</th>
                            <th className="px-3 py-2.5">Fail Rule</th>
                            <th className="px-3 py-2.5 text-center">Reqs</th>
                            <th className="px-3 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {activeStage.checkpoints?.map((cp, cIdx) => (
                            <tr key={cp.id} className="hover:bg-slate-800/40 transition">
                              <td className="px-3 py-3 font-mono font-bold text-slate-400">{cIdx + 1}</td>
                              <td className="px-3 py-3 font-semibold text-slate-100 max-w-xs">{cp.question}</td>
                              <td className="px-3 py-3">
                                <span className="bg-slate-800 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-700">
                                  {cp.input_type}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {cp.fail_rule ? (
                                  <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                                    Fail if {cp.fail_rule}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-1.5 text-slate-400">
                                  {cp.photo_required && <Camera className="w-3.5 h-3.5 text-teal-400" title="Photo required" />}
                                  {cp.witness_required && <Eye className="w-3.5 h-3.5 text-sky-400" title="Witness required" />}
                                  {cp.drawing_required && <FileCheck className="w-3.5 h-3.5 text-amber-400" title="Drawing required" />}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenEditCheckpoint(cp)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition"
                                    title="Edit item"
                                    id={`edit-cp-${cp.id}`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCheckpoint(cp.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                    title="Delete item"
                                    id={`delete-cp-${cp.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Select a stage from the left pane to configure inspection items
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Stage Modal */}
      <Modal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        title={editingStage ? 'Edit Checklist Inspection Stage' : 'Add Checklist Inspection Stage'}
      >
        <form onSubmit={handleSaveStage} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Stage Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Stage 2 - Reinforcement & Cover Verification"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stageWitnessReq}
                onChange={e => setStageWitnessReq(e.target.checked)}
                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700"
              />
              <span>Stage Witness Authorization Mandatory</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stageDrawingReq}
                onChange={e => setStageDrawingReq(e.target.checked)}
                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700"
              />
              <span>Drawing Revision Attachment Mandatory</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsStageModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-teal-500/20 transition"
              id="save-stage-btn"
            >
              {editingStage ? 'Save Changes' : 'Create Stage'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Checkpoint Modal */}
      <CheckpointModal
        isOpen={isCpModalOpen}
        onClose={() => setIsCpModalOpen(false)}
        onSubmit={handleSaveCheckpoint}
        stageName={activeStage?.name || 'Selected Stage'}
        initialData={editingCheckpoint}
      />
    </div>
  );
};
