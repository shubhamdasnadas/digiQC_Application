'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, Settings, MapPin, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { ProjectProvider } from '@/context/ProjectContext';
import type { Project } from '@/lib/types';

const TABS = [
  { key: 'eqc', label: 'Inspection' },
  { key: 'issue', label: 'Issue' },
  { key: 'register', label: 'Register' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'users', label: 'Users' },
  { key: 'teams', label: 'Teams' },
  { key: 'target', label: 'Target' },
  { key: 'nomenclature', label: 'Nomenclature' },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects?id=${id}`);
      if (!res.ok) throw new Error('Project not found');
      const data = await res.json();
      setProject(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <Loader2 size={28} className="animate-spin text-teal-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 text-sm">{error || 'Project not found'}</p>
        <button
          onClick={() => router.push('/projects')}
          className="btn-secondary mt-4 inline-flex"
        >
          <ArrowLeft size={14} /> Back to Projects
        </button>
      </div>
    );
  }

  return (
    <ProjectProvider project={project} refresh={refresh}>
      <div className="p-6 animate-fade-in">
        {/* ─── Header ─── */}
        <div className="mb-5">
          <Link
            href="/projects"
            className="text-xs text-gray-500 hover:text-teal-500 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={11} /> All Projects
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> {project.timezone || 'Asia/Calcutta'}
                </span>
                {project.latitude != null && project.longitude != null && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {project.latitude.toFixed(4)}, {project.longitude.toFixed(4)}
                  </span>
                )}
                {project.client_name && (
                  <span>
                    Client:{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {project.client_name}
                    </span>
                  </span>
                )}
                {project.unique_code && (
                  <span className="font-mono">
                    Code: <span className="text-teal-600 dark:text-teal-400">{project.unique_code}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary">
                <Activity size={14} /> My Activities
              </button>
              <button className="btn-secondary">
                <Settings size={14} /> Settings
              </button>
            </div>
          </div>
        </div>

        {/* ─── Tabs ─── */}
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 mb-5 overflow-x-auto">
          {TABS.map((t) => {
            const href = `/projects/${id}/${t.key}`;
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={t.key}
                href={href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </ProjectProvider>
  );
}
