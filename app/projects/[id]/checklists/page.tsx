'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, X, Loader2, Search, Pencil, Trash2 } from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import DataTable, { type Column } from '@/components/DataTable';
import type { Checklist } from '@/lib/types';

export default function ChecklistsTab() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [libraryChecklists, setLibraryChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Checklist | null>(null);
  const [deleting, setDeleting] = useState<Checklist | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [projRes, libRes] = await Promise.all([
        fetch(`/api/checklists?project_id=${id}`),
        fetch('/api/checklists/library'),
      ]);
      const projData = await projRes.json().catch(() => []);
      const libData = await libRes.json().catch(() => []);

      setChecklists(Array.isArray(projData) ? projData : []);
      setLibraryChecklists(Array.isArray(libData) ? libData : []);
    } catch {
      setChecklists([]);
      setLibraryChecklists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const columns: Column<Checklist>[] = [
    { key: 'idx', header: '#', width: '50px', render: (_r, i) => <span className="text-gray-500 text-xs">{i + 1}</span> },
    {
      key: 'name',
      header: 'Checklist Name',
      render: (c) => (
        <button
          onClick={() => router.push(`/projects/${id}/checklists/${c.id}?name=${encodeURIComponent(c.name)}`)}
          className="text-sm font-medium text-gray-900 dark:text-white hover:text-orange-500 dark:hover:text-orange-400 hover:underline transition-colors text-left"
        >
          {c.name}
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
          {c.status === 'live' ? 'Live' : 'Draft'}
        </span>
      ),
    },
    { key: 'created', header: 'Created', render: (c) => <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</span> },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setEditing(c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-500 dark:hover:bg-orange-500/10 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setDeleting(c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <TabsPageShell
      title="Checklists"
      description="Quality checklists defined for this project"
      onAdd={() => setShowAdd(true)}
      addLabel="Add Checklist"
    >
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-2xl" />)}</div>
      ) : (
        <DataTable columns={columns} rows={checklists} rowKey={(c) => c.id} emptyMessage="No checklists yet" />
      )}

      {showAdd && (
        <AddChecklistModal
          projectId={id}
          libraryChecklists={libraryChecklists}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {editing && (
        <EditChecklistModal
          checklist={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {deleting && (
        <DeleteChecklistModal
          checklist={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); }}
        />
      )}
    </TabsPageShell>
  );
}

function EditChecklistModal({
  checklist,
  onClose,
  onSaved,
}: {
  checklist: Checklist;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(checklist.name);
  const [referenceNumber, setReferenceNumber] = useState(checklist.reference_number || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/checklists/${checklist.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, reference_number: referenceNumber }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to save'); }
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Edit Checklist</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Checklist Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Reference Number</label>
            <input className="input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteChecklistModal({
  checklist,
  onClose,
  onDeleted,
}: {
  checklist: Checklist;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/checklists/${checklist.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete'); }
      onDeleted();
    } catch (e) { setError((e as Error).message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-sm p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delete Checklist</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete <span className="font-medium text-gray-900 dark:text-white">{checklist.name}</span>? This will remove all of its stages and checkpoints from this project. This cannot be undone.
        </p>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="button" onClick={confirmDelete} className="btn-primary !bg-rose-600 hover:!bg-rose-700 flex-1 justify-center" disabled={deleting}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddChecklistModal({
  projectId,
  libraryChecklists: initialLibraryChecklists,
  onClose,
  onSaved,
}: {
  projectId: string;
  libraryChecklists: Checklist[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [libraryList, setLibraryList] = useState<Checklist[]>(initialLibraryChecklists || []);
  const [loadingLib, setLoadingLib] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [name, setName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchLib() {
      setLoadingLib(true);
      try {
        const res = await fetch('/api/checklists/library');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLibraryList(data);
        } else {
          // fallback to all checklists
          const allRes = await fetch('/api/checklists');
          const allData = await allRes.json();
          if (Array.isArray(allData)) {
            setLibraryList(allData);
          }
        }
      } catch {
        // keep initial
      } finally {
        setLoadingLib(false);
      }
    }
    fetchLib();
  }, []);

  const matches = libraryList.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.reference_number && c.reference_number.toLowerCase().includes(q));
  });

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const addProjectChecklist = async (checklistName: string, referenceNo: string, libraryChecklistId?: string) => {
    const res = await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        name: checklistName,
        reference_number: referenceNo,
        library_checklist_id: libraryChecklistId,
      }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to save'); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'existing') {
      const picked = libraryList.find(c => c.id === selectedId);
      if (!picked) { setError('Select a checklist from the library.'); return; }
      setSaving(true);
      try {
        await addProjectChecklist(picked.name, picked.reference_number || '', picked.id);
        onSaved();
      } catch (e) { setError((e as Error).message); }
      finally { setSaving(false); }
      return;
    }

    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const libRes = await fetch('/api/checklists/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, reference_number: referenceNumber }),
      });
      if (!libRes.ok) { const d = await libRes.json().catch(() => ({})); throw new Error(d.error || 'Failed to save to library'); }
      await addProjectChecklist(name, referenceNumber);
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Add Checklist</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-xl bg-gray-100 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'existing' ? 'bg-white dark:bg-gray-950 text-orange-500 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Existing Checklist
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'new' ? 'bg-white dark:bg-gray-950 text-orange-500 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            New Checklist
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'existing' ? (
            loadingLib ? (
              <div className="py-6 flex items-center justify-center text-xs text-gray-500 gap-2">
                <Loader2 size={16} className="animate-spin text-orange-500" />
                <span>Loading existing checklists…</span>
              </div>
            ) : libraryList.length > 0 ? (
              <div ref={searchBoxRef} className="relative">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Checklist *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder="Search checklists by name or reference number…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedId(''); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                  />
                </div>
                {showResults && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg">
                    {matches.length > 0 ? matches.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(c.id);
                          setSearch(c.name);
                          setShowResults(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${selectedId === c.id ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.reference_number && (
                          <div className="text-[11px] text-gray-400 font-mono">{c.reference_number}</div>
                        )}
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-sm text-gray-400">No matches found</p>
                    )}
                  </div>
                )}
                {selectedId && (
                  <div className="mt-2 p-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-medium text-orange-900 dark:text-orange-300">Selected: </span>
                      <span className="text-gray-700 dark:text-gray-300">{libraryList.find(c => c.id === selectedId)?.name}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">No checklists in the library yet. Switch to &quot;New Checklist&quot; to create one.</p>
            )
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Checklist Name *</label>
                <input className="input" placeholder="Pre-pour Concrete Check" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Reference Number</label>
                <input className="input" placeholder="PCPL/EXEC/BEAM-SLB/2026/0001" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving || (mode === 'existing' && !selectedId)}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
