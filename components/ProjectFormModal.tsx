'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { X, Loader2, Plus, Check, XCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Project } from '@/lib/types';
import { getTimezonesList } from './LocationPicker';

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
    <div className="h-[340px] sm:h-[380px] md:h-[420px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center text-xs text-gray-400">
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
  radius_m: 0,
  timezone: 'Asia/Calcutta',
  latitude: 19.1623701,
  longitude: 72.9376316,
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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // Hydrate from `initial` (for edit) or reset to defaults
    setValues({
      name: initial?.name ?? '',
      unique_code: initial?.unique_code ?? initial?.nomenclature ?? '',
      client_name: initial?.client_name ?? '',
      description: initial?.description ?? initial?.instruction ?? '',
      project_admin_id: initial?.project_admin_id ?? '',
      perm_location: initial?.perm_location ?? false,
      perm_authentication: initial?.perm_authentication ?? false,
      perm_rfi: initial?.perm_rfi ?? false,
      radius_m: initial?.radius_m !== undefined && initial?.radius_m !== null ? Number(initial.radius_m) : 0,
      timezone: initial?.timezone || 'Asia/Calcutta',
      latitude: initial?.latitude !== undefined && initial?.latitude !== null ? Number(initial.latitude) : 19.1623701,
      longitude: initial?.longitude !== undefined && initial?.longitude !== null ? Number(initial.longitude) : 72.9376316,
      address: initial?.address ?? '',
      status: (initial?.status as any) ?? 'active',
    });
    setError('');

    // Load org users for the Project Admin dropdown
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setUsers(d) : setUsers([])))
      .catch(() => setUsers([]));
  }, [isOpen, initial]);

  const handleChange = <K extends keyof ProjectFormValues>(
    key: K,
    value: ProjectFormValues[K]
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handleLocation = (lat: number, lng: number, address: string, timezone?: string) => {
    setValues((v) => ({
      ...v,
      latitude: lat,
      longitude: lng,
      address: address || v.address,
      timezone: timezone || v.timezone,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 glass transition-opacity" onClick={onClose} />

      {/* Modal Dialog (2-column layout matching Create Project) */}
      <div className="relative w-full max-w-5xl xl:max-w-6xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-scale-in max-h-[92vh] flex flex-col z-10">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2-column form body matching Image #5 and /projects/new */}
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden min-h-0">

          {/* ── Left Column: Project Details ── */}
          <div className="w-full lg:w-1/2 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
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

              <div>
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

              {/* Permissions */}
              <div>
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Permissions</h4>
                <div className="space-y-2">
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

              {/* Status */}
              <div>
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
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
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
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : projectId ? (
                  <Check size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {saving ? 'Saving…' : projectId ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>

          {/* ── Right Column: Location Details ── */}
          <div className="w-full lg:w-1/2 p-6 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Location Details
            </h3>

            {/* Top row: Radius and TimeZone side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <span className="text-red-500 font-bold mr-1">*</span>Radius (m)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    className="input pr-8 focus:border-red-400 focus:ring-red-400 text-sm font-medium"
                    placeholder="00"
                    value={values.radius_m || ''}
                    onChange={(e) => handleChange('radius_m', parseInt(e.target.value) || 0)}
                  />
                  {values.radius_m > 0 && (
                    <button
                      type="button"
                      onClick={() => handleChange('radius_m', 0)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <span className="text-red-500 font-bold mr-1">*</span>TimeZone
                </label>
                <select
                  className="input text-sm font-medium"
                  value={values.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                >
                  {getTimezonesList().map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Google Map with search box & red radius circle */}
            <div className="pt-1">
              <MapErrorBoundary>
                <LocationPicker
                  apiKey={apiKey}
                  token={process.env.NEXT_PUBLIC_LOCATIONIQ_TOKEN || ''}
                  lat={values.latitude}
                  lng={values.longitude}
                  radius={values.radius_m}
                  timezone={values.timezone}
                  address={values.address}
                  onLocationSelect={handleLocation}
                  onAddressChange={(address) => handleChange('address', address)}
                  onTimezoneChange={(tz) => handleChange('timezone', tz)}
                />
              </MapErrorBoundary>
            </div>

            {/* Bottom row: Latitude and Longitude */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Latitude :
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono select-all">
                  {values.latitude !== null && values.latitude !== undefined
                    ? Number(values.latitude).toFixed(7)
                    : '19.1623701'}
                </span>
              </div>

              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Longitude :
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono select-all">
                  {values.longitude !== null && values.longitude !== undefined
                    ? Number(values.longitude).toFixed(7)
                    : '72.9376316'}
                </span>
              </div>
            </div>
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
    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/40">
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
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
