'use client';

import { useEffect, useState } from 'react';
import {
  FolderKanban, ClipboardList, Users,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Activity,
} from 'lucide-react';
import type { Project, Team, Checklist } from '@/lib/types';

interface Stats {
  projects: number;
  checklists: number;
  teams: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplay(value);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{display}</span>;
}

const statConfig = [
  { label: 'Total Projects', key: 'projects' as keyof Stats, icon: FolderKanban, bg: 'bg-teal-500/10', text: 'text-teal-500 dark:text-teal-400', change: '+12%' },
  { label: 'Active Checklists', key: 'checklists' as keyof Stats, icon: ClipboardList, bg: 'bg-blue-500/10', text: 'text-blue-500 dark:text-blue-400', change: '+8%' },
  { label: 'Teams', key: 'teams' as keyof Stats, icon: Users, bg: 'bg-violet-500/10', text: 'text-violet-500 dark:text-violet-400', change: '+2' },
];

const activityFeed = [
  { icon: CheckCircle2, color: 'text-teal-400', text: 'Block-A Foundation checklist completed', time: '2 min ago' },
  { icon: FolderKanban, color: 'text-blue-400', text: 'New project MEP Phase 2 added', time: '18 min ago' },
  { icon: Users, color: 'text-violet-400', text: 'QC Team Beta onboarded', time: '1 hr ago' },
  { icon: AlertCircle, color: 'text-amber-400', text: 'HVAC Commissioning put on hold', time: '3 hr ago' },
  { icon: ClipboardList, color: 'text-teal-400', text: 'Rooftop WP stage 3 checkpoint passed', time: '5 hr ago' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ projects: 0, checklists: 0, teams: 0 });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      const data = await res.json();
      setStats(data.stats ?? { projects: 0, checklists: 0, teams: 0 });
      setRecentProjects(data.recentProjects ?? []);
      setTeams(data.teams ?? []);
      setChecklists(data.checklists ?? []);
    } catch {
      // Silently fail — user may not have an org selected
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { active: 'badge-active', completed: 'badge-completed', on_hold: 'badge-on_hold' };
    const label: Record<string, string> = { active: 'Active', completed: 'Completed', on_hold: 'On Hold' };
    return <span className={`badge ${map[status] ?? 'badge-active'}`}>{label[status] ?? status}</span>;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="card p-6 bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 border-0 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10">
          <Activity size={220} className="absolute -right-8 -top-8 animate-pulse-slow" />
        </div>
        <div className="relative">
          <p className="text-teal-100 text-sm font-medium mb-1">Welcome back</p>
          <h2 className="text-2xl font-bold mb-1">Valid8 Dashboard</h2>
          <p className="text-teal-100 text-sm">Quality Control Platform</p>
        </div>
        <div className="absolute bottom-4 right-6 flex items-center gap-2 text-teal-100 text-xs">
          <Clock size={12} />
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statConfig.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={`card card-hover p-5 animate-slide-up stagger-${i + 1}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <Icon size={20} className={s.text} />
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400">
                  <TrendingUp size={11} /> {s.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white count-animate">
                {loading ? <span className="skeleton w-12 h-8 inline-block" /> : <AnimatedNumber value={stats[s.key]} />}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <div className="card p-5 animate-slide-up stagger-3">
        <div className="flex items-center gap-2 mb-4">
          <FolderKanban size={18} className="text-teal-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Projects</h3>
          <span className="text-xs text-gray-400 ml-auto">{recentProjects.length} projects</span>
        </div>
        {recentProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {['Name', 'Code', 'Profile', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentProjects.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.nomenclature}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{p.profile}</td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">No projects yet. Create one to get started.</p>
        )}
      </div>

      {/* Activity Feed */}
      <div className="card p-5 animate-slide-up stagger-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {activityFeed.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Icon size={13} className={item.color} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
