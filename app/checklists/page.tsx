'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, X, Loader2, Upload, ChevronDown, FileDown, Edit2, Copy, Trash2 } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString, parseBoolean } from '@/lib/excelImport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Checklist, Project } from '@/lib/types';

export default function Checklists() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<(Checklist & { project?: { name: string } })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [form, setForm] = useState({ project_id: '', name: '', uom: '', reference_number: '', template_id: '' });
  const [isTemplate, setIsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [clRes, pRes] = await Promise.all([
      fetch('/api/checklists'),
      fetch('/api/projects'),
    ]);
    const cl = await clRes.json();
    const p = await pRes.json();
    setChecklists(cl);
    setProjects(p);
    if (p.length > 0) setForm(f => ({ ...f, project_id: p[0].id }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const proj = projects[0];
      const rows = chunk.map(r => {
        const yn = sanitizeString(r['Type'] || r.yn || 'yes_no');
        return {
          project_id: proj?.id || '',
          name: sanitizeString(r['Checklist Name'] || r.checklist_name || r.name || 'Unnamed'),
          reference_number: sanitizeString(r['REFERENCE NUMBER'] || r.reference_number || ''),
          uom: sanitizeString(r['UOM'] || r.uom || ''),
          stage_name: sanitizeString(r['Stage Name'] || r.stage_name || ''),
          checkpoint: sanitizeString(r['Checkpoint'] || r.checkpoint || ''),
          input_type: yn.trim().toUpperCase() === 'TEXT' ? 'text' : 'yes_no',
          drawing_required: parseBoolean(r['Photo'] ?? r.photo),
          witness_required: parseBoolean(r['Remark'] ?? r.remark),
        };
      });
      const res = await fetch('/api/checklists', {
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
    await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">{checklists.length} checklists</p>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadSampleExcel('checklists')} className="btn-secondary"><FileDown size={15} /> Template</button>
          <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={15} /> Import</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Checklist</button>
        </div>
      </div>

      {!loading && checklists.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Checklists Table</h3>
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
                  <tr className="text-[11px] uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400 w-10">#</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Checklist</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">UOM</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Reference Number</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Updated By</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Updated At</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {checklists.map((c, idx) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/checklists/${c.id}?name=${encodeURIComponent(c.name)}`)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium text-sm">{c.name}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.uom ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.reference_number ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {c.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-sm">{c.updated_by ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {c.updated_at ? new Date(c.updated_at).toLocaleString('en-IN') : new Date(c.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 hover:text-teal-600 transition-colors" title="Edit"><Edit2 size={14} /></button>
                          <button className="p-1 hover:text-teal-600 transition-colors" title="Copy"><Copy size={14} /></button>
                          <button className="p-1 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      )}

      {!loading && checklists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <ClipboardList size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">No checklists yet</p>
          <p className="text-xs mt-1">Create a checklist linked to a project</p>
        </div>
      )}

       {showAdd && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 glass" onClick={() => setShowAdd(false)} />
           <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
             <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
               <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Checklist</h2>
               <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"><X size={16} /></button>
             </div>
             <form onSubmit={handleAdd} className="p-6 space-y-6">
               {/* <div className="flex items-center justify-between">
                 <span className="text-sm text-gray-600 dark:text-gray-400">digiQC Template</span>
                 <button 
                   type="button"
                   onClick={() => setIsTemplate(!isTemplate)}
                   className={`w-11 h-6 rounded-full transition-colors relative ${isTemplate ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                 >
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isTemplate ? 'left-6' : 'left-1'}`} />
                 </button>
               </div> */}

               <div className="space-y-4">
                 {!isTemplate ? (
                   <>
                     <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                         <span className="text-red-500 mr-1">*</span> Name
                       </label>
                       <input 
                         required 
                         className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all" 
                         placeholder="Enter Name" 
                         value={form.name} 
                         onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                       />
                     </div>

                     <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                         <span className="text-red-500 mr-1">*</span> UOM
                       </label>
                       <div className="relative">
                         <select 
                           required
                           className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 appearance-none transition-all" 
                           value={form.uom} 
                           onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                         >
                           <option value="">Select UOM</option>
                           <option value="m">Meters (m)</option>
                           <option value="mm">Millimeters (mm)</option>
                           <option value="kg">Kilograms (kg)</option>
                           <option value="nos">Numbers (nos)</option>
                           <option value="sqm">Square Meters (sqm)</option>
                         </select>
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                           <ChevronDown size={16} />
                         </div>
                       </div>
                     </div>

                     <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reference Number</label>
                       <input 
                         className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all" 
                         placeholder="Reference Number" 
                         value={form.reference_number} 
                         onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} 
                       />
                     </div>
                   </>
                 ) : (
                  ""
                 )}
               </div>

               <div className="flex justify-end gap-3 pt-4">
                 <button 
                   type="button" 
                   onClick={() => setShowAdd(false)} 
                   className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit" 
                   className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2" 
                   disabled={saving}
                 >
                   {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                   {saving ? 'Saving...' : 'Add'}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

      <ImportModal
        isOpen={showImport}
        onClose={() => { setShowImport(false); load(); }}
        title="Import Checklists"
        description="Upload an Excel file with columns: Checklist Name, REFERENCE NUMBER, Stage Name, Checkpoint, Type, Photo, Remark"
        onImport={handleImport}
      />
    </div>
  );
}
