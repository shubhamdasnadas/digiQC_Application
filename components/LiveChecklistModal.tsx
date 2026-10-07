'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, XCircle, ChevronDown, Search, Loader2 } from 'lucide-react';
import type { Checklist } from '@/lib/types';

interface LiveChecklistModalProps {
  isOpen?: boolean;
  projectId: string;
  checklist: Checklist;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProjectMemberItem {
  id: string;
  user_id: string;
  user_name?: string;
  name?: string;
  user_email?: string;
  email?: string;
  role?: string;
  user_teams?: string;
  teams?: string;
}

interface ProjectTeamItem {
  id: string;
  team_id: string;
  team_name: string;
  name?: string;
  team_type?: string;
  type?: string;
}

const UOM_OPTIONS = [
  'Number',
  'Square Meter (SQM)',
  'Cubic Meter (CUM)',
  'Meter (RMT)',
  'Kilogram (KG)',
  'Ton (MT)',
  'Litre',
  'Piece',
  'Percentage',
  'Hour',
  'Set',
  'Bag',
  'Nos',
];

export default function LiveChecklistModal({
  isOpen = true,
  projectId,
  checklist,
  onClose,
  onSuccess,
}: LiveChecklistModalProps) {
  // Form State
  const [name, setName] = useState(checklist.name || '');
  const [uom, setUom] = useState(checklist.uom || 'Number');
  const [referenceNumber, setReferenceNumber] = useState(checklist.reference_number || '');

  // Members & Teams State
  const [members, setMembers] = useState<ProjectMemberItem[]>([]);
  const [teams, setTeams] = useState<ProjectTeamItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  // Dropdown UI State
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) {
        setIsTeamDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load project members and teams on open
  useEffect(() => {
    if (!isOpen) return;

    setName(checklist.name || '');
    setUom(checklist.uom || 'Number');
    setReferenceNumber(checklist.reference_number || '');
    setError('');

    const fetchData = async () => {
      try {
        const [memRes, teamsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/members`),
          fetch(`/api/projects/${projectId}/teams`),
        ]);

        const [projMem, projTeams] = await Promise.all([
          memRes.json().catch(() => []),
          teamsRes.json().catch(() => []),
        ]);

        // Only load users connected to this project
        const projectMembers: ProjectMemberItem[] = [];
        const seenMemberIds = new Set<string>();

        if (Array.isArray(projMem)) {
          for (const m of projMem) {
            const uid = m.user_id || m.id;
            if (uid && !seenMemberIds.has(uid)) {
              seenMemberIds.add(uid);
              projectMembers.push({
                id: m.id || uid,
                user_id: uid,
                name: m.user_name || m.name || '',
                user_name: m.user_name || m.name || '',
                email: m.user_email || m.email || '',
                user_email: m.user_email || m.email || '',
                role: m.role || 'member',
                teams: m.user_teams || m.teams || '',
                user_teams: m.user_teams || m.teams || '',
              });
            }
          }
        }

        // Only load teams connected to this project
        const projectTeams: ProjectTeamItem[] = [];
        const seenTeamIds = new Set<string>();

        if (Array.isArray(projTeams)) {
          for (const t of projTeams) {
            const tid = t.team_id || t.id;
            if (tid && !seenTeamIds.has(tid)) {
              seenTeamIds.add(tid);
              projectTeams.push({
                id: t.id || tid,
                team_id: tid,
                team_name: t.team_name || t.name || '',
                name: t.team_name || t.name || '',
                team_type: t.team_type || t.type || 'DEFAULT',
                type: t.team_type || t.type || 'DEFAULT',
              });
            }
          }
        }

        setMembers(projectMembers);
        setTeams(projectTeams);

        // Auto-select project admins
        const adminUserIds = projectMembers
          .filter((m) => m.role === 'admin')
          .map((m) => m.user_id);
        if (adminUserIds.length > 0) {
          setSelectedUserIds((prev) => Array.from(new Set([...prev, ...adminUserIds])));
        }
      } catch (err) {
        console.error('Error fetching members/teams in LiveChecklistModal:', err);
      }
    };

    fetchData();
  }, [isOpen, projectId, checklist]);

  // Filtered members by search
  const filteredMembers = useMemo(() => {
    if (!userSearch.trim()) return members;
    const q = userSearch.toLowerCase().trim();
    return members.filter(
      (m) =>
        (m.name || m.user_name || '').toLowerCase().includes(q) ||
        (m.email || m.user_email || '').toLowerCase().includes(q) ||
        (m.teams || m.user_teams || '').toLowerCase().includes(q)
    );
  }, [members, userSearch]);

  // Teams available based on selected users
  const availableTeams = useMemo(() => {
    if (selectedUserIds.length === 0) return teams;
    const selectedMembers = members.filter((m) => selectedUserIds.includes(m.user_id));
    const userTeamNames = new Set(
      selectedMembers
        .flatMap((m) => (m.teams || m.user_teams || '').split(',').map((t) => t.trim().toLowerCase()))
        .filter(Boolean)
    );
    // If selected users have assigned teams, show only those connected teams
    if (userTeamNames.size > 0) {
      return teams.filter((t) =>
        userTeamNames.has((t.team_name || t.name || '').trim().toLowerCase())
      );
    }
    return teams;
  }, [teams, members, selectedUserIds]);

  // Filtered teams by search
  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return availableTeams;
    const q = teamSearch.toLowerCase().trim();
    return availableTeams.filter(
      (t) =>
        (t.team_name || t.name || '').toLowerCase().includes(q) ||
        (t.team_type || t.type || '').toLowerCase().includes(q)
    );
  }, [availableTeams, teamSearch]);

  // Auto-prune selected teams if they are no longer in availableTeams
  useEffect(() => {
    if (selectedUserIds.length > 0 && availableTeams.length > 0) {
      const validTeamIds = new Set(availableTeams.map((t) => t.team_id));
      setSelectedTeamIds((prev) => prev.filter((id) => validTeamIds.has(id)));
    }
  }, [availableTeams, selectedUserIds]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllUsers = () => {
    if (selectedUserIds.length === members.length && members.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(members.map((m) => m.user_id));
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleSelectAllTeams = () => {
    const availableTeamIds = availableTeams.map((t) => t.team_id);
    const allAvailableSelected =
      availableTeamIds.length > 0 && availableTeamIds.every((tid) => selectedTeamIds.includes(tid));
    if (allAvailableSelected) {
      setSelectedTeamIds((prev) => prev.filter((tid) => !availableTeamIds.includes(tid)));
    } else {
      setSelectedTeamIds((prev) => Array.from(new Set([...prev, ...availableTeamIds])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Checklist name is required.');
      return;
    }
    if (!uom.trim()) {
      setError('UOM is required.');
      return;
    }
    if (selectedTeamIds.length === 0) {
      setError('Please select at least one team.');
      return;
    }

    setSaving(true);

    try {
      // 1. Update checklist status to live with name, uom, reference_number
      const patchRes = await fetch(`/api/checklists/${checklist.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          uom: uom.trim(),
          reference_number: referenceNumber.trim(),
          status: 'live',
        }),
      });

      if (!patchRes.ok) {
        const d = await patchRes.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update checklist status');
      }

      // 2. Link selected teams & update assigned_checklist for this project
      const chkName = name.trim() || checklist.name;
      for (const teamId of selectedTeamIds) {
        const teamObj = teams.find((t) => t.team_id === teamId);
        await fetch(`/api/projects/${projectId}/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: teamId,
            team_name: teamObj?.team_name || teamObj?.name || '',
            team_type: teamObj?.team_type || teamObj?.type || 'DEFAULT',
            assigned_checklist: [chkName],
            user_ids: selectedUserIds,
          }),
        }).catch((err) => console.warn('Team assignment sync warn:', err));
      }

      // 3. Assign selected users to project_members
      if (selectedUserIds.length > 0) {
        await fetch(`/api/projects/${projectId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: selectedUserIds.map((uid) => ({ user_id: uid, role: 'member' })),
          }),
        }).catch((err) => console.warn('Member assignment sync warn:', err));
      }

      // 4. Create initial EQC linkage for the project
      await fetch(`/api/projects/${projectId}/eqcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: checklist.id,
          assigned_user_ids: selectedUserIds,
          assigned_team_ids: selectedTeamIds,
        }),
      }).catch((err) => console.warn('EQC linkage sync warn:', err));

      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to go live');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />

      {/* Modal Dialog Box matching Image #44 */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 animate-scale-in flex flex-col max-h-[92vh] overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Live Checklist
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ── 1. Name ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="text-red-500 mr-1">*</span>Name
            </label>
            <div className="relative">
              <input
                type="text"
                className="input w-full text-sm font-medium pr-8"
                placeholder="Exec - Tie Road"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
              />
              {name.length > 0 && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                >
                  <XCircle size={15} className="fill-gray-300 dark:fill-gray-600 text-white dark:text-gray-900" />
                </button>
              )}
            </div>
          </div>

          {/* ── 2. UOM ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="text-red-500 mr-1">*</span>UOM
            </label>
            <div className="relative">
              <select
                className="input w-full text-sm font-medium pr-9 appearance-none bg-white dark:bg-gray-800"
                value={uom}
                onChange={(e) => {
                  setUom(e.target.value);
                  setError('');
                }}
              >
                {UOM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* ── 3. Reference Number ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Reference Number
            </label>
            <div className="relative">
              <input
                type="text"
                className="input w-full text-sm font-medium pr-8 font-mono text-xs"
                placeholder="PCPL/EXEC/MIVAN TIE ROD/2025/0001"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
              {referenceNumber.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReferenceNumber('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                >
                  <XCircle size={15} className="fill-gray-300 dark:fill-gray-600 text-white dark:text-gray-900" />
                </button>
              )}
            </div>
          </div>

          {/* ── 4. User ── */}
          <div className="relative z-30" ref={userDropdownRef}>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              User
            </label>
            <button
              type="button"
              onClick={() => {
                setIsUserDropdownOpen(!isUserDropdownOpen);
                setIsTeamDropdownOpen(false);
              }}
              className="input w-full text-left flex items-center justify-between text-sm py-2.5 px-3 bg-white dark:bg-gray-800"
            >
              <span className={`truncate ${selectedUserIds.length ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
                {selectedUserIds.length === 0
                  ? 'Select users'
                  : `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} selected`}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform duration-200 shrink-0 ${isUserDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Note matching Image #44 */}
            <p className="text-xs font-semibold text-amber-500 dark:text-amber-400 mt-1.5 leading-snug">
              All project admins will be auto assigned to this Checklist
            </p>

            {/* Dropdown Menu */}
            {isUserDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in ring-1 ring-black/5">
                {/* Search */}
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users…"
                      className="w-full text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-red-400"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Select All */}
                {members.length > 0 && (
                  <div
                    onClick={toggleSelectAllUsers}
                    className="flex items-center gap-2 px-3.5 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.length > 0 && selectedUserIds.length === members.length}
                      onChange={() => {}}
                      className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                    />
                    <span>Select All ({members.length})</span>
                  </div>
                )}

                {/* Users List */}
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                  {filteredMembers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      No users found.
                    </div>
                  ) : (
                    filteredMembers.map((m) => {
                      const isChecked = selectedUserIds.includes(m.user_id);
                      return (
                        <div
                          key={m.user_id}
                          onClick={() => toggleUser(m.user_id)}
                          className={`flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer text-xs transition-colors ${
                            isChecked ? 'bg-red-50/50 dark:bg-red-500/10' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">
                              {m.name || m.user_name}
                            </div>
                            <div className="text-[11px] text-gray-400 truncate">
                              {m.email || m.user_email || 'No email'} {m.teams || m.user_teams ? `• ${m.teams || m.user_teams}` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 5. Team ── */}
          <div className="relative z-20" ref={teamDropdownRef}>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="text-red-500 mr-1">*</span>Team
            </label>
            <button
              type="button"
              onClick={() => {
                setIsTeamDropdownOpen(!isTeamDropdownOpen);
                setIsUserDropdownOpen(false);
              }}
              className="input w-full text-left flex items-center justify-between text-sm py-2.5 px-3 bg-white dark:bg-gray-800"
            >
              <span className={`truncate ${selectedTeamIds.length ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
                {selectedTeamIds.length === 0
                  ? 'Select teams'
                  : `${selectedTeamIds.length} team${selectedTeamIds.length > 1 ? 's' : ''} selected`}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform duration-200 shrink-0 ${isTeamDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isTeamDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in ring-1 ring-black/5">
                {/* Search */}
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search teams…"
                      className="w-full text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-red-400"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Select All */}
                {availableTeams.length > 0 && (
                  <div
                    onClick={toggleSelectAllTeams}
                    className="flex items-center gap-2 px-3.5 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={
                        availableTeams.length > 0 &&
                        availableTeams.every((t) => selectedTeamIds.includes(t.team_id))
                      }
                      onChange={() => {}}
                      className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                    />
                    <span>Select All ({availableTeams.length})</span>
                  </div>
                )}

                {/* Teams List */}
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                  {filteredTeams.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      No teams found.
                    </div>
                  ) : (
                    filteredTeams.map((t) => {
                      const isChecked = selectedTeamIds.includes(t.team_id);
                      return (
                        <div
                          key={t.team_id}
                          onClick={() => toggleTeam(t.team_id)}
                          className={`flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer text-xs transition-colors ${
                            isChecked ? 'bg-red-50/50 dark:bg-red-500/10' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-gray-900 dark:text-white truncate block">
                              {t.team_name || t.name}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {t.team_type || t.type || 'DEFAULT'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Action Buttons matching Image #44 ── */}
          <div className="flex items-center justify-end gap-3 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 rounded-full text-xs font-bold text-white bg-[#c1121f] hover:bg-red-700 active:bg-red-800 shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>Go Live</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
