import React, { useState, useEffect } from 'react';
import { ProjectTarget } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { Target, Plus, TrendingUp, Calendar, Award } from 'lucide-react';

interface ProjectTargetsTabProps {
  projectId: string;
}

export const ProjectTargetsTab: React.FC<ProjectTargetsTabProps> = ({ projectId }) => {
  const [targets, setTargets] = useState<ProjectTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [metric, setMetric] = useState('');
  const [targetVal, setTargetVal] = useState(100);
  const [currentVal, setCurrentVal] = useState(0);
  const [unit, setUnit] = useState('Sq. Ft');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'project'>('weekly');

  const loadTargets = async () => {
    try {
      setLoading(true);
      const data = await api.getProjectTargets(projectId);
      setTargets(data);
    } catch (err) {
      console.error('Failed to load targets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargets();
  }, [projectId]);

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metric) return;

    try {
      await api.createProjectTarget(projectId, {
        metric,
        target_value: Number(targetVal),
        current_value: Number(currentVal),
        unit,
        period,
      });
      setIsModalOpen(false);
      setMetric('');
      setTargetVal(100);
      setCurrentVal(0);
      loadTargets();
    } catch (err) {
      console.error('Failed to create target:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Quality & Progress KPI Targets</h3>
          <p className="text-xs text-slate-400">Track execution speed, slab turnover, and defect closure SLAs</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20"
          id="add-kpi-target-btn"
        >
          <Plus className="w-4 h-4" /> Add KPI Target
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading Targets...</div>
      ) : targets.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No KPI targets defined</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {targets.map(t => {
            const pct = Math.min(100, Math.round((t.current_value / (t.target_value || 1)) * 100));
            return (
              <div
                key={t.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-400 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-100">{t.metric}</h4>
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-slate-800 text-teal-300 border border-slate-700 px-2 py-0.5 rounded">
                    {t.period}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      {t.current_value} / {t.target_value} {t.unit}
                    </span>
                    <span className="font-bold text-teal-400 font-mono">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Target Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Define Project KPI Target">
        <form onSubmit={handleCreateTarget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Metric Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Weekly Slab Pour Volume"
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Value</label>
              <input
                type="number"
                required
                value={targetVal}
                onChange={e => setTargetVal(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Current Achieved</label>
              <input
                type="number"
                required
                value={currentVal}
                onChange={e => setCurrentVal(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="Sq. Ft, %, Hours"
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tracking Period</label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="daily">Daily Target</option>
              <option value="weekly">Weekly Target</option>
              <option value="monthly">Monthly Target</option>
              <option value="quarterly">Quarterly Target</option>
              <option value="project">Total Project Lifetime Target</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-teal-500/20 transition"
            >
              Set Target
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
