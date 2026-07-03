'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Project } from '@/lib/types';

interface ProjectContextValue {
  project: Project;
  /** Re-fetch the project info (call after edits). */
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project,
  refresh,
  children,
}: {
  project: Project;
  refresh: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <ProjectContext.Provider value={{ project, refresh }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
}
