import React from 'react';
import { Project } from '../../types';
import { Badge } from '../common/Badge';
import { MapPin, Users, Calendar, ArrowRight, Edit3, ShieldAlert } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onOpenWorkspace: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onToggleStatus: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpenWorkspace,
  onEditProject,
  onToggleStatus,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group">
      {/* Cover Image Header */}
      <div className="relative h-36 bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <img
          src={project.image_url || 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg'}
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent" />

        {/* Status Badge & Code */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white border border-white/50 dark:border-slate-700/50 px-2 py-0.5 rounded-md backdrop-blur-xs shadow-xs">
            {project.unique_code}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(project);
            }}
            title="Click to toggle active / completed status"
            id={`toggle-status-${project.id}`}
          >
            <Badge status={project.status} />
          </button>
        </div>

        {/* Project Nomenclature Pill */}
        <div className="absolute bottom-2 left-3 text-xs font-semibold text-white flex items-center gap-1.5">
          <span className="bg-slate-900/80 text-white px-2 py-0.5 rounded text-[10px] uppercase font-mono">
            {project.nomenclature}
          </span>
          <span className="text-slate-200 truncate max-w-[150px] shadow-xs">{project.client_name}</span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              onClick={() => onOpenWorkspace(project)}
              className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition line-clamp-1"
            >
              {project.name}
            </h3>
            <button
              onClick={() => onEditProject(project)}
              className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Edit Project"
              id={`edit-proj-${project.id}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
            {project.profile || project.description}
          </p>
        </div>

        {/* Location & Metadata info */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">{project.address || `${project.latitude}, ${project.longitude}`}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{project.members_count || 3} Engineers</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => onOpenWorkspace(project)}
          className="w-full py-2 bg-slate-50 hover:bg-slate-900 hover:text-white text-xs font-semibold text-slate-800 rounded-lg transition flex items-center justify-center gap-2 group/btn border border-slate-200"
          id={`open-workspace-${project.id}`}
        >
          <span>Open QC Workspace</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
