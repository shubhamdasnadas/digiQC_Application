'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, X, Loader2, Trash2, ChevronDown, ListTree, GripVertical, Pencil,
} from 'lucide-react';
import TabsPageShell from '@/components/TabsPageShell';
import type { NomenclatureTask } from '@/lib/types';

// Tasks are L1. Sub-tasks can nest under any row, up to L6.
const MAX_LEVEL = 6;

export default function NomenclatureTab() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<NomenclatureTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [subtaskParent, setSubtaskParent] = useState<{ node: NomenclatureTask; level: number } | null>(null);
  const [editing, setEditing] = useState<{ node: NomenclatureTask; level: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/nomenclature`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // Root-level tasks (parent_id NULL, L1), sorted by sr_no
  const tasks = useMemo(
    () =>
      items
        .filter((i) => !i.parent_id)
        .slice()
        .sort((a, b) => (a.sr_no || 0) - (b.sr_no || 0)),
    [items]
  );

  // parent_id -> sorted children, works for ANY depth (task -> sub-task -> sub-sub-task ... up to L6)
  const childrenOf = useMemo(() => {
    const map = new Map<string, NomenclatureTask[]>();
    for (const i of items) {
      if (!i.parent_id) continue;
      map.set(i.parent_id, [...(map.get(i.parent_id) ?? []), i]);
    }
    for (const [key, subs] of map) {
      map.set(key, subs.slice().sort((a, b) => (a.sr_no || 0) - (b.sr_no || 0)));
    }
    return map;
  }, [items]);

  const toggle = (taskId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });

  // Recursively collect all descendant ids so delete cleans up the whole subtree
  const collectDescendants = (itemId: string): NomenclatureTask[] => {
    const direct = childrenOf.get(itemId) ?? [];
    return direct.reduce<NomenclatureTask[]>(
      (acc, child) => [...acc, child, ...collectDescendants(child.id)],
      []
    );
  };

  const remove = async (item: NomenclatureTask) => {
    const descendants = collectDescendants(item.id);
    if (
      descendants.length > 0 &&
      !window.confirm(
        `Delete "${item.name}" along with its ${descendants.length} sub-item${descendants.length > 1 ? 's' : ''}?`
      )
    ) return;

    const removedIds = new Set([item.id, ...descendants.map((s) => s.id)]);
    setItems((prev) => prev.filter((p) => !removedIds.has(p.id)));
    await fetch(`/api/projects/${id}/nomenclature?entry_id=${item.id}`, { method: 'DELETE' });
  };

  return (
    <TabsPageShell
      title="Nomenclature"
      description="Tasks and sub-tasks defining this project's work nomenclature (up to 6 levels deep)"
      onAdd={() => setShowAddTask(true)}
      addLabel="Add Task"
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card p-12 text-center text-sm text-gray-400">
          <ListTree size={40} className="mx-auto mb-3 opacity-30" />
          No tasks defined yet — click "Add Task" to create the first one
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* ─── L0 root row ─── */}
          <TreeRow level={0} label="Project Nomenclature" hasChildren expanded />

          {tasks.map((t, idx) => (
            <NomenclatureNode
              key={t.id}
              node={t}
              level={1}
              srNo={t.sr_no || idx + 1}
              childrenOf={childrenOf}
              collapsed={collapsed}
              onToggle={toggle}
              onAddChild={(node, level) => setSubtaskParent({ node, level })}
              onEdit={(node, level) => setEditing({ node, level })}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      {showAddTask && (
        <TaskModal
          projectId={id}
          level={1}
          onClose={() => setShowAddTask(false)}
          onSaved={() => { setShowAddTask(false); load(); }}
        />
      )}
      {subtaskParent && (
        <TaskModal
          projectId={id}
          parent={subtaskParent.node}
          level={subtaskParent.level + 1}
          onClose={() => setSubtaskParent(null)}
          onSaved={() => {
            const pid = subtaskParent.node.id;
            setSubtaskParent(null);
            // Reveal the parent's children after adding
            setCollapsed((prev) => { const n = new Set(prev); n.delete(pid); return n; });
            load();
          }}
        />
      )}
      {editing && (
        <TaskModal
          projectId={id}
          existing={editing.node}
          level={editing.level}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </TabsPageShell>
  );
}

/* ────────────────────────────────────────────────────────────────
   NomenclatureNode — renders one row + recursively renders its
   children at level+1, up to MAX_LEVEL (L6). "Add sub-task" is
   hidden once a row is already at L6, since it can't nest further.
   ──────────────────────────────────────────────────────────────── */
function NomenclatureNode({
  node,
  level,
  srNo,
  childrenOf,
  collapsed,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: NomenclatureTask;
  level: number;
  srNo: number;
  childrenOf: Map<string, NomenclatureTask[]>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parent: NomenclatureTask, level: number) => void;
  onEdit: (item: NomenclatureTask, level: number) => void;
  onDelete: (item: NomenclatureTask) => void;
}) {
  const subs = childrenOf.get(node.id) ?? [];
  const isCollapsed = collapsed.has(node.id);
  const canAddChild = level < MAX_LEVEL;

  return (
    <>
      <TreeRow
        level={level}
        srNo={srNo}
        label={node.name}
        description={node.description}
        hasChildren={subs.length > 0}
        expanded={!isCollapsed}
        onToggle={subs.length > 0 ? () => onToggle(node.id) : undefined}
        onAddChild={canAddChild ? () => onAddChild(node, level) : undefined}
        onEdit={() => onEdit(node, level)}
        onDelete={() => onDelete(node)}
      />

      {!isCollapsed &&
        subs.map((s, si) => (
          <NomenclatureNode
            key={s.id}
            node={s}
            level={level + 1}
            srNo={s.sr_no || si + 1}
            childrenOf={childrenOf}
            collapsed={collapsed}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   TreeRow — one line of the nomenclature tree at any depth.
   Level 0 = project root (static, no actions)
   Level 1-6 = task / sub-task / ... (add child up to L6, edit, delete)
   ──────────────────────────────────────────────────────────────── */
function TreeRow({
  level,
  srNo,
  label,
  description,
  hasChildren = false,
  expanded = false,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  level: number;
  srNo?: number;
  label: string;
  description?: string;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAddChild?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const levelLabel = `L${level}`;
  const indent = level * 24; // px per level

  const levelColors = [
    'text-emerald-500', 'text-teal-500', 'text-sky-500',
    'text-violet-500', 'text-amber-500', 'text-rose-500', 'text-fuchsia-500',
  ];
  const levelColor = levelColors[Math.min(level, levelColors.length - 1)];

  return (
    <div
      className="group flex items-center gap-2 pr-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/40"
      style={{ paddingLeft: 12 + indent }}
    >
      {/* drag handle */}
      <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab" />

      {/* expand/collapse chevron */}
      {hasChildren && onToggle ? (
        <button
          onClick={onToggle}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0"
        >
          <ChevronDown size={14} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}

      {/* checkbox */}
      <input
        type="checkbox"
        disabled={level === 0}
        className="w-3.5 h-3.5 rounded border-gray-300 shrink-0 accent-teal-500"
      />

      {/* level + sr no + label */}
      <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
        <span className={`text-xs font-mono font-semibold shrink-0 ${levelColor}`}>
          {levelLabel}{srNo != null ? `.${srNo}` : ''}
        </span>
        <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">-</span>
        <span
          className={`truncate ${
            level === 0
              ? 'text-sm font-bold text-gray-900 dark:text-white'
              : level === 1
                ? 'text-sm font-semibold text-gray-800 dark:text-gray-100'
                : 'text-sm text-gray-700 dark:text-gray-300'
          }`}
        >
          {label}
        </span>
        {description && (
          <span className="text-xs text-gray-400 truncate hidden sm:inline">— {description}</span>
        )}
      </div>

      {/* actions: every real row (level >= 1) gets Edit, Delete; Add sub-item only below MAX_LEVEL */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {onAddChild && (
          <button
            onClick={onAddChild}
            title="Add sub-task"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-teal-50 hover:text-teal-500 dark:hover:bg-teal-500/10"
          >
            <Plus size={13} />
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            title="Edit"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-teal-500 dark:hover:bg-gray-800"
          >
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            title="Delete"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function TaskModal({
  projectId,
  parent,
  existing,
  level,
  onClose,
  onSaved,
}: {
  projectId: string;
  parent?: NomenclatureTask | null;
  existing?: NomenclatureTask | null;
  level: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    sr_no: existing?.sr_no ?? 0,
    status: (existing?.status ?? 'active') as NomenclatureTask['status'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const title = isEdit
    ? `Edit ${existing?.parent_id ? `Sub-task (L${level})` : 'Task'}`
    : parent
      ? `Add Sub-task (L${level})`
      : 'Add Task';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/nomenclature`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { id: existing!.id, ...form }
            : { ...form, parent_id: parent?.id ?? null }
        ),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {parent && !isEdit && (
              <p className="text-xs text-gray-500 mt-0.5">
                Under: <span className="font-medium text-teal-600 dark:text-teal-400">{parent.name}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Name *
            </label>
            <input
              className="input"
              placeholder={parent ? 'e.g. Pouring of concrete' : 'e.g. Foundation work'}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Description
            </label>
            <textarea
              className="input min-h-[72px] resize-y"
              placeholder="Optional details about this item"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className={`grid gap-3 ${isEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Sr. No. <span className="text-gray-400 font-normal">(0 = auto)</span>
              </label>
              <input
                type="number"
                min={0}
                className="input"
                value={form.sr_no}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sr_no: Math.max(0, parseInt(e.target.value) || 0) }))
                }
              />
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Status
                </label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as NomenclatureTask['status'] }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}