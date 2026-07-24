import React from 'react';
import { Team, TeamMember } from '../../types';
import { Badge } from '../common/Badge';
import { X, Users, Mail, Phone, Folder, Shield, User } from 'lucide-react';

interface TeamDetailPanelProps {
  team: Team | null;
  members: TeamMember[];
  onClose: () => void;
}

export const TeamDetailPanel: React.FC<TeamDetailPanelProps> = ({ team, members, onClose }) => {
  if (!team) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between space-y-6 h-full animate-slide-in-left">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{team.name}</h3>
              <Badge status={team.type} className="mt-1" />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lead & SPOC Info */}
        <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Team Lead</span>
            <span className="font-bold text-slate-200">{team.team_lead_name || 'Sarvesh Gupta'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">SPOC Representative</span>
            <span className="font-bold text-slate-200">{team.spoc_name || 'Mayuresh Jadhav'}</span>
          </div>
        </div>

        {/* Active Projects Assignment */}
        <div className="mb-6 space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Folder className="w-3.5 h-3.5 text-teal-400" /> Active Assigned Projects
          </span>
          <div className="flex flex-wrap gap-1.5">
            {team.active_projects
              ? team.active_projects.split(',').map((p, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-semibold bg-slate-800 text-teal-300 border border-slate-700/80 px-2.5 py-1 rounded-lg"
                  >
                    {p.trim()}
                  </span>
                ))
              : <span className="text-xs text-slate-500">No projects currently linked</span>}
          </div>
        </div>

        {/* Team Members List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
            <span>Team Roster ({members.length})</span>
          </h4>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {members.map(m => (
              <div
                key={m.id}
                className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {m.name ? m.name.substring(0, 2).toUpperCase() : 'QC'}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-100 truncate">{m.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                  </div>
                </div>

                <span className="text-[10px] font-bold bg-slate-800 text-teal-300 border border-slate-700 px-2 py-0.5 rounded shrink-0">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
