import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface ShellProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ currentPage, onNavigate, children }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNavigate = (page: string) => {
    setIsMobileOpen(false);
    onNavigate(page);
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f9fafb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 relative">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
          id="mobile-drawer-backdrop"
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isMobileOpen={isMobileOpen}
        isCollapsed={isCollapsed}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onToggleSidebar={handleToggleSidebar}
          isCollapsed={isCollapsed}
        />
        <main className="flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-slate-950 p-3 sm:p-6 lg:p-8 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};

