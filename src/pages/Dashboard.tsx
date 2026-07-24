import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FolderKanban,
  CheckSquare,
  Users2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Activity,
  HardHat,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onOpenProjectWorkspace?: (projectId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenProjectWorkspace }) => {
  const { currentOrg, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDashboard()
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [currentOrg]);

  const stats = data?.stats || {
    total_projects: 4,
    active_projects: 3,
    active_checklists: 4,
    total_teams: 3,
    total_eqcs: 3,
    passed_eqcs: 1,
    open_issues: 2,
    critical_issues: 1,
  };

  const chartData = [
    { name: 'Mon', passed: 12, failed: 2, pending: 4 },
    { name: 'Tue', passed: 18, failed: 1, pending: 3 },
    { name: 'Wed', passed: 15, failed: 3, pending: 2 },
    { name: 'Thu', passed: 22, failed: 0, pending: 5 },
    { name: 'Fri', passed: 20, failed: 2, pending: 1 },
    { name: 'Sat', passed: 14, failed: 1, pending: 2 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 px-2.5 py-0.5 rounded-full">
              {currentOrg?.name || 'City Hospital Org'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {user?.name || 'Sarvesh Gupta'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time quality control summary and stage sign-off status across all active construction sites
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('projects')}
            className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-2 transition"
            id="dash-explore-projects"
          >
            <FolderKanban className="w-4 h-4" /> View Projects
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Projects
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total_projects}</div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              {stats.active_projects} Active Sites
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FolderKanban className="w-5 h-5" />
          </div>
        </div>

        {/* Inspections Passed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              EQC Sign-offs
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total_eqcs}</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {stats.passed_eqcs} Passed Cleared
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Active Defects */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Open Punch-List
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.open_issues}</div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
              {stats.critical_issues} Critical Severity
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Active Checklists */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              QC Checklists
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.active_checklists}</div>
            <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mt-1">
              {stats.total_teams} Contractor Teams
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Workspace Split: Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inspection Volume Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Weekly Inspection Sign-off Volume
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Daily stage inspections cleared vs pending</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
              94.2% Pass Rate
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="passed" fill="#6366f1" radius={[4, 4, 0, 0]} name="Passed" />
                <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pending" />
                <Bar dataKey="failed" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Stream (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Recent Field Activities
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Live Sync</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {(data?.recent_activities || []).map((act: any) => (
              <div
                key={act.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg space-y-1 hover:border-slate-200 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">{act.title}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{act.timestamp}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{act.details}</p>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">By {act.user}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Access Recent Projects Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Construction Projects</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Click any project row to open its full QC workspace</p>
          </div>
          <button
            onClick={() => onNavigate('projects')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            All Projects <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Project Name</th>
                <th className="px-4 py-3">Code / Code</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Profile / Discipline</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.recent_projects || []).map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    if (onOpenProjectWorkspace) onOpenProjectWorkspace(p.id);
                    else onNavigate('projects');
                  }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{p.unique_code}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.client_name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-xs">{p.profile}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] uppercase font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
