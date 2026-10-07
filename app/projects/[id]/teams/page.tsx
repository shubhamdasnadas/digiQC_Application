'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus,
  X,
  Loader2,
  Trash2,
  Pencil,
  Search,
  ChevronDown,
  Check,
  ArrowLeft,
  ArrowRight,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import type { Team, Member, Checklist } from '@/lib/types';

interface ProjectTeamRow {
  id: string;
  project_id: string;
  team_id: string;
  team_name: string;
  team_type: string;
  team_lead_name: string;
  spoc_name: string;
  assigned_checklist: string;
  assigned_user: string;
  added_at: string;
}

export default function TeamsTab() {
  const { id } = useParams<{ id: string }>();
  const [linked, setLinked] = useState<ProjectTeamRow[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [projectChecklists, setProjectChecklists] = useState<Checklist[]>([]);
  const [allChecklists, setAllChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ProjectTeamRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const [linkedRes, teamsRes, membersRes, projChecklistsRes, allChecklistsRes, libChecklistsRes] = await Promise.all([
        fetch(`/api/projects/${id}/teams`),
        fetch('/api/teams'),
        fetch('/api/members'),
        fetch(`/api/checklists?project_id=${id}`),
        fetch('/api/checklists'),
        fetch('/api/checklists/library'),
      ]);
      const l = await linkedRes.json().catch(() => []);
      const t = await teamsRes.json().catch(() => []);
      const m = await membersRes.json().catch(() => []);
      const projC = await projChecklistsRes.json().catch(() => []);
      const allC = await allChecklistsRes.json().catch(() => []);
      const libC = await libChecklistsRes.json().catch(() => []);

      // Combine and deduplicate global and library checklists
      const combinedGlobal = [...(Array.isArray(allC) ? allC : []), ...(Array.isArray(libC) ? libC : [])];
      const seenNames = new Set<string>();
      const deduplicatedGlobal: Checklist[] = [];
      for (const item of combinedGlobal) {
        if (item && item.name && !seenNames.has(item.name.toLowerCase().trim())) {
          seenNames.add(item.name.toLowerCase().trim());
          deduplicatedGlobal.push(item);
        }
      }

      setLinked(Array.isArray(l) ? l : []);
      setAllTeams(Array.isArray(t) ? t : []);
      setAllMembers(Array.isArray(m) ? m : []);
      setProjectChecklists(Array.isArray(projC) ? projC : []);
      setAllChecklists(deduplicatedGlobal);
    } catch {
      setLinked([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  const unlink = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to remove team "${teamName}" from this project?`)) {
      return;
    }
    setDeletingId(teamId);
    try {
      const res = await fetch(`/api/projects/${id}/teams?team_id=${teamId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove team');
      setLinked((arr) => arr.filter((r) => r.team_id !== teamId));
    } catch (err) {
      alert((err as Error).message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!search.trim()) return linked;
    const q = search.toLowerCase().trim();
    return linked.filter((r) => {
      const nameMatch = (r.team_name || '').toLowerCase().includes(q);
      const typeMatch = (r.team_type || '').toLowerCase().includes(q);
      const userMatch = (r.assigned_user || '').toLowerCase().includes(q);
      const chkMatch = (r.assigned_checklist || '').toLowerCase().includes(q);
      return nameMatch || typeMatch || userMatch || chkMatch;
    });
  }, [linked, search]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Adjust page if out of bounds
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const renderCommaList = (value: string, label: string) => {
    const names = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) {
      return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
    }
    if (names.length === 1) {
      return (
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
          {names[0]}
        </span>
      );
    }
    return (
      <div className="relative group inline-block">
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 cursor-pointer underline decoration-dotted decoration-gray-400 hover:text-red-600 dark:hover:text-red-400 underline-offset-2 transition-colors">
          {names[0]} <span className="text-xs text-red-500 font-semibold">+{names.length - 1}</span>
        </span>
        <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 max-w-xs opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-top-left">
          <div className="rounded-xl bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white text-xs leading-relaxed p-3 shadow-2xl border border-gray-750 dark:border-gray-700">
            <div className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider mb-1.5 border-b border-gray-700/60 pb-1">
              Assigned {label} ({names.length})
            </div>
            <ul className="space-y-1">
              {names.map((n, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="truncate">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderTypeBadge = (type: string) => {
    const cleanType = (type || 'DEFAULT').toUpperCase();
    let bg = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (cleanType === 'CONTRACTOR') bg = 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20';
    else if (cleanType === 'INSPECTION') bg = 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20';
    else if (cleanType === 'DEFAULT') bg = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20';
    else if (cleanType === 'CLIENT') bg = 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200/50 dark:border-purple-500/20';
    else if (cleanType === 'CONSULTANT') bg = 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/20';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ${bg}`}>
        {cleanType}
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ─── Header matching Image #39 ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Team Details</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            {linked.length} Teams
          </span>
        </div>

        {/* Action Controls: Search & + Add button */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search team, type, user..."
              className="input pl-9 pr-3 py-1.5 text-xs w-full"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 shrink-0"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="card overflow-hidden border border-gray-200/80 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/90 dark:bg-gray-800/60 border-b border-gray-200/80 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">#</th>
                <th className="px-5 py-3.5 min-w-[160px]">TEAM</th>
                <th className="px-4 py-3.5 min-w-[120px]">TYPE</th>
                <th className="px-5 py-3.5 min-w-[200px]">USER</th>
                <th className="px-5 py-3.5 min-w-[220px]">ASSIGNED CHECKLIST</th>
                <th className="px-4 py-3.5 w-20 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Loader2 size={24} className="animate-spin text-red-500 mx-auto mb-2" />
                    <span className="text-xs text-gray-400">Loading team details…</span>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400">
                    <Users size={36} className="mx-auto mb-2 opacity-30 text-gray-500" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {search ? 'No matching teams found' : 'No teams linked to this project yet'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search ? 'Try clearing your search query' : 'Click "+ Add" to link or create a team'}
                    </p>
                    {!search && (
                      <button
                        onClick={() => setShowAdd(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm"
                      >
                        <Plus size={14} /> Add Team
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const globalIdx = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={r.id || r.team_id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* # */}
                      <td className="px-4 py-3.5 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                        {globalIdx}
                      </td>

                      {/* TEAM */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {r.team_name}
                        </span>
                      </td>

                      {/* TYPE */}
                      <td className="px-4 py-3.5">
                        {renderTypeBadge(r.team_type)}
                      </td>

                      {/* USER */}
                      <td className="px-5 py-3.5">
                        {renderCommaList(r.assigned_user, 'Users')}
                      </td>

                      {/* ASSIGNED CHECKLIST */}
                      <td className="px-5 py-3.5">
                        {renderCommaList(r.assigned_checklist, 'Checklists')}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingTeam(r)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Edit Team"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => unlink(r.team_id, r.team_name)}
                            disabled={deletingId === r.team_id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Delete Team"
                          >
                            {deletingId === r.team_id ? (
                              <Loader2 size={13} className="animate-spin text-red-500" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination Footer ─── */}
        {!loading && filteredRows.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-white dark:bg-gray-900 border-t border-gray-150 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <div>
              Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">{Math.min(page * pageSize, filteredRows.length)}</span> of{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredRows.length}</span> teams
            </div>

            <div className="flex items-center gap-2">
              {/* Items per page selector */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="input py-1 px-2 text-xs bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              {/* Page Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  // Show current page, first, last, and neighbors
                  if (totalPages > 5 && Math.abs(pNum - page) > 1 && pNum !== 1 && pNum !== totalPages) {
                    if (pNum === 2 || pNum === totalPages - 1) {
                      return <span key={pNum} className="px-1 text-gray-400">…</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${page === pNum
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Multi-Step Add Team Modal (Images #35, #38) ─── */}
      {showAdd && (
        <AddTeamWizardModal
          projectId={id}
          allTeams={allTeams}
          allMembers={allMembers}
          projectChecklists={projectChecklists}
          allChecklists={allChecklists}
          alreadyLinkedTeamIds={linked.map((l) => l.team_id)}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {/* ─── Edit Team Modal ─── */}
      {editingTeam && (
        <EditTeamModal
          projectId={id}
          teamRow={editingTeam}
          allMembers={allMembers}
          projectChecklists={projectChecklists}
          allChecklists={allChecklists}
          onClose={() => setEditingTeam(null)}
          onSaved={() => {
            setEditingTeam(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Multi-Step Add Team Wizard Modal (Images #35, #38)
// ============================================================================
function AddTeamWizardModal({
  projectId,
  allTeams,
  allMembers,
  projectChecklists,
  allChecklists,
  alreadyLinkedTeamIds,
  onClose,
  onSaved,
}: {
  projectId: string;
  allTeams: Team[];
  allMembers: Member[];
  projectChecklists: Checklist[];
  allChecklists: Checklist[];
  alreadyLinkedTeamIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Step 1: Add Team, Step 2: Add User
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form State (Image #35)
  const [pickFromGlobal, setPickFromGlobal] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [customTeamName, setCustomTeamName] = useState('');
  const [teamType, setTeamType] = useState('DEFAULT');
  const [selectedChecklists, setSelectedChecklists] = useState<string[]>([]);
  const [isChecklistDropdownOpen, setIsChecklistDropdownOpen] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState('');

  // Step 2 Form State (Image #38)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showAddInlineUser, setShowAddInlineUser] = useState(false);
  const [inlineUserName, setInlineUserName] = useState('');
  const [inlineUserEmail, setInlineUserEmail] = useState('');
  const [inlineUserPhone, setInlineUserPhone] = useState('');
  const [inlineUserRole, setInlineUserRole] = useState('User');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const checklistDropdownRef = useRef<HTMLDivElement>(null);

  // Close on Escape key & backdrop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Click outside for checklist dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (checklistDropdownRef.current && !checklistDropdownRef.current.contains(e.target as Node)) {
        setIsChecklistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available global teams (exclude Main Team and already linked teams)
  const availableTeams = useMemo(() => {
    return allTeams.filter((t) => {
      const nameLower = (t.name || '').trim().toLowerCase();
      // 1. Exclude Main Team
      if (nameLower === 'main team' || nameLower === 'main' || nameLower === 'mainteam') {
        return false;
      }
      // 2. Exclude teams already linked to this project
      if (alreadyLinkedTeamIds.includes(t.id)) {
        return false;
      }
      return true;
    });
  }, [allTeams, alreadyLinkedTeamIds]);

  // Resolve current active team name for Step 2
  const activeTeamName = useMemo(() => {
    if (pickFromGlobal) {
      const found = allTeams.find((t) => t.id === selectedTeamId);
      return found?.name || '';
    }
    return customTeamName.trim();
  }, [pickFromGlobal, selectedTeamId, customTeamName, allTeams]);

  // Filter global users who belong to the selected team (Image #38 requirement)
  const filteredTeamMembers = useMemo(() => {
    if (!activeTeamName) return [];
    const tNameLower = activeTeamName.toLowerCase().trim();
    return allMembers.filter((m) => {
      if (!m.teams) return false;
      const memberTeams = String(m.teams)
        .split(',')
        .map((s) => s.trim().toLowerCase());
      return memberTeams.includes(tNameLower);
    });
  }, [allMembers, activeTeamName]);

  // Checklists to display: When Pick From Global is enabled, show all checklists from global/library
  const availableChecklists = useMemo(() => {
    if (pickFromGlobal) {
      return allChecklists;
    }
    return projectChecklists.length > 0 ? projectChecklists : allChecklists;
  }, [pickFromGlobal, allChecklists, projectChecklists]);

  // Filter checklists based on search
  const filteredChecklists = useMemo(() => {
    if (!checklistSearch.trim()) return availableChecklists;
    const q = checklistSearch.toLowerCase().trim();
    return availableChecklists.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [availableChecklists, checklistSearch]);

  const toggleChecklist = (name: string) => {
    setSelectedChecklists((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const toggleSelectAllChecklists = () => {
    if (selectedChecklists.length === availableChecklists.length && availableChecklists.length > 0) {
      setSelectedChecklists([]);
    } else {
      setSelectedChecklists(availableChecklists.map((c) => c.name));
    }
  };

  // Step 1 Next validation
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pickFromGlobal && !selectedTeamId) {
      setError('Please select a team.');
      return;
    }
    if (!pickFromGlobal && !customTeamName.trim()) {
      setError('Please enter a team name.');
      return;
    }

    setStep(2);
  };

  // Step 2 Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload: any = {
        assigned_checklist: selectedChecklists,
        user_ids: selectedUserIds,
      };

      if (pickFromGlobal) {
        payload.team_id = selectedTeamId;
      } else {
        payload.team_name = customTeamName.trim();
        payload.team_type = teamType;
      }

      if (showAddInlineUser && inlineUserName.trim()) {
        payload.new_user = {
          name: inlineUserName.trim(),
          email: inlineUserEmail.trim(),
          phone: inlineUserPhone.trim(),
          role: inlineUserRole.trim(),
        };
      }

      const res = await fetch(`/api/projects/${projectId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to add team');
      }

      onSaved();
    } catch (err) {
      setError((err as Error).message || 'Failed to add team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-scale-in flex flex-col max-h-[90vh] overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 rounded-t-2xl bg-white dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Team</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="flex items-center justify-between px-8 py-3.5 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 shrink-0">
          {/* Step 1 Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 1
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-emerald-500 text-white'
                }`}
            >
              {step > 1 ? <Check size={13} className="stroke-[3]" /> : '1'}
            </div>
            <span
              className={`text-xs font-bold ${step === 1 ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                }`}
            >
              1 Add Team
            </span>
          </div>

          <div className="flex-1 mx-4 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full" />

          {/* Step 2 Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 2
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
            >
              2
            </div>
            <span
              className={`text-xs font-bold ${step === 2 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
                }`}
            >
              2 Add User
            </span>
          </div>
        </div>

        {/* Modal Form Body */}
        <div className={`p-6 space-y-5 flex-1 ${step === 1 ? 'overflow-visible' : 'overflow-y-auto'}`}>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ══════════════ STEP 1: Add Team (Image #35, #42, #43) ══════════════ */}
          {step === 1 && (
            <form id="step1-form" onSubmit={handleNextStep} className="space-y-4">
              {/* Pick From Global Switch Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <div>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Pick From Global
                  </span>
                  <p className="text-[11px] text-gray-400">
                    {pickFromGlobal
                      ? 'Select an existing team created across the organization'
                      : 'Create a custom team specifically for this project'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pickFromGlobal}
                  onClick={() => {
                    setPickFromGlobal(!pickFromGlobal);
                    setError('');
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${pickFromGlobal ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${pickFromGlobal ? 'translate-x-5' : ''
                      }`}
                  />
                </button>
              </div>

              {/* Team Selector / Creator (Full width) */}
              {pickFromGlobal ? (
                <div className="w-full">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    <span className="text-red-500 mr-1">*</span>Team
                  </label>
                  <select
                    className="input w-full text-sm font-medium"
                    value={selectedTeamId}
                    onChange={(e) => {
                      setSelectedTeamId(e.target.value);
                      setError('');
                    }}
                  >
                    <option value="">Select Team</option>
                    {availableTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.type || 'DEFAULT'})
                      </option>
                    ))}
                  </select>
                  {availableTeams.length === 0 && (
                    <p className="text-[11px] text-amber-500 mt-1">
                      All global teams are already linked or no other teams available. Switch toggle off to create one.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-full">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      <span className="text-red-500 mr-1">*</span>Team Name
                    </label>
                    <select
                      className="input w-full text-sm font-medium"
                      value={selectedTeamId}
                      onChange={(e) => {
                        setSelectedTeamId(e.target.value);
                        setError('');
                      }}
                    >
                      <option value="">Select Team</option>
                      {availableTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.type || 'DEFAULT'})
                        </option>
                      ))}
                    </select>
                    {availableTeams.length === 0 && (
                      <p className="text-[11px] text-amber-500 mt-1">
                        All global teams are already linked or no other teams available. Switch toggle off to create one.
                      </p>
                    )}
                  </div>

                </div>
              )}

              {/* Checklist Multi-Select Dropdown (Searchable with Select All & Floating Overlay) */}
              <div className="relative z-30" ref={checklistDropdownRef}>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Checklist
                </label>
                <button
                  type="button"
                  onClick={() => setIsChecklistDropdownOpen(!isChecklistDropdownOpen)}
                  className="input w-full text-left flex items-center justify-between text-sm py-2 px-3 bg-white dark:bg-gray-800"
                >
                  <span className="truncate text-gray-700 dark:text-gray-200">
                    {selectedChecklists.length === 0
                      ? 'Select Checklist'
                      : `${selectedChecklists.length} Checklist${selectedChecklists.length > 1 ? 's' : ''
                      } selected`}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-gray-400 transition-transform duration-200 ${isChecklistDropdownOpen ? 'rotate-180' : ''
                      }`}
                  />
                </button>

                {/* Floating Dropdown Menu (Overlays cleanly above modal body and footer) */}
                {isChecklistDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in ring-1 ring-black/5">
                    {/* Search inside Dropdown */}
                    <div className="p-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search checklist…"
                          className="w-full text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-red-400"
                          value={checklistSearch}
                          onChange={(e) => setChecklistSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Select All */}
                    {availableChecklists.length > 0 && (
                      <div
                        onClick={toggleSelectAllChecklists}
                        className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedChecklists.length > 0 &&
                            selectedChecklists.length === availableChecklists.length
                          }
                          onChange={() => { }}
                          className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                        />
                        <span>Select All ({availableChecklists.length})</span>
                      </div>
                    )}

                    {/* Checklist items list */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                      {filteredChecklists.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">
                          {availableChecklists.length === 0
                            ? 'No checklists found.'
                            : 'No matching checklists found.'}
                        </div>
                      ) : (
                        filteredChecklists.map((c) => {
                          const isChecked = selectedChecklists.includes(c.name);
                          return (
                            <div
                              key={c.id}
                              onClick={() => toggleChecklist(c.name)}
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer text-xs transition-colors ${isChecked ? 'bg-red-50/60 dark:bg-red-500/10' : ''
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => { }}
                                className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                              />
                              <span className="text-gray-800 dark:text-gray-200 font-medium truncate">
                                {c.name}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* ══════════════ STEP 2: Add User (Image #38) ══════════════ */}
          {step === 2 && (
            <form id="step2-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-xs text-blue-800 dark:text-blue-300">
                <p className="font-semibold">
                  Selected Team: <span className="font-bold text-gray-900 dark:text-white">{activeTeamName}</span>
                </p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                  Only global users belonging to &quot;{activeTeamName}&quot; are listed below.
                </p>
              </div>

              {/* Select Global User Dropdown (Image #38) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  <span className="text-red-500 mr-1">*</span>Select Global User
                </label>
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-2 bg-white dark:bg-gray-800/60 max-h-48 overflow-y-auto space-y-1">
                  {filteredTeamMembers.length === 0 ? (
                    <div className="py-3 px-2 text-center text-xs text-gray-400">
                      <p className="font-medium text-gray-500 dark:text-gray-400">
                        No global users found for team &quot;{activeTeamName}&quot;.
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Use the form below to create a new user for this team.
                      </p>
                    </div>
                  ) : (
                    filteredTeamMembers.map((m) => {
                      const isChecked = selectedUserIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isChecked
                            ? 'bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedUserIds((prev) =>
                                  prev.includes(m.id)
                                    ? prev.filter((id) => id !== m.id)
                                    : [...prev, m.id]
                                );
                              }}
                              className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                            />
                            <div>
                              <div className="text-xs font-bold text-gray-900 dark:text-white">
                                {m.name}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {m.email || m.phone || 'No contact'} • {m.default_role || 'User'}
                              </div>
                            </div>
                          </div>
                          {isChecked && (
                            <Check size={14} className="text-red-500 stroke-[2.5]" />
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Inline User Creation Section (Optional) */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddInlineUser(!showAddInlineUser)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                >
                  <Plus size={14} />
                  <span>{showAddInlineUser ? 'Hide Create User' : '+ Add / Create New User'}</span>
                </button>

                {showAddInlineUser && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 space-y-3 animate-fade-in">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Create New Member for &quot;{activeTeamName}&quot;
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input text-xs py-1.5"
                          placeholder="Full Name"
                          value={inlineUserName}
                          onChange={(e) => setInlineUserName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          className="input text-xs py-1.5"
                          placeholder="user@example.com"
                          value={inlineUserEmail}
                          onChange={(e) => setInlineUserEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Phone
                        </label>
                        <input
                          className="input text-xs py-1.5"
                          placeholder="+91 9876543210"
                          value={inlineUserPhone}
                          onChange={(e) => setInlineUserPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Role
                        </label>
                        <select
                          className="input text-xs py-1.5"
                          value={inlineUserRole}
                          onChange={(e) => setInlineUserRole(e.target.value)}
                        >
                          <option value="User">User</option>
                          <option value="Inspector">Inspector</option>
                          <option value="Auditor">Auditor</option>
                          <option value="Associate">Associate</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between gap-3 p-4 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850 shrink-0">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 justify-center text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="step1-form"
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-sm flex-1 transition-all"
              >
                <span>Next</span>
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1 justify-center text-xs flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="submit"
                form="step2-form"
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-sm flex-1 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} className="stroke-[3]" />
                )}
                <span>{saving ? 'Adding…' : 'Add Team'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Edit Team Modal
// ============================================================================
function EditTeamModal({
  projectId,
  teamRow,
  allMembers,
  projectChecklists,
  allChecklists,
  onClose,
  onSaved,
}: {
  projectId: string;
  teamRow: ProjectTeamRow;
  allMembers: Member[];
  projectChecklists: Checklist[];
  allChecklists: Checklist[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [teamType, setTeamType] = useState(teamRow.team_type || 'DEFAULT');
  const [selectedChecklists, setSelectedChecklists] = useState<string[]>(() => {
    return (teamRow.assigned_checklist || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  });
  const [isChecklistDropdownOpen, setIsChecklistDropdownOpen] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState('');

  // Selected Users
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const checklistDropdownRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Click outside for checklist dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (checklistDropdownRef.current && !checklistDropdownRef.current.contains(e.target as Node)) {
        setIsChecklistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter global users belonging to this team
  const teamMembers = useMemo(() => {
    const tNameLower = (teamRow.team_name || '').toLowerCase().trim();
    return allMembers.filter((m) => {
      if (!m.teams) return false;
      const memberTeams = String(m.teams)
        .split(',')
        .map((s) => s.trim().toLowerCase());
      return memberTeams.includes(tNameLower);
    });
  }, [allMembers, teamRow.team_name]);

  // Available checklists
  const availableChecklists = useMemo(() => {
    return allChecklists.length > 0 ? allChecklists : projectChecklists;
  }, [allChecklists, projectChecklists]);

  // Filter checklists
  const filteredChecklists = useMemo(() => {
    if (!checklistSearch.trim()) return availableChecklists;
    const q = checklistSearch.toLowerCase().trim();
    return availableChecklists.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [availableChecklists, checklistSearch]);

  const toggleChecklist = (name: string) => {
    setSelectedChecklists((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const toggleSelectAllChecklists = () => {
    if (selectedChecklists.length === availableChecklists.length && availableChecklists.length > 0) {
      setSelectedChecklists([]);
    } else {
      setSelectedChecklists(availableChecklists.map((c) => c.name));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/teams?team_id=${teamRow.team_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_type: teamType,
          assigned_checklist: selectedChecklists.join(', '),
          user_ids: selectedUserIds,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update team');
      }

      onSaved();
    } catch (err) {
      setError((err as Error).message || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-scale-in flex flex-col max-h-[90vh] overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 rounded-t-2xl bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Team</h2>
            <p className="text-xs text-gray-400">{teamRow.team_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-visible space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Team Name (Disabled) */}
          <div className="w-full">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Team Name
            </label>
            <input
              disabled
              className="input w-full text-sm bg-gray-100 dark:bg-gray-800/80 cursor-not-allowed opacity-80"
              value={teamRow.team_name}
            />
          </div>

          {/* Team Type */}
          <div className="w-full">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Team Type
            </label>
            <select
              className="input w-full text-sm font-medium"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
            >
              <option value="DEFAULT">DEFAULT</option>
              <option value="CONTRACTOR">CONTRACTOR</option>
              <option value="INSPECTION">INSPECTION</option>
              <option value="CLIENT">CLIENT</option>
              <option value="CONSULTANT">CONSULTANT</option>
            </select>
          </div>

          {/* Checklist Multi-Select Dropdown */}
          <div className="relative z-30" ref={checklistDropdownRef}>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Assigned Checklists
            </label>
            <button
              type="button"
              onClick={() => setIsChecklistDropdownOpen(!isChecklistDropdownOpen)}
              className="input w-full text-left flex items-center justify-between text-sm py-2 px-3 bg-white dark:bg-gray-800"
            >
              <span className="truncate text-gray-700 dark:text-gray-200">
                {selectedChecklists.length === 0
                  ? 'Select Checklist'
                  : `${selectedChecklists.length} Checklist${selectedChecklists.length > 1 ? 's' : ''
                  } selected`}
              </span>
              <ChevronDown
                size={15}
                className={`text-gray-400 transition-transform duration-200 ${isChecklistDropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isChecklistDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in ring-1 ring-black/5">
                <div className="p-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search checklist…"
                      className="w-full text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-red-400"
                      value={checklistSearch}
                      onChange={(e) => setChecklistSearch(e.target.value)}
                    />
                  </div>
                </div>

                {availableChecklists.length > 0 && (
                  <div
                    onClick={toggleSelectAllChecklists}
                    className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={
                        selectedChecklists.length > 0 &&
                        selectedChecklists.length === availableChecklists.length
                      }
                      onChange={() => { }}
                      className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                    />
                    <span>Select All ({availableChecklists.length})</span>
                  </div>
                )}

                <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
                  {filteredChecklists.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      No matching checklists found.
                    </div>
                  ) : (
                    filteredChecklists.map((c) => {
                      const isChecked = selectedChecklists.includes(c.name);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleChecklist(c.name)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer text-xs transition-colors ${isChecked ? 'bg-red-50/60 dark:bg-red-500/10' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => { }}
                            className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                          />
                          <span className="text-gray-800 dark:text-gray-200 font-medium truncate">
                            {c.name}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Currently Assigned Users & Add more */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Assigned Team Members
            </label>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 bg-gray-50/50 dark:bg-gray-800/40 max-h-44 overflow-y-auto space-y-1.5">
              {teamMembers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">
                  No global members currently have &quot;{teamRow.team_name}&quot; assigned in the members roster.
                </p>
              ) : (
                teamMembers.map((m) => {
                  const isChecked = selectedUserIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isChecked
                        ? 'bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedUserIds((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id]
                            );
                          }}
                          className="rounded text-red-500 focus:ring-red-400 h-4 w-4 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {m.email || m.phone || 'No contact'}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0 rounded-b-2xl relative z-10">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-sm flex-1 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{saving ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
