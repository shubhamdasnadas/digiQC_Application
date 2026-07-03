'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { TIMEZONES as TIMEZONE_LIST } from '@/lib/types';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
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

interface FormValues {
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
}

const DEFAULTS: FormValues = {
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
};

export default function NewProjectPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(DEFAULTS);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setUsers(d) : setUsers([])))
      .catch(() => setUsers([]));
  }, []);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleLocation = (lat: number, lng: number, address: string) =>
    setValues((v) => ({ ...v, latitude: lat, longitude: lng, address: address || v.address }));

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
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create project');
      }
      router.push('/projects');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => router.push('/projects')}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Project</h1>
          <p className="text-xs text-gray-500 mt-0.5">Fill in the project and site details below</p>
        </div>
      </div>

      {/* Two-column body */}
      <form onSubmit={handleSubmit} className="flex flex-1 overflow-hidden">
        {/* ── Left: Project Details ── */}
        <div className="w-1/2 overflow-y-auto p-8 border-r border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            Project Details
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  placeholder="NIRMAL BHAVAN CHSL"
                  value={values.name}
                  onChange={(e) => set('name', e.target.value)}
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
                  onChange={(e) => set('unique_code', e.target.value)}
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
                onChange={(e) => set('client_name', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Project Admin <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={values.project_admin_id}
                onChange={(e) => set('project_admin_id', e.target.value)}
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
                rows={3}
                placeholder="Project description (optional)"
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Permissions</h3>
              <div className="space-y-2">
                <ToggleRow label="Location" checked={values.perm_location} onChange={(v) => set('perm_location', v)} />
                <ToggleRow label="Authentication" checked={values.perm_authentication} onChange={(v) => set('perm_authentication', v)} />
                <ToggleRow label="RFI" checked={values.perm_rfi} onChange={(v) => set('perm_rfi', v)} />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mt-4">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => router.push('/projects')}
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
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </div>

        {/* ── Right: Site Details ── */}
        <div className="w-1/2 overflow-y-auto p-8 bg-white dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Site Details
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                  onChange={(e) => set('radius_m', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Time Zone <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  value={values.timezone}
                  onChange={(e) => set('timezone', e.target.value)}
                >
                  {TIMEZONE_LIST.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Address / Location
              </label>
              <LocationPicker
                apiKey={apiKey}
                initialLat={values.latitude}
                initialLng={values.longitude}
                onLocationSelect={handleLocation}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                    set('latitude', e.target.value === '' ? null : parseFloat(e.target.value))
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
                    set('longitude', e.target.value === '' ? null : parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </form>
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
