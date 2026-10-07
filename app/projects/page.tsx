'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderKanban, Plus, Search, Upload, FileDown, Pencil, Trash2, Loader2, Users as UsersIcon,
} from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import ProjectFormModal from '@/components/ProjectFormModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Project } from '@/lib/types';

const statusOptions = ['all', 'active', 'completed', 'on_hold'] as const;
const statusLabel: Record<string, string> = {
  all: 'All',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
};

const badgeClass: Record<string, string> = {
  active: 'badge-active',
  completed: 'badge-completed',
  on_hold: 'badge-on_hold',
};

export default function Projects() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof statusOptions[number]>('all');
  const [showImport, setShowImport] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<Partial<Project> | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce the search input so we don't refetch on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [debouncedSearch, statusFilter]);

  // Counts
  const { activeCount, totalCount } = useMemo(() => {
    return {
      activeCount: projects.filter((p) => p.status === 'active').length,
      totalCount: projects.length,
    };
  }, [projects]);

  // Status toggle — optimistic
  const toggleStatus = async (p: Project) => {
    const next = p.status === 'active' ? 'completed' : 'active';
    setProjects((arr) => arr.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    try {
      const res = await fetch(`/api/projects?id=${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // rollback
      setProjects((arr) => arr.map((x) => (x.id === p.id ? { ...x, status: p.status } : x)));
    }
  };

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const rows = chunk.map((r) => ({
        name: sanitizeString(r.name || r.project_name || 'Unnamed'),
        unique_code: sanitizeString(r.unique_code || r.code || r.nomenclature || ''),
        client_name: sanitizeString(r.client_name || r.client || ''),
        description: sanitizeString(r.description || r.instruction || ''),
        status: (r.status || 'active').toLowerCase(),
        radius_m: r.radius_m ? Number(r.radius_m) : 100,
        timezone: sanitizeString(r.timezone || 'Asia/Calcutta'),
        perm_location: r.perm_location === 'true' || r.perm_location === '1',
        perm_authentication: r.perm_authentication === 'true' || r.perm_authentication === '1',
        perm_rfi: r.perm_rfi === 'true' || r.perm_rfi === '1',
      }));
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(await res.text());
    }, data);
  };

  const openEdit = async (project: Project) => {
    // Fetch fresh copy of the project (with all v2 fields) for editing
    try {
      const res = await fetch(`/api/projects?id=${project.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEditInitial(data);
      setEditProjectId(project.id);
    } catch {
      setEditInitial(project);
      setEditProjectId(project.id);
    }
  };

  const handleDeleteProject = async (p: Project) => {
    const name = p.name || 'this project';
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will permanently remove the project and its related data from the database.`)) {
      return;
    }

    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/projects?id=${p.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete project');
      }
      // Optimistically remove from state
      setProjects((prev) => prev.filter((item) => item.id !== p.id));
    } catch (err) {
      alert((err as Error).message || 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Active Projects:{' '}
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {loading ? '…' : activeCount}
            </span>{' '}
            out of {loading ? '…' : totalCount}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadSampleExcel('projects')}
            className="btn-secondary"
            title="Download Excel template"
          >
            <FileDown size={15} /> Template
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload size={15} /> Import
          </button>
          <button
            onClick={() => {
              setEditProjectId(null);
              setEditInitial(undefined);
              setShowAddProject(true);
            }}
            className="btn-primary"
          >
            <Plus size={15} /> Add Project
          </button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex items-center w-full sm:w-72">
          <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, code or client…"
            className="input pl-8 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                statusFilter === s
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {loading
          ? 'Loading…'
          : `Showing ${projects.length} project${projects.length === 1 ? '' : 's'}`}
      </p>

      {/* ─── Table ─── */}
      {!loading && projects.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 w-10">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Assigned Users</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Updated By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Updated On</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">My Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {projects.map((p, idx) => {
                  const memberCount = (p as any).member_count ?? 0;
                  const firstMember = (p as any).first_member_name as string | undefined;
                  const adminName = (p as any).project_admin_name as string | undefined;
                  const updaterName = (p as any).updated_by_name as string | undefined;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${p.id}/eqc`}
                          className="font-medium text-teal-600 dark:text-teal-400 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {p.unique_code || p.nomenclature || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                        {p.client_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                        {adminName ? (
                          <span className="font-medium text-gray-900 dark:text-gray-100 block truncate max-w-[150px]">
                            {adminName}
                          </span>
                        ) : memberCount > 0 ? (
                          <span>
                            {firstMember || 'Member'}{' '}
                            {memberCount > 1 && (
                              <span className="text-gray-400">+{memberCount - 1}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 inline-flex items-center gap-1">
                            <UsersIcon size={12} /> 0
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {updaterName || (p.updated_by ? p.updated_by.slice(0, 8) : '—')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {p.updated_at
                          ? new Date(p.updated_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : new Date(p.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {adminName ? 'Admin' : 'Member'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
                            title="Edit project"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(p)}
                            disabled={deletingId === p.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Delete project"
                          >
                            {deletingId === p.id ? (
                              <Loader2 size={13} className="animate-spin text-red-500" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(p)}
                          className={`badge ${badgeClass[p.status] ?? 'badge-active'} text-xs cursor-pointer hover:opacity-80`}
                          title="Toggle status"
                        >
                          {statusLabel[p.status] ?? p.status}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <FolderKanban size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">No projects found</p>
          <p className="text-xs mt-1">Try adjusting your filters or add a new project</p>
          <button
            onClick={() => {
              setEditProjectId(null);
              setEditInitial(undefined);
              setShowAddProject(true);
            }}
            className="btn-primary mt-4"
          >
            <Plus size={14} /> Add Project
          </button>
        </div>
      )}

      {/* ─── Modals ─── */}
      <ProjectFormModal
        isOpen={showAddProject || !!editProjectId}
        onClose={() => {
          setShowAddProject(false);
          setEditProjectId(null);
          setEditInitial(undefined);
        }}
        initial={editInitial}
        projectId={editProjectId ?? undefined}
        onSaved={load}
      />

      <ImportModal
        isOpen={showImport}
        onClose={() => {
          setShowImport(false);
          load();
        }}
        title="Import Projects"
        description="Upload an Excel or CSV file with columns: name, unique_code, client_name, description, radius_m, timezone, status"
        onImport={handleImport}
      />
    </div>
  );
}
