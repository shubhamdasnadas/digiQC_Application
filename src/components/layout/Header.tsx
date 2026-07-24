import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Sun,
  Moon,
  Building2,
  ChevronDown,
  Search,
  Bell,
  LogOut,
  Layers,
  Building,
  PanelLeft,
} from 'lucide-react';

interface HeaderProps {
  onNavigate: (page: string) => void;
  currentPage: string;
  onToggleSidebar?: () => void;
  isCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  currentPage,
  onToggleSidebar,
  isCollapsed = false,
}) => {
  const { user, orgs, currentOrg, switchOrg, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifications, setNotifications] = useState(2);

  const getTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'projects':
        return 'Projects Registry';
      case 'checklists':
        return 'Checklists & Templates';
      case 'teams':
        return 'Teams & Contractors';
      case 'organizations':
        return 'Organization Management';
      case 'select-org':
        return 'Select Organization';
      default:
        return 'DigiQC Platform';
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30 shadow-xs transition-colors duration-200">
      {/* Page Title & Sidebar Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition shrink-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            id="header-sidebar-toggle-btn"
          >
            <PanelLeft className={`w-4 h-4 text-slate-700 dark:text-slate-200 transition-transform ${isCollapsed ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} />
          </button>
        )}

        <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 truncate">
          {getTitle()}
        </h1>

        {/* Search input - desktop */}
        <div className="hidden lg:flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 w-52 xl:w-64 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search projects, checklists..."
            className="bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 w-full"
          />
        </div>
      </div>

      {/* Header Action Items */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Multi-tenant Org Switcher */}
        {currentOrg && orgs.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 transition"
              id="org-switcher-button"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="max-w-[80px] sm:max-w-[120px] truncate font-semibold">{currentOrg.name}</span>
              <span className="hidden sm:inline-block text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase">
                {currentOrg.role}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {showOrgDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 animate-scale-in">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Switch Organization
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        switchOrg(org.id);
                        setShowOrgDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                        org.id === currentOrg.id
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{org.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {org.licensing}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1 px-2">
                  <button
                    onClick={() => {
                      onNavigate('select-org');
                      setShowOrgDropdown(false);
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-2"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    + Create or Join Org
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          id="theme-toggle-btn"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotifications(0)}
          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 relative transition"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-ping" />
          )}
        </button>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'QC'}
            </div>
            <div className="hidden sm:block text-left text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">{user?.name || 'Sarvesh Gupta'}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                {user?.email || 'Inspector'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 animate-scale-in">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  onNavigate('select-org');
                  setShowUserDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Switch Organization
              </button>

              <button
                onClick={() => {
                  logout();
                  setShowUserDropdown(false);
                  onNavigate('login');
                }}
                className="w-full text-left px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 mt-1 border-t border-slate-100 dark:border-slate-800 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

