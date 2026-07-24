import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Shell } from './components/layout/Shell';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SelectOrg } from './pages/SelectOrg';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Checklists } from './pages/Checklists';
import { Teams } from './pages/Teams';
import { Organizations } from './pages/Organizations';

function MainRouter() {
  const { user, isAuthenticated, currentOrg, isLoading } = useAuth();
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [activeWorkspaceProjectId, setActiveWorkspaceProjectId] = useState<string | null>(null);
  const [activeChecklistBuilderId, setActiveChecklistBuilderId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center text-slate-500 text-xs font-medium">
        Loading session...
      </div>
    );
  }

  const handleNavigate = (page: string) => {
    setActivePage(page);
    setActiveWorkspaceProjectId(null);
    setActiveChecklistBuilderId(null);
  };

  const handleOpenProjectWorkspace = (projectId: string) => {
    setActiveWorkspaceProjectId(projectId);
    setActivePage('projects');
  };

  const handleOpenChecklistBuilder = (checklistId: string) => {
    setActiveChecklistBuilderId(checklistId);
    setActivePage('checklists');
  };

  // Auth routing checks
  if (!isAuthenticated) {
    if (activePage === 'register') {
      return <Register onNavigate={handleNavigate} />;
    }
    return <Login onNavigate={handleNavigate} />;
  }

  // If authenticated but no active org selected, enforce SelectOrg screen
  if (!currentOrg && activePage !== 'select-org') {
    return <SelectOrg onNavigate={handleNavigate} />;
  }

  if (activePage === 'select-org') {
    return <SelectOrg onNavigate={handleNavigate} />;
  }

  return (
    <Shell activePage={activePage} onNavigate={handleNavigate}>
      {activePage === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
          onOpenProjectWorkspace={handleOpenProjectWorkspace}
        />
      )}

      {activePage === 'projects' && (
        <Projects
          initialActiveProjectId={activeWorkspaceProjectId}
          onOpenChecklistBuilder={handleOpenChecklistBuilder}
        />
      )}

      {activePage === 'checklists' && (
        <Checklists initialBuilderChecklistId={activeChecklistBuilderId} />
      )}

      {activePage === 'teams' && <Teams />}

      {activePage === 'organizations' && <Organizations />}
    </Shell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
