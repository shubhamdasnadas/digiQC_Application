'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Loader2, Upload, ChevronDown, Calendar, Users, FileDown } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString, parseNumber, parseDate } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Organization } from '@/lib/types';

export default function Organizations() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [form, setForm] = useState({ name: '', user_limit: 10, licensing: 'Starter', expiry_date: '', logo_url: '', console_uses: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch('/api/organizations');
    const data = await res.json();
    setOrgs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const rows = chunk.map(r => ({
        name: sanitizeString(r.name || r.org_name || 'Unnamed'),
        user_limit: parseNumber(r.user_limit || r.users || 10) || 10,
        licensing: sanitizeString(r.licensing || r.license || 'Starter'),
        expiry_date: parseDate(r.expiry_date || r.expiry),
        logo_url: sanitizeString(r.logo_url || r.logo || ''),
        console_uses: parseNumber(r.console_uses || 0) || 0,
      }));
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(await res.text());
    }, data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expiry_date: form.expiry_date || null }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  };

  const licenseColors: Record<string, string> = { Starter: 'badge-active', Professional: 'badge-completed', Enterprise: 'badge-on_hold' };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{orgs.length} organizations</p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadSampleExcel('organizations')} className="btn-secondary"><FileDown size={15} /> Template</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Organization</button>
        </div>
      </div>

      {!loading && orgs.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Organizations Table</h3>
            <button
              onClick={() => setShowTable(!showTable)}
              className="text-teal-600 dark:text-teal-400 text-xs font-medium hover:underline flex items-center gap-1"
            >
              <ChevronDown size={14} className={`transition-transform ${showTable ? 'rotate-180' : ''}`} />
              {showTable ? 'Hide' : 'Show'} Table
            </button>
          </div>
          {showTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {['Organization', 'Licensing', 'Users', 'Expiry', 'Console Uses', 'Created'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {orgs.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{o.name}</td>
                      <td className="px-5 py-3"><span className={`badge ${licenseColors[o.licensing] ?? 'badge-active'} text-xs`}>{o.licensing}</span></td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 flex items-center gap-1"><Users size={14} className="text-gray-400" /> {o.user_limit}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs flex items-center gap-1"><Calendar size={14} className="text-gray-400" /> {o.expiry_date ? new Date(o.expiry_date).toLocaleDateString('en-IN') : 'Unlimited'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{o.console_uses}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAdd(false)} />
          <div className="relative card w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Organization</h2>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Name *</label>
                <input required className="input" placeholder="City Hospital" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">User Limit</label>
                  <input type="number" className="input" value={form.user_limit} onChange={e => setForm(f => ({ ...f, user_limit: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Licensing</label>
                  <select className="input" value={form.licensing} onChange={e => setForm(f => ({ ...f, licensing: e.target.value }))}>
                    <option>Starter</option><option>Professional</option><option>Enterprise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Expiry Date</label>
                <input type="date" className="input" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Logo URL</label>
                <input className="input" placeholder="https://..." value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving...' : 'Add Org'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => { setShowImport(false); load(); }}
        title="Import Organizations"
        description="Upload an Excel or CSV file with columns: name, user_limit, licensing, expiry_date, logo_url, console_uses"
        onImport={handleImport}
      />
    </div>
  );
}
