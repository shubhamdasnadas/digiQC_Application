'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, ChevronLeft, Search, Check, Mail, CheckCircle2 } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  type: string;
}

import type { Member } from '@/lib/types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member?: Member | null;
}

export default function AddMemberModal({ isOpen, onClose, onSuccess, member }: AddMemberModalProps) {
  const [step, setStep] = useState(1);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailSentNotice, setEmailSentNotice] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    teamId: '',
  });

  const [teamFormData, setTeamFormData] = useState({
    name: '',
    type: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setEmailSentNotice(null);
      setStep(1);
      fetchTeams();
      if (member) {
        setFormData({
          name: member.name,
          role: member.default_role || '',
          email: member.email,
          phone: member.phone || '',
          teamId: member.teams || '',
        });
      } else {
        setFormData({
          name: '',
          role: '',
          email: '',
          phone: '',
          teamId: '',
        });
      }
    }
  }, [isOpen, member]);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleAddTeam = async () => {
    if (!teamFormData.name || !teamFormData.type) return;
    setLoading(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamFormData.name,
          type: teamFormData.type,
        }),
      });
      if (res.ok) {
        await fetchTeams();
        setIsAddingTeam(false);
        setTeamFormData({ name: '', type: '' });
      }
    } catch (error) {
      console.error('Failed to add team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMember = async () => {
    setLoading(true);
    try {
      const method = member ? 'PUT' : 'POST';
      const url = member ? `/api/members?id=${member.id}` : '/api/members';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          default_role: formData.role,
          teams: formData.teamId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        if (data.emailSent) {
          setEmailSentNotice(data.emailSentTo || formData.email);
        } else {
          onClose();
        }
      } else {
        alert(data.error || `Failed to ${member ? 'update' : 'add'} member`);
      }
    } catch (error) {
      console.error(`Failed to ${member ? 'update' : 'add'} member:`, error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (emailSentNotice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center space-y-6 animate-in fade-in zoom-in duration-200 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-500 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="w-16 h-16 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner ring-8 ring-teal-50/50 dark:ring-teal-500/10">
            <Mail size={32} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Check Email</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              A secure password {member ? 'update' : 'setup'} link has been sent to{' '}
              <span className="font-semibold text-teal-700 dark:text-teal-400">{emailSentNotice}</span>.
            </p>
            <p className="text-xs text-gray-400">
              The user can click the link in the email to set their password and log in immediately.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 bg-teal-500 text-white rounded-full font-semibold hover:bg-teal-600 transition-all shadow-lg shadow-teal-500/20 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-500 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Stepper Header */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center justify-between max-w-xs mx-auto">
            <div className="flex items-center gap-3">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 1 ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                 {step === 1 ? '1' : <Check size={16} />}
               </div>
               <span className={`text-sm font-medium ${step === 1 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{member ? 'Edit User' : 'Add User'}</span>
             </div>

            <div className={`h-0.5 w-12 transition-colors ${step === 2 ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'}`} />

            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 2 ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                2
              </div>
              <span className={`text-sm font-medium ${step === 2 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>Select Team</span>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="px-8 pb-8">
          {step === 1 ? (
            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter name"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Roles
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                >
                  <option value="">Select Role</option>
                  <option value="User">User</option>
                  <option value="External Auditor">External Auditor</option>
                  <option value="Checklist Maker">Checklist Maker</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="w-20 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm flex items-center justify-center">
                    +91
                  </div>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="Enter mobile number"
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                </div>
                <p className="text-xs text-teal-500 dark:text-teal-400 mt-1">Note: Please do not include "0" as a prefix when adding a mobile number</p>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.name || !formData.role || !formData.email || !formData.phone}
                  className="px-8 py-2.5 bg-teal-500 text-white rounded-full font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Select Team
                </label>
                <div className="relative">
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({...formData, teamId: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all appearance-none"
                  >
                    <option value="">Select Team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.name}>{team.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronLeft size={16} className="rotate-180" />
                  </div>
                </div>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-800"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-gray-900 px-2 text-gray-400 font-medium">Create Team</span></div>
              </div>

              <button
                onClick={() => setIsAddingTeam(true)}
                className="flex items-center gap-2 text-teal-500 dark:text-teal-400 font-semibold text-sm hover:text-teal-600 dark:hover:text-teal-300 transition-colors"
              >
                <Plus size={16} /> Add Team
              </button>

              <div className="flex justify-between items-center pt-6">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                 <button
                   onClick={handleSaveMember}
                   disabled={!formData.teamId || loading}
                   className="px-8 py-2.5 bg-teal-500 text-white rounded-full font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20"
                 >
                   {loading ? (member ? 'Updating...' : 'Adding...') : (member ? 'Update User' : 'Add User')}
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* Add Team Sub-Modal */}
        {isAddingTeam && (
          <div className="absolute inset-0 z-10 bg-white dark:bg-gray-900 animate-in fade-in slide-in-from-bottom-4 duration-300 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Team</h3>
              <button onClick={() => setIsAddingTeam(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Name
                </label>
                <input
                  type="text"
                  value={teamFormData.name}
                  onChange={(e) => setTeamFormData({...teamFormData, name: e.target.value})}
                  placeholder="Enter Name"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <span className="text-teal-500">*</span> Type
                </label>
                <select
                  value={teamFormData.type}
                  onChange={(e) => setTeamFormData({...teamFormData, type: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                >
                  <option value="">Select Type</option>
                  <option value="Consultant">Consultant</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Client">Client</option>
                  <option value="Developer">Developer</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleAddTeam}
                  disabled={!teamFormData.name || !teamFormData.type || loading}
                  className="px-8 py-2.5 bg-teal-500 text-white rounded-full font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20"
                >
                  {loading ? 'Saving...' : 'Save Team'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}