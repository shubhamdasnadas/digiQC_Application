'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Project } from '@/lib/types';
import { TIMEZONES as TIMEZONE_LIST } from '@/lib/types';

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-200">
          Map unavailable — Google Maps API error (rate limit or invalid key). Enter lat/lng manually below.
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-load the map (uses window/google) — only on the client
const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-xs text-gray-400">
      Loading map…
    </div>
  ),
});

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ProjectFormValues {
  name: string;
  unique_code: string;
  client_name: string;
  description: string;
  project_admin_id: string;
  perm_location: boolean;
  perm_authentication: boolean;
  perm_rfi: boolean;
  radius_m: number;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  status: 'active' | 'completed' | 'on_hold';
}

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial?: Partial<Project>;
  onSaved: () => void;
  /** When set, the modal PATCHes this project id; otherwise it creates a new one. */
  projectId?: string;
}

const DEFAULT_VALUES: ProjectFormValues = {
  name: '',
  unique_code: '',
  client_name: '',
  description: '',
  project_admin_id: '',
  perm_location: false,
  perm_authentication: false,
  perm_rfi: false,
  radius_m: 100,
  timezone: 'Asia/Calcutta',
  latitude: null,
  longitude: null,
  address: '',
  status: 'active',
};

export default function ProjectFormModal({
  isOpen,
  onClose,
  initial,
  onSaved,
  projectId,
}: ProjectFormModalProps) {
  const [values, setValues] = useState<ProjectFormValues>(DEFAULT_VALUES);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    if (!isOpen) return;
    // Hydrate from `initial` (for edit) or reset to defaults
    setValues({
      ...DEFAULT_VALUES,
      ...initial,
      radius_m: initial?.radius_m ?? 100,
      timezone: initial?.timezone ?? 'Asia/Calcutta',
      latitude: initial?.latitude ?? null,
      longitude: initial?.longitude ?? null,
    });
    setError('');
    // Load org users for the Project Admin dropdown
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setUsers(d) : setUsers([]))
      .catch(() => setUsers([]));
  }, [isOpen, initial]);

  const handleChange = <K extends keyof ProjectFormValues>(
    key: K,
    value: ProjectFormValues[K]
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handleLocation = (lat: number, lng: number, address: string) => {
    setValues((v) => ({
      ...v,
      latitude: lat,
      longitude: lng,
      address: address || v.address,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) { setError('Project name is required.'); return; }
    if (!values.unique_code.trim()) { setError('Unique code is required.'); return; }
    if (!values.client_name.trim()) { setError('Client name is required.'); return; }
    if (!values.project_admin_id) { setError('Please select a project admin.'); return; }
    if (!values.radius_m || values.radius_m <= 0) { setError('Radius must be greater than 0.'); return; }

    setSaving(true);
    setError('');

    try {
      const url = projectId ? `/api/projects?id=${projectId}` : '/api/projects';
      const method = projectId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save project');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 glass" onClick={onClose} />
      <div className="relative card w-full max-w-3xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 sticky top-0 bg-white dark:bg-gray-900 z-10 -m-6 p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {projectId ? 'Edit Project' : 'Create New Project'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Fill in the project and site details below
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* ───── Project Details ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              Project Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="NIRMAL BHAVAN CHSL"
                  value={values.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Unique Code <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="NM"
                  value={values.unique_code}
                  onChange={(e) => handleChange('unique_code', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="Pranav Constructions Limited"
                  value={values.client_name}
                  onChange={(e) => handleChange('client_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Select Project Admin <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  value={values.project_admin_id}
                  onChange={(e) => handleChange('project_admin_id', e.target.value)}
                >
                  <option value="">Select Project Admin</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Description
              </label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Project description (optional)"
                value={values.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            {/* ───── Permissions ───── */}
            <div className="mt-4">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Permissions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ToggleRow
                  label="Location"
                  checked={values.perm_location}
                  onChange={(v) => handleChange('perm_location', v)}
                />
                <ToggleRow
                  label="Authentication"
                  checked={values.perm_authentication}
                  onChange={(v) => handleChange('perm_authentication', v)}
                />
                <ToggleRow
                  label="RFI"
                  checked={values.perm_rfi}
                  onChange={(v) => handleChange('perm_rfi', v)}
                />
              </div>
            </div>
          </section>

          {/* ───── Site Details ───── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Site Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Radius (m) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  placeholder="100"
                  value={values.radius_m}
                  onChange={(e) => handleChange('radius_m', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Time Zone <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  value={values.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                >
                  {TIMEZONE_LIST.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Address Search
              </label>
              <MapErrorBoundary>
                <LocationPicker
                  apiKey={apiKey}
                  initialLat={values.latitude}
                  initialLng={values.longitude}
                  onLocationSelect={handleLocation}
                />
              </MapErrorBoundary>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="19.0760"
                  value={values.latitude ?? ''}
                  onChange={(e) =>
                    handleChange('latitude', e.target.value === '' ? null : parseFloat(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="72.8777"
                  value={values.longitude ?? ''}
                  onChange={(e) =>
                    handleChange('longitude', e.target.value === '' ? null : parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
          </section>

          {/* ───── Status (only on edit) ───── */}
          {projectId && (
            <section>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Status
              </label>
              <select
                className="input"
                value={values.status}
                onChange={(e) => handleChange('status', e.target.value as ProjectFormValues['status'])}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </section>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1 sticky bottom-0 bg-white dark:bg-gray-900 -m-6 p-6 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 justify-center"
              disabled={saving}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : projectId ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  );
}
