import React, { useState, useEffect } from 'react';
import { ProjectMember } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { Users, Plus, Shield, Mail, Calendar, UserCheck } from 'lucide-react';

interface ProjectMembersTabProps {
  projectId: string;
}

export const ProjectMembersTab: React.FC<ProjectMembersTabProps> = ({ projectId }) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'inspector' | 'approver' | 'viewer'>('inspector');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await api.getProjectMembers(projectId);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load project members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    try {
      // Simulate adding/assigning member
      await api.addProjectMember(projectId, 'usr-sarvesh', selectedRole);
      setIsModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      loadMembers();
    } catch (err) {
      console.error('Failed to assign member:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100">Assigned Engineers & QC Personnel</h3>
          <p className="text-xs text-slate-400">Manage site team roles and stage inspection authorization</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20"
          id="assign-member-btn"
        >
          <Plus className="w-4 h-4" /> Assign Project Member
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading Team Members...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {members.map(m => (
            <div
              key={m.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/40 font-bold flex items-center justify-center text-xs shrink-0">
                {m.user_name ? m.user_name.substring(0, 2).toUpperCase() : 'QC'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-100 truncate">{m.user_name}</div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-500" /> {m.user_email}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold bg-slate-800 text-teal-400 border border-slate-700 px-2 py-0.5 rounded">
                    {m.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Member Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assign Personnel to Project">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Patel"
              value={newUserName}
              onChange={e => setNewUserName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. ramesh.patel@pranavconstructions.com"
              value={newUserEmail}
              onChange={e => setNewUserEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Project Role & RBAC Level</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="inspector">Inspector (Field Checklist Evaluator)</option>
              <option value="approver">Approver (Stage Sign-off Authority)</option>
              <option value="admin">Project Admin (Full Settings Control)</option>
              <option value="viewer">Viewer (Read-only Audit Log)</option>
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
              Assign Engineer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
