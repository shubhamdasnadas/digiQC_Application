import React, { useState, useEffect } from 'react';
import { Team } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Users2, Link, UserCheck } from 'lucide-react';

interface ProjectTeamsTabProps {
  projectId: string;
}

export const ProjectTeamsTab: React.FC<ProjectTeamsTabProps> = ({ projectId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const data = await api.getTeams();
      setTeams(data);
    } catch (err) {
      console.error('Failed to load project teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, [projectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Linked Execution & Contracting Teams</h3>
          <p className="text-xs text-slate-400">Sub-contractors, specialized auditing cells, and field teams assigned</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading Teams...</div>
      ) : teams.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <Users2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No contractor teams linked</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(team => (
            <div
              key={team.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
                    <Users2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{team.name}</h4>
                    <Badge status={team.type} className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Team Lead</span>
                  <strong className="text-slate-200">{team.team_lead_name || 'Sarvesh Gupta'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Single Point of Contact</span>
                  <strong className="text-slate-200">{team.spoc_name || 'Mayuresh Jadhav'}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
