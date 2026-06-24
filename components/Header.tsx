'use client';

import { Sun, Moon, Bell, Search, User, LogOut, Building2, ChevronDown } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const pathTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/checklists': 'Checklists',
  '/teams': 'Teams',
  '/organizations': 'Organizations',
  '/setup': 'Setup',
};

export default function Header() {
  const { isDark, toggleTheme } = useTheme();
  const { user, currentOrg, orgs, switchOrg, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const title = pathTitles[pathname] ?? 'DigiQC';
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const orgSwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (orgSwitcherRef.current && !orgSwitcherRef.current.contains(e.target as Node)) {
        setShowOrgSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSwitchOrg = async (orgId: string) => {
    await switchOrg(orgId);
    setShowOrgSwitcher(false);
    router.push('/dashboard');
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 transition-colors duration-300">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">DigiQC — Quality Control Platform</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Org Switcher */}
        {currentOrg && orgs.length > 1 && (
          <div className="relative" ref={orgSwitcherRef}>
            <button
              onClick={() => setShowOrgSwitcher(!showOrgSwitcher)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs"
            >
              <Building2 size={14} className="text-teal-500" />
              <span className="max-w-[100px] truncate">{currentOrg.name}</span>
              <ChevronDown size={12} />
            </button>

            {showOrgSwitcher && (
              <div className="absolute right-0 mt-2 w-56 card p-2 shadow-xl z-50">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1.5">Switch Organization</p>
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrg(org.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${org.id === currentOrg.id
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                  >
                    <Building2 size={14} className="flex-shrink-0" />
                    <span className="truncate">{org.name}</span>
                    <span className="ml-auto text-[10px] text-gray-400 capitalize">{org.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-8 pr-4 py-2 w-48 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-500" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-sm cursor-pointer hover:shadow-glow-teal transition-all"
            title={user?.name || 'User'}
          >
            <span className="text-xs font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || <User size={16} className="text-white" />}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 card p-2 shadow-xl z-50">
              {user && (
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              )}
              <button
                onClick={() => { setShowUserMenu(false); router.push('/select-org'); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Building2 size={14} />
                <span>Switch Organization</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
