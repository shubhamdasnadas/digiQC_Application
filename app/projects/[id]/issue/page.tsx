'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus,
  X,
  Loader2,
  Search,
  Camera,
  Download,
  Folder,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ArrowUpDown,
  CheckCircle2,
  MessageSquare,
  Save,
} from 'lucide-react';
import type { Issue, ProjectMember, NomenclatureTask, IssueResponse } from '@/lib/types';
import { useProject } from '@/context/ProjectContext';

const ISSUE_TYPES = [
  'General',
  'Quality',
  'Safety',
  'Execution',
  'Design',
  'Environmental',
  'Material',
  'Other',
];

/**
 * Format timestamp into "DD/MM/YYYY | h:mm a" (matching Image #5 & #7)
 * e.g. "02/10/2026 | 4:05 pm"
 */
function formatDatePipe(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${dd}/${mm}/${yyyy} | ${hours}:${minutes} ${ampm}`;
}

/**
 * Format timestamp into "DD/MM/YYYY (h:mm a)" (matching Image #6 Summary Deadline & Response)
 * e.g. "02/10/2026 (4:05 pm)"
 */
function formatDateParen(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${dd}/${mm}/${yyyy} (${hours}:${minutes} ${ampm})`;
}

/**
 * Convert Date to YYYY-MM-DDTHH:mm format for datetime-local input
 */
function toDateTimeLocalString(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function IssueTab() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [nomenclature, setNomenclature] = useState<NomenclatureTask[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
      } else if (e.key === 'ArrowLeft') {
        setLightbox((prev) =>
          prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null
        );
      } else if (e.key === 'ArrowRight') {
        setLightbox((prev) =>
          prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  // Filters state (matching Image #5 & #7)
  const [isOverdueFilter, setIsOverdueFilter] = useState(false);
  const [filterUser, setFilterUser] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<'location' | 'type' | 'due_date' | 'last_action_date'>('last_action_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const [issuesRes, membersRes, nomRes, meRes] = await Promise.all([
        fetch(`/api/projects/${id}/issues`, { cache: 'no-store' }),
        fetch(`/api/projects/${id}/members`, { cache: 'no-store' }),
        fetch(`/api/projects/${id}/nomenclature`, { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ]);

      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        if (Array.isArray(issuesData)) {
          setIssues(issuesData);
          if (selectedIssue) {
            const updated = issuesData.find((i: Issue) => i.id === selectedIssue.id);
            if (updated) setSelectedIssue(updated);
          }
        }
      }

      let projectMembers: ProjectMember[] = [];
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        projectMembers = Array.isArray(membersData) ? membersData : [];
      }
      if (projectMembers.length === 0) {
        try {
          const orgMemRes = await fetch('/api/members', { cache: 'no-store' });
          if (orgMemRes.ok) {
            const orgMembers = await orgMemRes.json();
            if (Array.isArray(orgMembers)) {
              projectMembers = orgMembers.map((m: any) => ({
                id: m.id,
                project_id: id,
                user_id: m.id,
                user_name: m.name,
                user_email: m.email,
                user_teams: m.teams || '',
                role: m.role || 'member',
                added_at: m.created_at || new Date().toISOString(),
              }));
            }
          }
        } catch {}
      }
      setMembers(projectMembers);

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        setNomenclature(Array.isArray(nomData) ? nomData : []);
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.user) setCurrentUser(meData.user);
      }
    } catch (err) {
      console.error('Failed to load issues data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Unique dropdown options
  const distinctUsers = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      if (m.user_name) map.set(m.user_name, m.user_name);
    });
    issues.forEach((i) => {
      if (i.assignee_name) map.set(i.assignee_name, i.assignee_name);
      if (i.reported_by_name) map.set(i.reported_by_name, i.reported_by_name);
    });
    return Array.from(map.values());
  }, [members, issues]);

  const distinctTeams = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.user_teams) {
        m.user_teams.split(',').forEach((t) => set.add(t.trim()));
      }
    });
    issues.forEach((i) => {
      if (i.assigned_team) set.add(i.assigned_team.trim());
      if (i.reported_by_team) set.add(i.reported_by_team.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [members, issues]);

  const distinctTags = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => {
      if (i.tags && i.tags !== '-') set.add(i.tags.trim());
    });
    return Array.from(set);
  }, [issues]);

  const handleSort = (field: 'location' | 'type' | 'due_date' | 'last_action_date') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtered and sorted issues
  const filteredIssues = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const now = new Date();

    return issues
      .filter((i) => {
        // Overdue filter
        if (isOverdueFilter) {
          if (!i.due_date) return false;
          const d = new Date(i.due_date);
          if (isNaN(d.getTime()) || d >= now || i.status === 'closed' || i.status === 'resolved') {
            return false;
          }
        }
        // User filter
        if (filterUser !== 'all') {
          const matchAssignee = i.assignee_name?.toLowerCase() === filterUser.toLowerCase();
          const matchReporter = i.reported_by_name?.toLowerCase() === filterUser.toLowerCase();
          if (!matchAssignee && !matchReporter) return false;
        }
        // Team filter
        if (filterTeam !== 'all') {
          const matchTeam =
            i.assigned_team?.toLowerCase().includes(filterTeam.toLowerCase()) ||
            i.reported_by_team?.toLowerCase().includes(filterTeam.toLowerCase());
          if (!matchTeam) return false;
        }
        // Type filter
        if (filterType !== 'all') {
          if ((i.issue_type || 'General').toLowerCase() !== filterType.toLowerCase()) return false;
        }
        // Tag filter
        if (filterTag !== 'all') {
          if ((i.tags || '').toLowerCase() !== filterTag.toLowerCase()) return false;
        }
        // Status filter
        if (filterStatus !== 'all') {
          if ((i.status || 'open').toLowerCase() !== filterStatus.toLowerCase()) return false;
        }
        // Search text
        if (q) {
          const loc = (i.location || '').toLowerCase();
          const type = (i.issue_type || '').toLowerCase();
          const desc = (i.description || '').toLowerCase();
          const assignee = (i.assignee_name || '').toLowerCase();
          const reporter = (i.reported_by_name || '').toLowerCase();
          const lastBy = (i.last_action_by || '').toLowerCase();
          const team = (i.assigned_team || '').toLowerCase();
          return (
            loc.includes(q) ||
            type.includes(q) ||
            desc.includes(q) ||
            assignee.includes(q) ||
            reporter.includes(q) ||
            lastBy.includes(q) ||
            team.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA = '';
        let valB = '';
        if (sortField === 'location') {
          valA = a.location || '';
          valB = b.location || '';
        } else if (sortField === 'type') {
          valA = a.issue_type || 'General';
          valB = b.issue_type || 'General';
        } else if (sortField === 'due_date') {
          valA = a.due_date || '';
          valB = b.due_date || '';
        } else if (sortField === 'last_action_date') {
          valA = a.last_action_date || a.created_at || '';
          valB = b.last_action_date || b.created_at || '';
        }
        const cmp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [
    issues,
    isOverdueFilter,
    filterUser,
    filterTeam,
    filterType,
    filterTag,
    filterStatus,
    search,
    sortField,
    sortOrder,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, currentPage, pageSize]);

  // Status pill helper
  const renderStatusPill = (status: string) => {
    const s = (status || 'open').toLowerCase();
    if (s === 'closed') {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e8f7ee] text-[#1ea354] border border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          Closed
        </span>
      );
    }
    if (s === 'resolved') {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e9f3fd] text-[#1d68bd] border border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
          Resolved
        </span>
      );
    }
    if (s === 'in_progress') {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fef7e6] text-[#b47814] border border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fdeeed] text-[#d33b3b] border border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
        Open
      </span>
    );
  };

  // Close Issue handler
  const handleCloseIssue = async (closingDescription: string, closingPhotosInput: string | string[]) => {
    if (!selectedIssue) return;
    const closerName = currentUser?.name || 'Deepesh Dhavan';
    const closerTeam = members.find((m) => m.user_id === currentUser?.id)?.user_teams || 'Main Team';
    const nowIso = new Date().toISOString();
    const photosArr = Array.isArray(closingPhotosInput)
      ? closingPhotosInput.filter(Boolean)
      : closingPhotosInput
      ? [closingPhotosInput]
      : [];

    const payload = {
      id: selectedIssue.id,
      status: 'closed',
      closed_by: currentUser?.id || null,
      closed_by_name: closerName,
      closed_by_team: closerTeam,
      closed_at: nowIso,
      closed_description: closingDescription,
      closed_photos: photosArr,
      last_action_by: closerName,
      last_action_date: nowIso,
    };

    try {
      const res = await fetch(`/api/projects/${id}/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedIssue: Issue = {
          ...selectedIssue,
          status: 'closed',
          closed_by_name: closerName,
          closed_by_team: closerTeam,
          closed_at: nowIso,
          closed_description: closingDescription,
          closed_photos: photosArr,
          last_action_by: closerName,
          last_action_date: nowIso,
        };
        setSelectedIssue(updatedIssue);
        setIssues((prev) => prev.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)));
        setShowCloseModal(false);
      }
    } catch (e) {
      console.error('Failed to close issue:', e);
    }
  };

  // Add Response handler
  const handleAddResponse = async (responseDesc: string, photosInput: string | string[]) => {
    if (!selectedIssue) return;
    const responderName = currentUser?.name || 'Admin User';
    const responderTeam = members.find((m) => m.user_id === currentUser?.id)?.user_teams || 'Phone Contact';
    const nowIso = new Date().toISOString();
    const photosArr = Array.isArray(photosInput)
      ? photosInput.filter(Boolean)
      : photosInput
      ? [photosInput]
      : [];

    const newResponse: IssueResponse = {
      id: 'resp-' + Date.now(),
      user_name: responderName,
      user_team: responderTeam,
      date: nowIso,
      description: responseDesc,
      photos: photosArr,
    };

    // Parse existing responses
    let existingList: IssueResponse[] = [];
    if (Array.isArray(selectedIssue.responses) && selectedIssue.responses.length > 0) {
      existingList = [...selectedIssue.responses];
    } else if (typeof selectedIssue.responses === 'string') {
      try {
        const parsed = JSON.parse(selectedIssue.responses);
        if (Array.isArray(parsed) && parsed.length > 0) existingList = parsed;
      } catch {}
    }

    // Preserve initial single response if responses array was empty
    if (existingList.length === 0 && selectedIssue.response_description) {
      existingList = [
        {
          id: 'resp-prev',
          user_name: selectedIssue.responded_by_name || selectedIssue.assignee_name || 'Admin User',
          user_team: selectedIssue.responded_by_team || selectedIssue.assigned_team || 'Phone Contact',
          date: selectedIssue.responded_at || selectedIssue.updated_at || selectedIssue.created_at || nowIso,
          description: selectedIssue.response_description,
          photos: selectedIssue.response_photos || (selectedIssue.image_url ? [selectedIssue.image_url] : []),
        },
      ];
    }

    const updatedResponses = [newResponse, ...existingList];

    const payload = {
      id: selectedIssue.id,
      responded_by_name: responderName,
      responded_by_team: responderTeam,
      responded_at: nowIso,
      response_description: responseDesc,
      response_photos: photosArr,
      responses: updatedResponses,
      last_action_by: responderName,
      last_action_date: nowIso,
    };

    try {
      const res = await fetch(`/api/projects/${id}/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedIssue: Issue = {
          ...selectedIssue,
          responded_by_name: responderName,
          responded_by_team: responderTeam,
          responded_at: nowIso,
          response_description: responseDesc,
          response_photos: photosArr,
          responses: updatedResponses,
          last_action_by: responderName,
          last_action_date: nowIso,
        };
        setSelectedIssue(updatedIssue);
        setIssues((prev) => prev.map((i) => (i.id === updatedIssue.id ? updatedIssue : i)));
        setShowResponseModal(false);
      }
    } catch (e) {
      console.error('Failed to add response:', e);
    }
  };

  // Delete Issue handler
  const handleIssueDeleted = (deletedId: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== deletedId));
    if (selectedIssue?.id === deletedId) {
      setSelectedIssue(null);
    }
    setIssueToDelete(null);
  };

  // Print / Download Report
  const handleDownloadReport = (issueToPrint: Issue | null) => {
    const issue = issueToPrint || selectedIssue;
    if (!issue) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const pName = project?.name || 'Techsec';
    const issuePhotos = issue.photos && issue.photos.length > 0
      ? issue.photos
      : issue.image_urls && issue.image_urls.length > 0
      ? issue.image_urls
      : issue.image_url
      ? [issue.image_url]
      : [];

    const closedPhotos = Array.isArray(issue.closed_photos)
      ? issue.closed_photos
      : typeof issue.closed_photos === 'string' && issue.closed_photos
      ? [issue.closed_photos]
      : [];

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>digiQC Issue Report - ${issue.location || 'Issue'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 30px; font-size: 13px; line-height: 1.5; }
          .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 20px; font-weight: 700; color: #111827; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
          .badge-closed { background: #e8f7ee; color: #1ea354; }
          .badge-open { background: #fdeeed; color: #d33b3b; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
          .label { font-size: 11px; color: #6b7280; font-weight: 500; margin-bottom: 4px; }
          .val { font-size: 13px; font-weight: 600; color: #111827; }
          .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
          .card-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #111827; }
          .row { display: flex; gap: 20px; }
          .col-half { flex: 1; }
          .photo { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
          @media print { body { margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${pName} - Issue Report</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Location: <strong>${issue.location || '-'}</strong> | Type: <strong>${issue.issue_type || issue.tag || 'General'}</strong></div>
          </div>
          <span class="badge ${issue.status === 'closed' ? 'badge-closed' : 'badge-open'}">${issue.status.toUpperCase()}</span>
        </div>

        <div class="card">
          <div class="card-title">Summary</div>
          <div class="grid">
            <div>
              <div class="label">Location</div>
              <div class="val">${issue.location || '-'}</div>
              <div class="label" style="margin-top:12px;">Raised By</div>
              <div class="val">${issue.reported_by_name || '-'} ${issue.reported_by_team ? `[${issue.reported_by_team}]` : ''}</div>
              <div style="font-size:11px; color:#6b7280;">${formatDatePipe(issue.created_at)}</div>
              <div class="label" style="margin-top:12px;">Tags</div>
              <div class="val">${issue.tags || '-'}</div>
            </div>
            <div>
              <div class="label">Type</div>
              <div class="val">${issue.issue_type || issue.tag || 'General'}</div>
              <div class="label" style="margin-top:12px;">Responded By</div>
              <div class="val">${issue.responded_by_name || '-'} ${issue.responded_by_team ? `[${issue.responded_by_team}]` : ''}</div>
              <div style="font-size:11px; color:#6b7280;">${formatDatePipe(issue.responded_at || issue.updated_at)}</div>
              <div class="label" style="margin-top:12px;">Rejections</div>
              <div class="val">${issue.rejections || 'R0'}</div>
            </div>
            <div>
              <div class="label">Assigned User</div>
              <div class="val">${issue.assignee_name || '-'} ${issue.assigned_team ? `[${issue.assigned_team}]` : ''}</div>
              <div class="label" style="margin-top:12px;">Closed By</div>
              <div class="val">${issue.closed_by_name || '-'} ${issue.closed_by_team ? `[${issue.closed_by_team}]` : ''}</div>
              <div style="font-size:11px; color:#6b7280;">${formatDatePipe(issue.closed_at)}</div>
            </div>
            <div>
              <div class="label">Deadline</div>
              <div class="val">${formatDateParen(issue.due_date)}</div>
              <div class="label" style="margin-top:12px;">Geo Tag</div>
              <div class="val">${issue.geo_tag || '-'}</div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="card col-half">
            <div class="card-title">Issue Details</div>
            <div class="label">Description</div>
            <p style="margin: 4px 0 16px 0;">${issue.description || '-'}</p>
            ${issuePhotos.length > 0 ? `
              <div>
                <div class="label">Photos (${issuePhotos.length})</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
                  ${issuePhotos.map((p: string) => `<img src="${p}" class="photo" />`).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="card col-half">
            <div class="card-title">Closed Details</div>
            <div class="label">Description</div>
            <p style="margin: 4px 0 16px 0;">${issue.closed_description || (issue.status === 'closed' ? 'Closed and verified' : 'Open')}</p>
            ${closedPhotos.length > 0 ? `
              <div>
                <div class="label">Photos (${closedPhotos.length})</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
                  ${closedPhotos.map((p: string) => `<img src="${p}" class="photo" />`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-title">Response Details (${
            Array.isArray(issue.responses) && issue.responses.length > 0 ? issue.responses.length : (issue.response_description ? 1 : 0)
          })</div>
          ${(() => {
            let resps: any[] = [];
            if (Array.isArray(issue.responses) && issue.responses.length > 0) {
              resps = issue.responses;
            } else if (issue.response_description) {
              resps = [{
                user_name: issue.responded_by_name || issue.assignee_name || 'Responder',
                user_team: issue.responded_by_team || issue.assigned_team || 'Team',
                date: issue.responded_at || issue.created_at,
                description: issue.response_description,
                photos: issue.response_photos || (issue.image_url ? [issue.image_url] : []),
              }];
            }
            if (resps.length === 0) return '<p style="color:#6b7280; font-size:12px;">No responses recorded.</p>';
            return resps.map((r, i) => `
              <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: ${i < resps.length - 1 ? '1px solid #e5e7eb' : 'none'};">
                <div style="font-weight:600; margin-bottom:4px; font-size:12px;">
                  ${i + 1}. ${r.user_name || 'Responder'} ${r.user_team ? `[${r.user_team}]` : ''} - ${formatDateParen(r.date)}
                </div>
                <div class="label">Description</div>
                <p style="margin: 3px 0 10px 0; font-size: 12px;">${r.description || '-'}</p>
                ${r.photos && r.photos.length > 0 ? `
                  <div style="margin-top:6px;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                      ${r.photos.map((p: string) => `<img src="${p}" class="photo" />`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `).join('');
          })()}
        </div>
      </body>
      </html>
    `;
    printWindow.document.documentElement.innerHTML = html;
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // MAIN ISSUE TABLE VIEW (Image #5 & #7)
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-4 pb-12">
      {/* Top Header & Filters Bar (Matching Image #5 & #7) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Title and Issue Count */}
        <div className="flex flex-col text-left">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Issue Details</h2>
          <p className="text-xs text-gray-500">
            {filteredIssues.length} {filteredIssues.length === 1 ? 'Issue' : 'Issues'}
          </p>
        </div>

        {/* Filter Bar with rounded pills (Matching Image #5 & #7) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Overdue Button */}
          <button
            onClick={() => {
              setIsOverdueFilter(!isOverdueFilter);
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isOverdueFilter
                ? 'bg-rose-50 border-rose-500 text-rose-600 font-semibold dark:bg-rose-500/10 dark:text-rose-400'
                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
            }`}
          >
            Overdue
          </button>

          {/* User Select */}
          <div className="relative">
            <select
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all">User</option>
              {distinctUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Assigned Team Select */}
          <div className="relative">
            <select
              value={filterTeam}
              onChange={(e) => {
                setFilterTeam(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Assigned Team</option>
              {distinctTeams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Type Select */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Type</option>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Tag Select */}
          <div className="relative">
            <select
              value={filterTag}
              onChange={(e) => {
                setFilterTag(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Tag</option>
              {distinctTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Status Select */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Search Pill Input with Red Icon (Matching Image #5 & #7) */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-rose-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 w-36 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Table (Matching Image #5 & #7) */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[120px] text-center">PHOTOS</th>
                <th
                  onClick={() => handleSort('location')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>LOCATION</span>
                    <ArrowUpDown size={11} className="text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('type')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>TYPE</span>
                    <ArrowUpDown size={11} className="text-gray-400" />
                  </div>
                </th>
                <th className="py-3 px-4">TAGS</th>
                <th
                  onClick={() => handleSort('due_date')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>DEADLINE</span>
                    <ArrowUpDown size={11} className="text-gray-400" />
                  </div>
                </th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">ASSIGNED TEAM</th>
                <th className="py-3 px-4">LAST ACTION BY</th>
                <th
                  onClick={() => handleSort('last_action_date')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>LAST ACTION DATE</span>
                    <ArrowUpDown size={11} className="text-gray-400" />
                  </div>
                </th>
                <th className="py-3 px-3 w-20 text-center"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={11} className="py-4 px-4 text-center">
                      <div className="skeleton h-8 rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : paginatedIssues.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400 text-xs">
                    {issues.length === 0
                      ? 'No issues recorded yet for this project. Click "+" below to report an issue.'
                      : 'No issues match the selected filters.'}
                  </td>
                </tr>
              ) : (
                paginatedIssues.map((issue, idx) => {
                  const itemIndex = (currentPage - 1) * pageSize + idx + 1;
                  const issuePhotos = issue.photos && issue.photos.length > 0
                    ? issue.photos
                    : issue.image_urls && issue.image_urls.length > 0
                    ? issue.image_urls
                    : issue.image_url
                    ? [issue.image_url]
                    : [];

                  return (
                    <tr
                      key={issue.id}
                      onClick={() => setSelectedIssue(issue)}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      {/* # */}
                      <td className="py-3 px-3 text-center text-gray-500 font-mono text-xs">
                        {itemIndex}
                      </td>

                      {/* PHOTOS */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {issuePhotos.length > 0 ? (
                          <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            {issuePhotos.slice(0, 3).map((photoUrl, pIdx) => (
                              <div
                                key={pIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightbox({ images: issuePhotos, index: pIdx });
                                }}
                                className="relative inline-flex items-center justify-center cursor-pointer group flex-shrink-0"
                                title={`Photo ${pIdx + 1} of ${issuePhotos.length} - Click to enlarge`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photoUrl}
                                  alt={`Photo ${pIdx + 1}`}
                                  className="w-8 h-8 object-cover rounded-md border border-gray-200 dark:border-gray-700 group-hover:scale-110 group-hover:border-rose-500 transition-all shadow-xs"
                                />
                                {issuePhotos.length > 1 && (
                                  <span className="absolute bottom-0 right-0 bg-black/75 text-white text-[8px] font-bold px-0.5 rounded-tl leading-none">
                                    #{pIdx + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                            {issuePhotos.length > 3 && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightbox({ images: issuePhotos, index: 3 });
                                }}
                                className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                                title={`Click to view ${issuePhotos.length - 3} more photos`}
                              >
                                +{issuePhotos.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {issue.location || '-'}
                      </td>

                      {/* Type / Tag */}
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {issue.tag || issue.issue_type || 'General'}
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {issue.tags || '-'}
                      </td>

                      {/* Deadline */}
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDatePipe(issue.due_date)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusPill(issue.status)}
                      </td>

                      {/* Assigned Team & Phone */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-gray-900 dark:text-white font-medium">
                            {issue.assigned_team || '-'}
                          </span>
                          {issue.assigned_team_phone && (
                            <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                              {issue.assigned_team_phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Action By */}
                      <td className="py-3 px-4 text-gray-800 dark:text-gray-200 whitespace-nowrap font-medium">
                        {issue.last_action_by || issue.reported_by_name || '-'}
                      </td>

                      {/* Last Action Date */}
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDatePipe(issue.last_action_date || issue.created_at)}
                      </td>

                      {/* Action Icons: Circular edit pencil + Circular trash delete */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIssue(issue);
                            }}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            title="View / Edit Issue Details"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIssueToDelete(issue);
                            }}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-rose-50 dark:bg-gray-800 dark:hover:bg-rose-950/40 flex items-center justify-center text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                            title="Delete Issue"
                          >
                            <Trash2 size={12} />
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
      </div>

      {/* Pagination Bar (Matching Image #5 & #7) */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {Array.from({ length: totalPages }).map((_, i) => {
          const pageNum = i + 1;
          const isActive = currentPage === pageNum;
          return (
            <button
              key={pageNum}
              onClick={() => setCurrentPage(pageNum)}
              className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                isActive
                  ? 'border border-rose-500 text-rose-600 bg-rose-50/40 dark:bg-rose-500/10'
                  : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="w-8 h-8 rounded border border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight size={14} />
        </button>

        {/* Page size dropdown */}
        <div className="relative ml-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="appearance-none pl-3 pr-7 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Floating Add Issue Button */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-8 right-8 btn-primary rounded-full p-3.5 shadow-xl z-20 hover:scale-105 active:scale-95 transition-all"
        title="Report Issue"
      >
        <Plus size={22} />
      </button>

      {/* Pop-up Modal to Show Detail / Edit (Requested in Image #7) */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          projectId={id}
          projectName={project?.name || 'Techsec'}
          members={members}
          nomenclature={nomenclature}
          currentUser={currentUser}
          renderStatusPill={renderStatusPill}
          onClose={() => setSelectedIssue(null)}
          onUpdated={(updated) => {
            setSelectedIssue(updated);
            setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
          onDeleteIssue={() => setIssueToDelete(selectedIssue)}
          onDownloadReport={() => handleDownloadReport(selectedIssue)}
          onOpenCloseModal={() => setShowCloseModal(true)}
          onOpenResponseModal={() => setShowResponseModal(true)}
          onEnlargePhoto={(url, allPhotos, idx) => {
            if (allPhotos && allPhotos.length > 0) {
              setLightbox({
                images: allPhotos,
                index: idx !== undefined ? idx : Math.max(0, allPhotos.indexOf(url)),
              });
            } else {
              setLightbox({ images: [url], index: 0 });
            }
          }}
        />
      )}

      {/* Report Issue Modal */}
      {showAdd && (
        <AddIssueModal
          projectId={id}
          projectName={project?.name || 'Techsec'}
          members={members}
          nomenclature={nomenclature}
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onSaved={(newIssue) => {
            setShowAdd(false);
            setIsOverdueFilter(false);
            setSearch('');
            if (newIssue) {
              setIssues((prev) => [newIssue, ...prev.filter((i) => i.id !== newIssue.id)]);
            }
            load();
          }}
        />
      )}

      {/* Modal: Close Issue */}
      {showCloseModal && (
        <CloseIssueModal
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleCloseIssue}
        />
      )}

      {/* Modal: Add Response */}
      {showResponseModal && (
        <AddResponseModal
          onClose={() => setShowResponseModal(false)}
          onConfirm={handleAddResponse}
        />
      )}

      {/* Modal: Delete Issue Confirmation */}
      {issueToDelete && (
        <DeleteIssueModal
          issue={issueToDelete}
          projectId={id}
          onClose={() => setIssueToDelete(null)}
          onDeleted={handleIssueDeleted}
        />
      )}

      {/* Enlarge Image Lightbox with Multi-Image Support */}
      {lightbox && lightbox.images.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in select-none"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] w-full flex flex-col items-center justify-center p-4 bg-white/95 dark:bg-gray-900/95 border border-white/20 dark:border-gray-800 rounded-2xl shadow-2xl backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Counter & Close */}
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-gray-800 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Photo {lightbox.index + 1} of {lightbox.images.length}
              </span>
              <button
                onClick={() => setLightbox(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                title="Close (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Main Image Display Area with Prev/Next buttons */}
            <div className="relative w-full flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden">
              {lightbox.images.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev
                        ? {
                            ...prev,
                            index: (prev.index - 1 + prev.images.length) % prev.images.length,
                          }
                        : null
                    )
                  }
                  className="absolute left-2 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                  title="Previous photo (Left Arrow)"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.images[lightbox.index]}
                alt={`Photo ${lightbox.index + 1}`}
                className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
              />

              {lightbox.images.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev
                        ? {
                            ...prev,
                            index: (prev.index + 1) % prev.images.length,
                          }
                        : null
                    )
                  }
                  className="absolute right-2 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
                  title="Next photo (Right Arrow)"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Bottom Thumbnail Strip (if multiple photos) */}
            {lightbox.images.length > 1 && (
              <div className="w-full flex items-center justify-center gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-gray-800 overflow-x-auto max-w-full py-1">
                {lightbox.images.map((imgUrl, thumbIdx) => (
                  <button
                    key={thumbIdx}
                    type="button"
                    onClick={() => setLightbox((prev) => (prev ? { ...prev, index: thumbIdx } : null))}
                    className={`relative rounded-md overflow-hidden transition-all flex-shrink-0 ${
                      thumbIdx === lightbox.index
                        ? 'ring-2 ring-rose-500 scale-105'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={`Thumbnail ${thumbIdx + 1}`} className="w-12 h-12 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pop-up Modal to Show Detail / Edit (Requested in Image #7 & Image #6)
// ─────────────────────────────────────────────────────────────────────────────
function IssueDetailModal({
  issue,
  projectId,
  projectName,
  members,
  nomenclature,
  currentUser,
  renderStatusPill,
  onClose,
  onUpdated,
  onDeleteIssue,
  onDownloadReport,
  onOpenCloseModal,
  onOpenResponseModal,
  onEnlargePhoto,
}: {
  issue: Issue;
  projectId: string;
  projectName: string;
  members: ProjectMember[];
  nomenclature: NomenclatureTask[];
  currentUser: { id: string; name: string; email: string } | null;
  renderStatusPill: (status: string) => React.ReactNode;
  onClose: () => void;
  onUpdated: (updated: Issue) => void;
  onDeleteIssue?: () => void;
  onDownloadReport: () => void;
  onOpenCloseModal: () => void;
  onOpenResponseModal: () => void;
  onEnlargePhoto: (url: string, allPhotos?: string[], idx?: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const issuePhotos = useMemo(() => {
    if (issue.photos && issue.photos.length > 0) return issue.photos;
    if (issue.image_urls && issue.image_urls.length > 0) return issue.image_urls;
    if (issue.image_url) return [issue.image_url];
    return [];
  }, [issue.photos, issue.image_urls, issue.image_url]);

  const closedPhotos = useMemo(() => {
    if (Array.isArray(issue.closed_photos) && issue.closed_photos.length > 0) {
      return issue.closed_photos;
    }
    if (typeof issue.closed_photos === 'string' && issue.closed_photos) {
      return [issue.closed_photos];
    }
    return [];
  }, [issue.closed_photos]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    location: issue.location || '',
    issue_type: issue.issue_type || issue.tag || 'General',
    description: issue.description || '',
    status: issue.status || 'open',
    tags: issue.tags || '-',
    due_date: issue.due_date ? toDateTimeLocalString(new Date(issue.due_date)) : '',
    assignee_id: issue.assignee_id || '',
    assignee_name: issue.assignee_name || '',
    assigned_team: issue.assigned_team || '',
    assigned_team_phone: issue.assigned_team_phone || '',
    photos: issuePhotos,
  });

  const handleEditPhotosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = reader.result;
          setEditForm((f) => ({ ...f, photos: [...f.photos, res] }));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeEditPhoto = (idxToRemove: number) => {
    setEditForm((f) => ({
      ...f,
      photos: f.photos.filter((_, i) => i !== idxToRemove),
    }));
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAssigneeChange = (userId: string) => {
    const mem = members.find((m) => m.user_id === userId || m.id === userId);
    setEditForm((f) => ({
      ...f,
      assignee_id: userId,
      assignee_name: mem?.user_name || '',
      assigned_team: mem?.user_teams || '',
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setSaving(true);

    const nowIso = new Date().toISOString();
    const updaterName = currentUser?.name || 'Admin';

    const payload = {
      id: issue.id,
      location: editForm.location.trim(),
      issue_type: editForm.issue_type,
      tag: editForm.issue_type,
      description: editForm.description.trim(),
      status: editForm.status,
      tags: editForm.tags.trim() || '-',
      due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
      assignee_id: editForm.assignee_id || null,
      assignee_name: editForm.assignee_name,
      assigned_team: editForm.assigned_team,
      assigned_team_phone: editForm.assigned_team_phone,
      photos: editForm.photos,
      image_urls: editForm.photos,
      image_url: editForm.photos[0] || '',
      last_action_by: updaterName,
      last_action_date: nowIso,
    };

    try {
      const res = await fetch(`/api/projects/${projectId}/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Failed to update issue');
      }

      const updated: Issue = {
        ...issue,
        ...payload,
        due_date: payload.due_date,
        photos: editForm.photos,
        image_urls: editForm.photos,
        image_url: editForm.photos[0] || '',
        tag: editForm.issue_type,
      };

      onUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const [showPreviousResponses, setShowPreviousResponses] = useState(true);
  const responsePhoto = issue.response_photos?.[0] || '';

  // Safely resolve and parse all responses
  const allResponses = useMemo<IssueResponse[]>(() => {
    let list: IssueResponse[] = [];
    if (Array.isArray(issue.responses) && issue.responses.length > 0) {
      list = [...issue.responses];
    } else if (typeof issue.responses === 'string') {
      try {
        const parsed = JSON.parse(issue.responses);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      } catch {}
    }

    // Fallback: If no responses array, but there is a response_description on the issue
    if (list.length === 0 && (issue.response_description || issue.responded_by_name || issue.responded_at)) {
      list = [
        {
          id: 'initial-resp',
          user_name: issue.responded_by_name || issue.assignee_name || 'Admin User',
          user_team: issue.responded_by_team || issue.assigned_team || 'Phone Contact',
          date: issue.responded_at || issue.updated_at || issue.created_at || new Date().toISOString(),
          description: issue.response_description || issue.description || '-',
          photos: (issue.response_photos && issue.response_photos.length > 0) ? issue.response_photos : (responsePhoto ? [responsePhoto] : []),
        },
      ];
    }
    return list;
  }, [issue, responsePhoto]);

  const latestResponse = allResponses[0];
  const previousResponses = allResponses.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Pop-up Card */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden my-auto animate-scale-in text-left">
        {/* Sticky Pop-up Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur sticky top-0 z-10">
          {/* Breadcrumbs matching Image #6: 📁 > Techsec > Location */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 flex-wrap">
            <div className="flex items-center gap-1.5 text-rose-600 font-medium">
              <Folder size={16} className="text-rose-600 fill-rose-100 dark:fill-rose-950/40" />
              <span>{projectName}</span>
            </div>
            <span className="text-gray-400">›</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {issue.location || 'Issue'}
            </span>
            <div className="ml-1 sm:ml-2">{renderStatusPill(issue.status)}</div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 border transition-colors ${
                isEditing
                  ? 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Pencil size={13} />
              <span>{isEditing ? 'View Details' : 'Edit Issue'}</span>
            </button>

            <button
              onClick={onDownloadReport}
              className="text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Download Report"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </button>

            {onDeleteIssue && (
              <button
                onClick={onDeleteIssue}
                className="text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                title="Delete Issue"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Pop-up Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isEditing ? (
            /* ── EDIT MODE FORM ── */
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Edit Issue Details</h3>
                <span className="text-xs text-gray-400">Update fields and save</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Location *
                  </label>
                  <input
                    list="modal-loc-opts"
                    className="input text-xs"
                    value={editForm.location}
                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    required
                  />
                  <datalist id="modal-loc-opts">
                    {nomenclature.map((n) => (
                      <option key={n.id} value={n.name} />
                    ))}
                    <option value="Kitchen" />
                    <option value="TSDGPL/Cabin 3" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Type *
                  </label>
                  <select
                    className="input text-xs"
                    value={editForm.issue_type}
                    onChange={(e) => setEditForm((f) => ({ ...f, issue_type: e.target.value }))}
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Status *
                  </label>
                  <select
                    className="input text-xs"
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as any }))}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    className="input text-xs"
                    value={editForm.tags}
                    onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    className="input text-xs"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Assign To
                  </label>
                  <select
                    className="input text-xs"
                    value={editForm.assignee_id}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id || m.id} value={m.user_id || m.id}>
                        {m.user_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Assigned Team
                  </label>
                  <input
                    type="text"
                    className="input text-xs"
                    value={editForm.assigned_team}
                    onChange={(e) => setEditForm((f) => ({ ...f, assigned_team: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Assigned Team Phone
                  </label>
                  <input
                    type="text"
                    className="input text-xs font-mono"
                    value={editForm.assigned_team_phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, assigned_team_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  className="input text-xs resize-none"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Issue Photos {editForm.photos.length > 0 && `(${editForm.photos.length})`}
                  </label>
                  <label className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer inline-flex items-center gap-1">
                    <Plus size={12} />
                    <span>Add Photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleEditPhotosUpload}
                    />
                  </label>
                </div>

                {editForm.photos.length > 0 ? (
                  <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
                    {editForm.photos.map((photoUrl, pIdx) => (
                      <div
                        key={pIdx}
                        className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl}
                          alt={`Photo ${pIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeEditPhoto(pIdx)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-90 hover:opacity-100 shadow transition-opacity"
                          title="Remove photo"
                        >
                          <X size={12} />
                        </button>
                        <span className="absolute bottom-0 left-0 bg-black/60 text-white text-[9px] font-bold px-1 rounded-tr">
                          #{pIdx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-3 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-500 transition-colors">
                    <Camera size={14} className="text-gray-400" />
                    <span>Click to upload photos for this issue (multiple supported)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleEditPhotosUpload}
                    />
                  </label>
                )}
              </div>

              {editError && <p className="text-xs text-rose-500 font-medium">{editError}</p>}

              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{saving ? 'Saving…' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* ── VIEW MODE (Matching Image #6 layout) ── */
            <>
              {/* 1. Summary Card */}
              <div className="p-5 bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-gray-700/60">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Summary</h3>
                    {renderStatusPill(issue.status)}
                  </div>
                  {issue.status !== 'closed' && (
                    <button
                      onClick={onOpenCloseModal}
                      className="text-xs px-3 py-1 rounded-lg font-medium inline-flex items-center gap-1 border border-emerald-500/70 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      <span>Close Issue</span>
                    </button>
                  )}
                </div>

                {/* 4-column Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
                  {/* Column 1 */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Location</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                        {issue.location || '-'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Raised By</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {issue.reported_by_name || '-'}
                        </span>
                        {issue.reported_by_team && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 font-medium">
                            {issue.reported_by_team}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDatePipe(issue.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tags</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                        {issue.tags || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                        {issue.issue_type || 'General'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Responded By</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {latestResponse?.user_name || issue.responded_by_name || '-'}
                        </span>
                        {(latestResponse?.user_team || issue.responded_by_team) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 font-medium">
                            {latestResponse?.user_team || issue.responded_by_team}
                          </span>
                        )}
                      </div>
                      {(latestResponse?.date || issue.responded_at) && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDatePipe(latestResponse?.date || issue.responded_at)}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Rejections</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                        {issue.rejections || 'R0'}
                      </p>
                    </div>
                  </div>

                  {/* Column 3 */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Assigned User</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {issue.assignee_name || '-'}
                        </span>
                        {issue.assigned_team && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 font-medium">
                            {issue.assigned_team}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Closed By</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {issue.closed_by_name || '-'}
                        </span>
                        {issue.closed_by_team && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 font-medium">
                            {issue.closed_by_team}
                          </span>
                        )}
                      </div>
                      {issue.closed_at && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDatePipe(issue.closed_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Column 4 */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Deadline</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                        {formatDateParen(issue.due_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Geo Tag</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                        {issue.geo_tag || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Side-by-Side Cards (Issue Details & Closed Details) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Issue Details */}
                <div className="p-5 bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl shadow-xs">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2.5 uppercase tracking-wider">
                    Issue Details
                  </h4>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                      {issue.description || '-'}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Photos {issuePhotos.length > 0 && `(${issuePhotos.length})`}
                    </p>
                    {issuePhotos.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {issuePhotos.map((photo, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => onEnlargePhoto(photo, issuePhotos, pIdx)}
                            className="relative inline-block cursor-pointer group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform"
                            title={`Photo ${pIdx + 1} of ${issuePhotos.length}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo} alt={`Issue photo ${pIdx + 1}`} className="w-16 h-16 object-cover" />
                            <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 rounded-tl">
                              #{pIdx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </div>
                </div>

                {/* Right Card: Closed Details */}
                <div className="p-5 bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Closed Details
                    </h4>
                    {issue.status !== 'closed' && (
                      <button
                        onClick={onOpenCloseModal}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold"
                      >
                        + Add Closing Notes
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                      {issue.closed_description ||
                        (issue.status === 'closed'
                          ? 'Issue resolved and verified'
                          : 'Issue is currently open')}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Photos {closedPhotos.length > 0 && `(${closedPhotos.length})`}
                    </p>
                    {closedPhotos.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {closedPhotos.map((photo, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => onEnlargePhoto(photo, closedPhotos, pIdx)}
                            className="relative inline-block cursor-pointer group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform"
                            title={`Closed photo ${pIdx + 1} of ${closedPhotos.length}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo} alt={`Closed photo ${pIdx + 1}`} className="w-16 h-16 object-cover" />
                            <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 rounded-tl">
                              #{pIdx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Response Details Card */}
              <div className="p-5 bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Response Details
                    </h4>
                    {allResponses.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/60 font-semibold">
                        {allResponses.length} {allResponses.length === 1 ? 'Response' : 'Responses'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={onOpenResponseModal}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                  >
                    <MessageSquare size={13} />
                    <span>Add Response</span>
                  </button>
                </div>

                {allResponses.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No response added yet. Click &ldquo;Add Response&rdquo; to record a resolution update.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Latest Response (#1) */}
                    {latestResponse && (
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          1. {latestResponse.user_name || 'Responder'}{' '}
                          {latestResponse.user_team && (
                            <span className="font-normal text-gray-500 dark:text-gray-400">
                              [{latestResponse.user_team}]
                            </span>
                          )}{' '}
                          - <span className="font-normal text-gray-500 dark:text-gray-400">{formatDateParen(latestResponse.date)}</span>
                        </p>

                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                            {latestResponse.description || '-'}
                          </p>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Photos</p>
                          {latestResponse.photos && latestResponse.photos.length > 0 ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              {latestResponse.photos.map((photo, pIdx) => (
                                <div
                                  key={pIdx}
                                  onClick={() => onEnlargePhoto(photo, latestResponse.photos || [], pIdx)}
                                  className="relative inline-block cursor-pointer group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={photo} alt={`Response photo ${pIdx + 1}`} className="w-16 h-16 object-cover" />
                                  <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 rounded-tl">
                                    +{pIdx + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Previous Responses Accordion */}
                    {previousResponses.length > 0 && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700/60">
                        <button
                          type="button"
                          onClick={() => setShowPreviousResponses(!showPreviousResponses)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          <span>Previous Responded Details ({previousResponses.length})</span>
                          {showPreviousResponses ? (
                            <ChevronUp size={13} className="text-gray-400 dark:text-gray-500" />
                          ) : (
                            <ChevronDown size={13} className="text-gray-400 dark:text-gray-500" />
                          )}
                        </button>

                        {showPreviousResponses && (
                          <div className="mt-3 space-y-4 pt-1">
                            {previousResponses.map((resp, idx) => (
                              <div
                                key={resp.id || idx}
                                className="p-3.5 rounded-lg bg-white/70 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/60"
                              >
                                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                  {idx + 2}. {resp.user_name || 'Responder'}{' '}
                                  {resp.user_team && (
                                    <span className="font-normal text-gray-500 dark:text-gray-400">
                                      [{resp.user_team}]
                                    </span>
                                  )}{' '}
                                  - <span className="font-normal text-gray-500 dark:text-gray-400">{formatDateParen(resp.date)}</span>
                                </p>

                                <div className="mt-2">
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                    {resp.description || '-'}
                                  </p>
                                </div>

                                <div className="mt-3">
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Photos</p>
                                  {resp.photos && resp.photos.length > 0 ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {resp.photos.map((photo, pIdx) => (
                                        <div
                                          key={pIdx}
                                          onClick={() => onEnlargePhoto(photo, resp.photos || [], pIdx)}
                                          className="relative inline-block cursor-pointer group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:scale-105 transition-transform"
                                          title={`Previous photo ${pIdx + 1} of ${resp.photos?.length || 1}`}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={photo} alt={`Previous photo ${pIdx + 1}`} className="w-16 h-16 object-cover" />
                                          <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 rounded-tl">
                                            +{pIdx + 1}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Issue Modal (Report Issue)
// ─────────────────────────────────────────────────────────────────────────────
function AddIssueModal({
  projectId,
  projectName,
  members,
  nomenclature,
  currentUser,
  onClose,
  onSaved,
}: {
  projectId: string;
  projectName: string;
  members: ProjectMember[];
  nomenclature: NomenclatureTask[];
  currentUser: { id: string; name: string; email: string } | null;
  onClose: () => void;
  onSaved: (newIssue?: Issue) => void;
}) {
  const defaultDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(16, 0, 0, 0);
    return toDateTimeLocalString(d);
  }, []);

  const initialReporter = useMemo(() => {
    if (currentUser) {
      const match = members.find(
        (m) =>
          m.user_id === currentUser.id ||
          m.user_email?.toLowerCase() === currentUser.email?.toLowerCase() ||
          m.user_name?.toLowerCase() === currentUser.name?.toLowerCase()
      );
      if (match) return match;
    }
    return members[0] || null;
  }, [currentUser, members]);

  const [form, setForm] = useState({
    title: '',
    location: '',
    issue_type: 'General',
    description: '',
    severity: 'medium' as Issue['severity'],
    status: 'open' as Issue['status'],
    deadline: defaultDeadline,
    assignee_id: members[0]?.user_id || members[0]?.id || '',
    assignee_name: members[0]?.user_name || '',
    assigned_team: members[0]?.user_teams || '',
    assigned_team_phone: '',
    reported_by: initialReporter?.user_id || initialReporter?.id || currentUser?.id || '',
    reported_by_name: initialReporter?.user_name || currentUser?.name || '',
    reported_by_team: initialReporter?.user_teams || 'Main Team',
    tags: '-',
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!form.assignee_id && members.length > 0) {
      setForm((f) => ({
        ...f,
        assignee_id: members[0]?.user_id || members[0]?.id || '',
        assignee_name: members[0]?.user_name || '',
        assigned_team: members[0]?.user_teams || '',
      }));
    }
  }, [members, form.assignee_id]);

  useEffect(() => {
    if (!form.reported_by && initialReporter) {
      setForm((f) => ({
        ...f,
        reported_by: initialReporter.user_id || initialReporter.id || '',
        reported_by_name: initialReporter.user_name || '',
        reported_by_team: initialReporter.user_teams || 'Main Team',
      }));
    }
  }, [initialReporter, form.reported_by]);

  const handleAssigneeChange = (userId: string) => {
    const mem = members.find((m) => m.user_id === userId || m.id === userId);
    setForm((f) => ({
      ...f,
      assignee_id: userId,
      assignee_name: mem?.user_name || '',
      assigned_team: mem?.user_teams || '',
    }));
  };

  const handleReporterChange = (userId: string) => {
    const mem = members.find((m) => m.user_id === userId || m.id === userId);
    setForm((f) => ({
      ...f,
      reported_by: userId,
      reported_by_name: mem?.user_name || '',
      reported_by_team: mem?.user_teams || 'Main Team',
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = reader.result;
          setPhotos((prev) => [...prev, res]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idxToRemove: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idxToRemove));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.location.trim()) {
      setError('Location is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim() || `${form.issue_type} - ${form.location.trim()}`,
        description: form.description.trim(),
        location: form.location.trim(),
        tag: form.issue_type,
        issue_type: form.issue_type,
        severity: form.severity,
        status: form.status,
        due_date: form.deadline ? new Date(form.deadline).toISOString() : null,
        assignee_id: form.assignee_id || null,
        assignee_name: form.assignee_name,
        assigned_team: form.assigned_team,
        assigned_team_phone: form.assigned_team_phone,
        reported_by: form.reported_by || null,
        reported_by_name: form.reported_by_name,
        reported_by_team: form.reported_by_team,
        image_url: photos[0] || '',
        image_urls: photos,
        photos: photos,
        tags: form.tags || '-',
        rejections: 'R0',
        last_action_by: form.reported_by_name || 'Admin',
        last_action_date: new Date().toISOString(),
      };

      const res = await fetch(`/api/projects/${projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d?.error || 'Failed to save issue');
      }

      const createdIssue: Issue = d?.issue || (Array.isArray(d?.issues) ? d.issues[0] : null) || {
        id: d?.id || 'temp-' + Date.now(),
        project_id: projectId,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onSaved(createdIssue);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-scale-in my-auto text-left">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Report Issue</h2>
            <p className="text-xs text-gray-500">Add a new issue for this project</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Project
            </label>
            <div className="px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-900 dark:text-white">
              {projectName}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Location *
            </label>
            <input
              list="loc-opts"
              className="input text-xs"
              placeholder="e.g. Kitchen"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              required
            />
            <datalist id="loc-opts">
              {nomenclature.map((n) => (
                <option key={n.id} value={n.name} />
              ))}
              <option value="Kitchen" />
              <option value="TSDGPL/Cabin 3" />
              <option value="Intern" />
              <option value="Main Block" />
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Type *
              </label>
              <select
                className="input text-xs"
                value={form.issue_type}
                onChange={(e) => setForm((f) => ({ ...f, issue_type: e.target.value }))}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Tags
              </label>
              <input
                type="text"
                className="input text-xs"
                placeholder="e.g. -"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Description *
            </label>
            <textarea
              rows={3}
              className="input text-xs resize-none"
              placeholder="e.g. AC remote is not kept on the holder & key holder is broken"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Photos {photos.length > 0 && `(${photos.length})`}
              </label>
              <label className="cursor-pointer text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
                <Camera size={13} />
                <span>+ Add {photos.length > 0 ? 'More' : 'Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap p-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative inline-block group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={`Issue preview ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow hover:bg-rose-600 cursor-pointer"
                      title="Remove photo"
                    >
                      <X size={12} />
                    </button>
                    <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] font-bold px-1 rounded">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 hover:bg-gray-100/50 dark:bg-gray-800/40 cursor-pointer transition-colors text-xs text-gray-500">
                <Camera size={20} className="text-rose-500 mb-1" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Upload Issue Photos</span>
                <span className="text-[11px] text-gray-400">Select one or multiple images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Deadline
            </label>
            <input
              type="datetime-local"
              className="input text-xs"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Assign To
              </label>
              <select
                className="input text-xs"
                value={form.assignee_id}
                onChange={(e) => handleAssigneeChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id || m.id} value={m.user_id || m.id}>
                    {m.user_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Assigned Team
              </label>
              <input
                type="text"
                className="input text-xs"
                placeholder="e.g. Sparsh Team"
                value={form.assigned_team}
                onChange={(e) => setForm((f) => ({ ...f, assigned_team: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Team Phone Number
            </label>
            <input
              type="text"
              className="input text-xs font-mono"
              placeholder="e.g. 47894898787"
              value={form.assigned_team_phone}
              onChange={(e) => setForm((f) => ({ ...f, assigned_team_phone: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Raise By
            </label>
            <select
              className="input text-xs"
              value={form.reported_by}
              onChange={(e) => handleReporterChange(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.user_id || m.id} value={m.user_id || m.id}>
                  {m.user_name} ({m.user_teams || 'Team'})
                </option>
              ))}
              {currentUser && !members.some((m) => m.user_id === currentUser.id) && (
                <option value={currentUser.id}>{currentUser.name} (Current User)</option>
              )}
            </select>
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center py-2 text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 justify-center py-2 text-xs shadow-md"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>{saving ? 'Creating…' : 'Create Issue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Close Issue Modal
// ─────────────────────────────────────────────────────────────────────────────
function CloseIssueModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (desc: string, photo: string | string[]) => void;
}) {
  const [desc, setDesc] = useState(
    'AC remote kept on the original place and key holder is changed'
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = reader.result;
          setPhotos((prev) => [...prev, res]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idxToRemove: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idxToRemove));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 glass">
      <div className="card w-full max-w-md p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl text-left">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Close Issue</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Closing Description / Resolution
            </label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="input text-xs resize-none"
              placeholder="e.g. AC remote kept on the original place and key holder is changed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Resolution Photos {photos.length > 0 && `(${photos.length})`}
              </label>
              <label className="cursor-pointer text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-1">
                <Camera size={13} />
                <span>+ Add {photos.length > 0 ? 'More' : 'Photo'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`Resolution ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer hover:bg-rose-600"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300 transition-colors">
                <Camera size={14} className="text-teal-500" />
                <span>Upload resolution photos (single or multiple)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs py-2">
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                onConfirm(desc, photos);
              }}
              className="btn-primary flex-1 text-xs py-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Confirm & Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Response Modal
// ─────────────────────────────────────────────────────────────────────────────
function AddResponseModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (desc: string, photo: string | string[]) => void;
}) {
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = reader.result;
          setPhotos((prev) => [...prev, res]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idxToRemove: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idxToRemove));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 glass">
      <div className="card w-full max-w-md p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl text-left">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add Response</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Response Note / Description
            </label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="input text-xs resize-none"
              placeholder="e.g. Work in progress, parts requested..."
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Attachment Photos {photos.length > 0 && `(${photos.length})`}
              </label>
              <label className="cursor-pointer text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-1">
                <Camera size={13} />
                <span>+ Add {photos.length > 0 ? 'More' : 'Photo'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`Attached ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer hover:bg-rose-600"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300 transition-colors">
                <Camera size={14} className="text-teal-500" />
                <span>Upload attachment photos (single or multiple)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs py-2">
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !desc.trim()}
              onClick={() => {
                setLoading(true);
                onConfirm(desc, photos);
              }}
              className="btn-primary flex-1 text-xs py-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
              <span>Post Response</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Delete Issue Confirmation
// ─────────────────────────────────────────────────────────────────────────────
function DeleteIssueModal({
  issue,
  projectId,
  onClose,
  onDeleted,
}: {
  issue: Issue;
  projectId: string;
  onClose: () => void;
  onDeleted: (issueId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirmDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/issues?id=${issue.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Failed to delete issue');
      }
      onDeleted(issue.id);
    } catch (e) {
      setError((e as Error).message || 'Failed to delete issue');
      setDeleting(false);
    }
  }, [deleting, issue.id, projectId, onDeleted]);

  // Keyboard navigation: Escape to cancel, Enter to delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === 'BUTTON' && target.getAttribute('data-action') === 'cancel') {
          return;
        }
        e.preventDefault();
        confirmDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, confirmDelete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl animate-scale-in text-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 text-rose-500">
            <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
              <Trash2 size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Delete Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          Are you sure you want to delete this issue at{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {issue.location || 'unnamed location'}
          </span>{' '}
          ({issue.issue_type || 'General'})? This action cannot be undone.
        </p>

        {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}

        <form onSubmit={(e) => { e.preventDefault(); confirmDelete(); }}>
          <div className="flex gap-2.5">
            <button
              type="button"
              data-action="cancel"
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              autoFocus
              disabled={deleting}
              className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>{deleting ? 'Deleting…' : 'Delete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

