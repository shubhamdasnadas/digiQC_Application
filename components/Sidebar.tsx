'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FolderKanban, ClipboardList, Users, Building2,
  Settings, ChevronLeft, ChevronRight, Zap, CheckSquare, LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/setup', label: 'Setup', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOrg, user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside
      className={`
        relative flex flex-col h-screen
        bg-gray-950 border-r border-gray-800
        transition-all duration-300 ease-in-out flex-shrink-0
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-glow-teal">
          <CheckSquare size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <span className="text-base font-bold text-white tracking-tight">Valid<span className="text-teal-400">8</span></span>
            <p className="text-[10px] text-gray-500 -mt-0.5 font-medium tracking-widest uppercase">Quality Control</p>
          </div>
        )}
      </div>

      {/* Org Info */}
      {currentOrg && !collapsed && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 rounded-xl">
            <Building2 size={14} className="text-teal-400" />
            <div className="min-w-0">
              <p className="text-xs text-teal-400 font-medium truncate">{currentOrg.name}</p>
              <p className="text-[10px] text-gray-500 capitalize">{currentOrg.role}</p>
            </div>
          </div>
        </div>
      )}

      {collapsed && currentOrg && (
        <div className="px-2 py-3 border-b border-gray-800 flex justify-center">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <Building2 size={14} className="text-teal-400" />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`
                nav-item w-full
                ${isActive ? 'nav-item-active' : 'nav-item-inactive'}
                ${collapsed ? 'justify-center px-2' : ''}
              `}
            >
              <Icon size={18} className={isActive ? 'text-teal-400' : ''} />
              {!collapsed && <span>{label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-gray-800">
        {user && !collapsed && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-300 font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        <div className={`nav-logout-container ${collapsed ? 'px-2' : 'px-4'} pb-3`}>
          <button
            onClick={handleLogout}
            className={`nav-item nav-item-inactive w-full ${collapsed ? 'justify-center px-2' : ''}`}
            title="Logout"
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-teal-400 hover:border-teal-500 transition-all duration-200 z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
