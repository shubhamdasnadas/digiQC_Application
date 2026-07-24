import React, { useState, useEffect } from 'react';
import { Checklist } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { CheckSquare, Layers, Plus } from 'lucide-react';

interface ProjectChecklistsTabProps {
  projectId: string;
  onOpenChecklistBuilder?: (checklistId: string) => void;
}

export const ProjectChecklistsTab: React.FC<ProjectChecklistsTabProps> = ({ projectId, onOpenChecklistBuilder }) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const data = await api.getChecklists();
      // Filter for this project or global
      const filtered = data.filter(c => c.project_id === projectId || c.project_id === null);
      setChecklists(filtered);
    } catch (err) {
      console.error('Failed to load project checklists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChecklists();
  }, [projectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Project Quality Inspection Checklists</h3>
          <p className="text-xs text-slate-400">Assigned inspection standards and stage checkpoint criteria</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading Checklists...</div>
      ) : checklists.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No active checklists assigned</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {checklists.map(c => (
            <div
              key={c.id}
              onClick={() => onOpenChecklistBuilder && onOpenChecklistBuilder(c.id)}
              className="bg-slate-900 border border-slate-800 hover:border-teal-500/60 rounded-2xl p-5 shadow-lg transition cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-teal-400 transition">
                      {c.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">{c.reference_number}</span>
                  </div>
                </div>
                <Badge status={c.status} />
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Layers className="w-3.5 h-3.5 text-teal-400" />
                    <strong>{c.stages_count || 3}</strong> Stages
                  </span>
                  <span>UOM: <strong className="text-slate-200">{c.uom}</strong></span>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  {c.source === 'library' ? 'Global Library' : 'Project Custom'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
