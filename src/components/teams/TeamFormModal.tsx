import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Team } from '../../types';

interface TeamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Team>) => Promise<void>;
}

export const TeamFormModal: React.FC<TeamFormModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'inspection' | 'audit' | 'compliance'>('inspection');
  const [teamLeadName, setTeamLeadName] = useState('');
  const [spocName, setSpocName] = useState('');
  const [activeProjects, setActiveProjects] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    await onSubmit({
      name,
      type,
      team_lead_name: teamLeadName,
      spoc_name: spocName,
      active_projects: activeProjects,
    });

    setName('');
    setTeamLeadName('');
    setSpocName('');
    setActiveProjects('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Execution or Contractor Team">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Team Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. R K Waterworks Waterproofing Cell"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Team Category</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="inspection">Field Inspection</option>
              <option value="audit">Quality Audit</option>
              <option value="compliance">Safety & Compliance</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Team Lead Name</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Patel"
              value={teamLeadName}
              onChange={e => setTeamLeadName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Single Point of Contact (SPOC)</label>
          <input
            type="text"
            placeholder="e.g. Mayuresh Jadhav"
            value={spocName}
            onChange={e => setSpocName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Active Assigned Projects (Comma Separated)
          </label>
          <input
            type="text"
            placeholder="e.g. AURORA Tower A, FALCON CREST Commercial"
            value={activeProjects}
            onChange={e => setActiveProjects(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
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
          >
            Create Team
          </button>
        </div>
      </form>
    </Modal>
  );
};
