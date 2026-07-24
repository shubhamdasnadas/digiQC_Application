import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users2,
  Building2,
  LogOut,
  ChevronRight,
  HardHat,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isMobileOpen?: boolean;
  isCollapsed?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isMobileOpen = false,
  isCollapsed = false,
  onCloseMobile,
}) => {
  const { currentOrg, user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare },
    { id: 'teams', label: 'Teams', icon: Users2 },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
  ];

  return (
    <aside
      className={`
        bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex flex-col justify-between shrink-0 select-none transition-all duration-300 z-50
        fixed inset-y-0 left-0 w-64 md:static md:translate-x-0
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}
      `}
    >
      {/* Brand Header */}
      <div>
        <div className={`h-16 border-b border-slate-200 dark:border-slate-800 flex items-center bg-white dark:bg-slate-900 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-md bg-indigo-600 text-white font-bold flex items-center justify-center shadow-sm shrink-0" title="DigiQC Platform">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in truncate">
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                  Digi<span className="text-indigo-600 dark:text-indigo-400">QC</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase truncate">
                  Construction QC
                </div>
              </div>
            )}
          </div>

          {/* Mobile close icon */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close Sidebar"
            id="mobile-sidebar-close-btn"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Tenant Organization Badge */}
        {currentOrg && (
          <div
            className={`mx-3 mt-4 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            {!isCollapsed ? (
              <>
                <div className="truncate">
                  <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    Current Org
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                    {currentOrg.name}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded-full shrink-0">
                  {currentOrg.licensing}
                </span>
              </>
            ) : (
              <div
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase"
                title={currentOrg.name}
              >
                {currentOrg.name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Navigation Items */}
        <nav className="px-2.5 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                } rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
                }`}
                id={`nav-${item.id}`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && isActive && <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 truncate">
            <div
              className="w-8 h-8 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0"
              title={user?.name || 'QC'}
            >
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'QC'}
            </div>
            {!isCollapsed && (
              <div className="truncate text-left">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user?.name || 'Sarvesh Gupta'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'user@digiqc.com'}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

