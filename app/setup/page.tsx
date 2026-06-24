'use client';

import { Settings, Database, CheckCircle2, Code, Zap, GitBranch, Copy } from 'lucide-react';
import { useState } from 'react';

export default function Setup() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const envVars = [
    { key: 'PG_HOST',      value: 'localhost',                                     desc: 'PostgreSQL server hostname',       icon: Database },
    { key: 'PG_PORT',      value: '5432',                                          desc: 'PostgreSQL server port',           icon: Database },
    { key: 'PG_DATABASE',  value: 'digiQC',                                          desc: 'Database name',                    icon: Database },
    { key: 'PG_USER',      value: 'postgres',                                      desc: 'PostgreSQL username',              icon: Database },
    { key: 'PG_PASSWORD',  value: 'root',                                          desc: 'PostgreSQL password',              icon: Database, masked: true },
    { key: 'DATABASE_URL', value: 'postgresql://postgres:root@localhost:5432/digiQC',desc: 'Full connection URL (for tools)',   icon: Database, masked: true },
  ];

  const setupSteps = [
    { num: 1, title: 'Install Dependencies',  cmd: 'npm install',                                  desc: 'Installs Next.js, pg client, XLSX, and UI libraries' },
    { num: 2, title: 'Setup Database',        cmd: 'psql -U postgres -d digiQC -f db/schema.sql',   desc: 'Creates tables and seeds demo data in PostgreSQL' },
    { num: 3, title: 'Configure Environment', cmd: '.env.local is pre-configured',                  desc: 'PostgreSQL credentials are already set in .env.local' },
    { num: 4, title: 'Run Dev Server',        cmd: 'npm run dev',                                  desc: 'Starts Next.js app on http://localhost:3000' },
  ];

  const dbTables = [
    { name: 'organizations',   desc: 'Tenants/Organizations' },
    { name: 'super_admins',    desc: 'Admin users per org' },
    { name: 'teams',           desc: 'Teams within an org' },
    { name: 'projects',        desc: 'Quality control projects' },
    { name: 'checklists',      desc: 'Checklists per project' },
    { name: 'checklist_stages',desc: '2D stages within checklists' },
    { name: 'checkpoints',     desc: 'Checkpoint questions per stage' },
  ];

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-teal-600 to-cyan-500 border-0 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 w-32 h-32 opacity-10">
          <Zap size={180} className="absolute -right-8 -top-8" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-white text-lg">DigiQC Setup & Configuration</h2>
            <p className="text-teal-100 text-xs">Next.js + PostgreSQL — Phase 1</p>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap size={18} className="text-teal-500" />
          Quick Start (4 Steps)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {setupSteps.map((step, i) => (
            <div key={i} className={`card p-5 animate-scale-in stagger-${Math.min(i + 1, 6)}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-500 dark:text-teal-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {step.num}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{step.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{step.desc}</p>
                </div>
              </div>
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2.5 font-mono text-xs text-teal-400 overflow-x-auto">
                $ {step.cmd}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Env Vars */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Code size={18} className="text-blue-500" />
          Environment Variables (.env.local)
        </h3>
        <div className="space-y-3">
          {envVars.map((env, i) => {
            const Icon = env.icon;
            const isCopied = copiedKey === env.key;
            return (
              <div key={i} className={`card p-5 animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm font-mono">{env.key}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{env.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(env.value, env.key)}
                    className="flex-shrink-0 ml-2 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-teal-500/10 text-gray-600 dark:text-gray-400 hover:text-teal-500 flex items-center justify-center transition-all"
                    title="Copy to clipboard"
                  >
                    {isCopied ? <CheckCircle2 size={16} className="text-teal-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-700 dark:text-gray-300 break-all overflow-x-auto">
                  {env.masked ? (
                    <>
                      <span className="text-gray-500">{'*'.repeat(Math.min(env.value.length, 20))}...</span>
                      <button onClick={() => copyToClipboard(env.value, env.key)} className="ml-2 text-teal-500 hover:underline text-[10px]">
                        [Click to copy]
                      </button>
                    </>
                  ) : env.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DB Tables */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Database size={18} className="text-purple-500" />
          Database Tables
        </h3>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {['Table', 'Description'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {dbTables.map((table, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-teal-600 dark:text-teal-400 font-medium">{table.name}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">{table.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Connection Flow */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <GitBranch size={18} className="text-green-500" />
          How It Works
        </h3>
        <div className="card p-6 bg-gray-900 dark:bg-gray-950 rounded-xl border border-gray-800">
          <div className="space-y-4 font-mono text-sm">
            {[
              ['1.', 'Next.js reads .env.local on server startup'],
              ['2.', 'lib/db.ts creates a pg.Pool with the credentials'],
              ['3.', 'App Router pages load at /dashboard, /projects, etc.'],
              ['4.', 'Pages call fetch(\'/api/...\') for data'],
              ['5.', 'API routes in app/api/ query PostgreSQL via pool'],
              ['6.', 'Data returned as JSON, UI updates'],
            ].map(([num, text], i) => (
              <div key={i}>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-teal-400">{num}</span>
                  <span>{text}</span>
                </div>
                {i < 5 && <div className="ml-4 text-gray-500 mt-1">↓</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-500" />
          Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Next.js 14 App Router',
            'PostgreSQL via pg connection pool',
            'Dark/Light mode toggle',
            'Excel/CSV import with bulk processing',
            'Data tables with search & filter',
            'Project image gallery',
            'Status badges (Active/Completed/On Hold)',
            'Team & organization management',
            'Checklist hierarchy (stages & checkpoints)',
            'Responsive design (mobile/tablet/desktop)',
            'Smooth animations & transitions',
            'API routes for all CRUD operations',
          ].map((feature, i) => (
            <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <CheckCircle2 size={14} className="text-teal-500 flex-shrink-0 mt-1" />
              <span className="text-xs text-gray-700 dark:text-gray-300">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="card p-6 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 border border-teal-200 dark:border-teal-500/30">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Next Steps</h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>✓ Run <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">psql -U postgres -d digiQC -f db/schema.sql</code></li>
          <li>✓ Run <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">npm install</code></li>
          <li>✓ Run <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">npm run dev</code></li>
          <li>✓ Browse to <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">http://localhost:3000</code></li>
          <li>✓ Test Excel import on any page</li>
          <li>✓ Deploy with <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">npm run build && npm start</code></li>
        </ul>
      </div>
    </div>
  );
}
