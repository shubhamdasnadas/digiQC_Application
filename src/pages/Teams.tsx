import React, { useState, useEffect } from 'react';
import { Team, TeamMember } from '../types';
import { api } from '../services/api';
import { TeamDetailPanel } from '../components/teams/TeamDetailPanel';
import { TeamFormModal } from '../components/teams/TeamFormModal';
import { ImportModal } from '../components/common/ImportModal';
import { Badge } from '../components/common/Badge';
import { Users2, Plus, FileSpreadsheet, Search, ChevronRight } from 'lucide-react';

export const Teams: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected drawer team
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const data = await api.getTeams();
      setTeams(data);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleSelectTeam = async (team: Team) => {
    setSelectedTeam(team);
    try {
      const members = await api.getTeamMembers(team.id);
      setSelectedMembers(members);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeam = async (teamData: Partial<Team>) => {
    await api.createTeam(teamData);
    loadTeams();
  };

  const handleImportTeams = async (rows: any[]) => {
    for (const row of rows) {
      await api.createTeam({
        name: row.Name || row['Team Name'] || 'Contractor Team Cell',
        type: (row.Type || 'inspection').toLowerCase(),
        team_lead_name: row['Team Lead'] || 'Lead Engineer',
        spoc_name: row.SPOC || 'Field SPOC',
      });
    }
    loadTeams();
  };

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.team_lead_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 w-full md:w-80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search teams or team lead..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full placeholder-slate-400"
            id="search-teams-input"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            id="import-teams-btn"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            Import
          </button>

          <button
            onClick={() => setIsFormModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition shadow-xs"
            id="add-team-btn"
          >
            <Plus className="w-4 h-4" /> Create Team
          </button>
        </div>
      </div>

      {/* Main Grid + Drawer Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Teams List (8 Cols if selected, 12 if not) */}
        <div className={selectedTeam ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs animate-pulse">Loading Teams...</div>
          ) : filteredTeams.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-xl border border-slate-200 space-y-3 shadow-sm">
              <Users2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-base font-bold text-slate-900">No Teams Found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTeams.map(team => {
                const isSelected = selectedTeam?.id === team.id;
                return (
                  <div
                    key={team.id}
                    onClick={() => handleSelectTeam(team)}
                    className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-500 text-slate-900 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          <Users2 className="w-4.5 h-4.5" />
                        </div>
                        <Badge status={team.type} />
                      </div>

                      <div className="mt-3">
                        <h3 className="text-sm font-bold text-slate-900">{team.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Lead: <strong className="text-slate-800">{team.team_lead_name || 'Sarvesh Gupta'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>SPOC: <strong className="text-slate-700">{team.spoc_name || 'Mayuresh Jadhav'}</strong></span>
                      <ChevronRight className="w-4 h-4 text-indigo-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Team Drawer Panel (5 Cols) */}
        {selectedTeam && (
          <div className="lg:col-span-5">
            <TeamDetailPanel
              team={selectedTeam}
              members={selectedMembers}
              onClose={() => setSelectedTeam(null)}
            />
          </div>
        )}
      </div>

      {/* Form Modal */}
      <TeamFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateTeam}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityName="Teams"
        onImportSubmit={handleImportTeams}
      />
    </div>
  );
};
