import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { api } from '../services/api';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { ImportModal } from '../components/common/ImportModal';
import { ProjectEqcTab } from '../components/projects/ProjectEqcTab';
import { ProjectIssuesTab } from '../components/projects/ProjectIssuesTab';
import { ProjectRegisterTab } from '../components/projects/ProjectRegisterTab';
import { ProjectChecklistsTab } from '../components/projects/ProjectChecklistsTab';
import { ProjectMembersTab } from '../components/projects/ProjectMembersTab';
import { ProjectTeamsTab } from '../components/projects/ProjectTeamsTab';
import { ProjectTargetsTab } from '../components/projects/ProjectTargetsTab';
import { Badge } from '../components/common/Badge';
import {
  FolderKanban,
  Plus,
  FileSpreadsheet,
  Search,
  LayoutGrid,
  List,
  ArrowLeft,
  MapPin,
  Clock,
  Shield,
  FileCheck,
  AlertTriangle,
  FileText,
  CheckSquare,
  Users,
  Target,
  Edit3,
} from 'lucide-react';

interface ProjectsProps {
  initialActiveProjectId?: string | null;
  onOpenChecklistBuilder?: (checklistId: string) => void;
}

export const Projects: React.FC<ProjectsProps> = ({ initialActiveProjectId, onOpenChecklistBuilder }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Active workspace drawer state
  const [activeWorkspaceProject, setActiveWorkspaceProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'eqc' | 'issue' | 'register' | 'checklists' | 'users' | 'teams' | 'target'>('eqc');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);

      if (initialActiveProjectId) {
        const found = data.find(p => p.id === initialActiveProjectId);
        if (found) setActiveWorkspaceProject(found);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [initialActiveProjectId]);

  const handleCreateOrUpdateProject = async (formData: Partial<Project>) => {
    if (editingProject) {
      await api.updateProject(editingProject.id, formData);
    } else {
      await api.createProject(formData);
    }
    setEditingProject(null);
    loadProjects();
  };

  const handleToggleStatus = async (p: Project) => {
    const nextStatus = p.status === 'active' ? 'completed' : 'active';
    // Optimistic update
    setProjects(prev =>
      prev.map(item => (item.id === p.id ? { ...item, status: nextStatus } : item))
    );
    try {
      await api.updateProject(p.id, { status: nextStatus });
    } catch (err) {
      console.error('Failed to update project status:', err);
      loadProjects();
    }
  };

  const handleImportProjects = async (rows: any[]) => {
    for (const row of rows) {
      await api.createProject({
        name: row.Name || row['Project Name'] || 'Imported Site Project',
        unique_code: row['Unique Code'] || `PCPL-IMP-${Math.floor(100 + Math.random() * 900)}`,
        client_name: row['Client Name'] || 'Client Partner',
        nomenclature: row.Nomenclature || 'PRJ-01',
        profile: row.Profile || 'Civil High-Rise Construction',
        status: (row.Status || 'active').toLowerCase(),
      });
    }
    loadProjects();
  };

  const filteredProjects = projects.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unique_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // If a project detail workspace is opened, render the 7-tab detail view
  if (activeWorkspaceProject) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        {/* Workspace Detail Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <button
                onClick={() => setActiveWorkspaceProject(null)}
                className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition border border-slate-200 shrink-0"
                id="workspace-back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-0.5 rounded-md">
                    {activeWorkspaceProject.unique_code}
                  </span>
                  <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {activeWorkspaceProject.nomenclature}
                  </span>
                  <Badge status={activeWorkspaceProject.status} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{activeWorkspaceProject.name}</h2>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span>Client: <strong className="text-slate-800">{activeWorkspaceProject.client_name}</strong></span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> {activeWorkspaceProject.address}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingProject(activeWorkspaceProject);
                  setIsFormModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 rounded-lg flex items-center gap-1.5 transition border border-slate-200"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Edit Settings
              </button>
            </div>
          </div>

          {/* 7 Navigation Workspace Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-4">
            {[
              { id: 'eqc', label: 'EQC Log', icon: FileCheck },
              { id: 'issue', label: 'Issues & Defect', icon: AlertTriangle },
              { id: 'register', label: 'Document Register', icon: FileText },
              { id: 'checklists', label: 'Checklists', icon: CheckSquare },
              { id: 'users', label: 'Users & Roles', icon: Users },
              { id: 'teams', label: 'Contractor Teams', icon: Users },
              { id: 'target', label: 'KPI Targets', icon: Target },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                  id={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab View Container */}
        <div className="pt-2">
          {activeTab === 'eqc' && <ProjectEqcTab projectId={activeWorkspaceProject.id} />}
          {activeTab === 'issue' && <ProjectIssuesTab projectId={activeWorkspaceProject.id} />}
          {activeTab === 'register' && <ProjectRegisterTab projectId={activeWorkspaceProject.id} />}
          {activeTab === 'checklists' && (
            <ProjectChecklistsTab
              projectId={activeWorkspaceProject.id}
              onOpenChecklistBuilder={onOpenChecklistBuilder}
            />
          )}
          {activeTab === 'users' && <ProjectMembersTab projectId={activeWorkspaceProject.id} />}
          {activeTab === 'teams' && <ProjectTeamsTab projectId={activeWorkspaceProject.id} />}
          {activeTab === 'target' && <ProjectTargetsTab projectId={activeWorkspaceProject.id} />}
        </div>

        {/* Edit Form Modal */}
        <ProjectFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingProject(null);
          }}
          onSubmit={handleCreateOrUpdateProject}
          initialData={editingProject}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search & Status Filter Pills */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 w-full md:w-72 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by project name or code..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full placeholder-slate-400"
              id="search-projects-input"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg">
            {['all', 'active', 'completed', 'on_hold'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Actions & View Mode Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-white border border-slate-200 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            id="import-projects-btn"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            Import
          </button>

          <button
            onClick={() => {
              setEditingProject(null);
              setIsFormModalOpen(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition shadow-xs"
            id="add-project-btn"
          >
            <Plus className="w-4 h-4" /> Add Project
          </button>
        </div>
      </div>

      {/* Projects Presentation Grid / Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs animate-pulse">Loading Projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200 space-y-3 shadow-sm">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-slate-900">No Projects Found</p>
          <p className="text-xs text-slate-500">Add a project or adjust your search filter criteria</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenWorkspace={p => setActiveWorkspaceProject(p)}
              onEditProject={p => {
                setEditingProject(p);
                setIsFormModalOpen(true);
              }}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">#</th>
                  <th className="px-4 py-3.5">Project Name</th>
                  <th className="px-4 py-3.5">Unique Code</th>
                  <th className="px-4 py-3.5">Client Name</th>
                  <th className="px-4 py-3.5">Engineers</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => setActiveWorkspaceProject(p)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3.5 font-mono text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{p.name}</td>
                    <td className="px-4 py-3.5 font-mono text-indigo-600 font-bold">{p.unique_code}</td>
                    <td className="px-4 py-3.5 text-slate-600">{p.client_name}</td>
                    <td className="px-4 py-3.5 text-slate-500">{p.members_count || 3} Engineers</td>
                    <td className="px-4 py-3.5">
                      <Badge status={p.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(p);
                          setIsFormModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Wizard Modal */}
      <ProjectFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleCreateOrUpdateProject}
        initialData={editingProject}
      />

      {/* Bulk Excel/CSV Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityName="Projects"
        onImportSubmit={handleImportProjects}
      />
    </div>
  );
};
