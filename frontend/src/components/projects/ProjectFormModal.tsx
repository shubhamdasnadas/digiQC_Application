import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Project } from '../../types';
import { MapPin, Shield, Clock, FileText, Loader2 } from 'lucide-react';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Project>) => Promise<void>;
  initialData?: Project | null;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    unique_code: '',
    client_name: '',
    nomenclature: '',
    profile: '',
    instruction: '',
    description: '',
    radius_m: 100,
    timezone: 'Asia/Calcutta',
    latitude: 19.0760,
    longitude: 72.8777,
    address: 'Powai, Mumbai, MH',
    perm_location: true,
    perm_authentication: true,
    perm_rfi: true,
    status: 'active',
  });

  const [isSubmitting, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        unique_code: `PCPL-PROJ-${Math.floor(100 + Math.random() * 900)}`,
        client_name: '',
        nomenclature: 'PRJ-01',
        profile: 'Civil Structural & Finishing',
        instruction: 'Execute mandatory stage inspections prior to concrete pour.',
        description: '',
        radius_m: 100,
        timezone: 'Asia/Calcutta',
        latitude: 19.0760,
        longitude: 72.8777,
        address: 'Mumbai, Maharashtra',
        perm_location: true,
        perm_authentication: true,
        perm_rfi: true,
        status: 'active',
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.unique_code) {
      setError('Project Name and Unique Code are required.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await onSubmit(formData);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      setIsProcessing(false);
      setError(err.message || 'Failed to save project');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Edit Project: ${initialData.name}` : 'Add New Project'}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Two-Column Grid: Details on Left, Site Coordinates on Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Project Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <FileText className="w-3.5 h-3.5" /> Project Information
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Project Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. AURORA Tower A"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                id="proj-input-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Unique Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PCPL-AUR-2025"
                  value={formData.unique_code || ''}
                  onChange={e => setFormData({ ...formData, unique_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
                  id="proj-input-code"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nomenclature</label>
                <input
                  type="text"
                  placeholder="e.g. AUR-T1"
                  value={formData.nomenclature || ''}
                  onChange={e => setFormData({ ...formData, nomenclature: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Client Name</label>
              <input
                type="text"
                placeholder="e.g. Sunrise Realty Corp"
                value={formData.client_name || ''}
                onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Profile / Discipline</label>
              <input
                type="text"
                placeholder="e.g. Civil Structural, High-Rise MEP"
                value={formData.profile || ''}
                onChange={e => setFormData({ ...formData, profile: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Instruction / Guidelines</label>
              <textarea
                rows={2}
                placeholder="Specific instructions for site QC engineers..."
                value={formData.instruction || ''}
                onChange={e => setFormData({ ...formData, instruction: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-3 text-xs text-slate-100 outline-none resize-none"
              />
            </div>
          </div>

          {/* Column 2: Site Location & Feature Permissions */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <MapPin className="w-3.5 h-3.5" /> Site Coordinates & Permissions
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Site Address</label>
              <input
                type="text"
                placeholder="e.g. Sector 18, Powai, Mumbai"
                value={formData.address || ''}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Geofence (m)</label>
                <input
                  type="number"
                  value={formData.radius_m || 100}
                  onChange={e => setFormData({ ...formData, radius_m: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.latitude || 19.0760}
                  onChange={e => setFormData({ ...formData, latitude: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.longitude || 72.8777}
                  onChange={e => setFormData({ ...formData, longitude: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Timezone</label>
              <select
                value={formData.timezone || 'Asia/Calcutta'}
                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              >
                <option value="Asia/Calcutta">Asia/Calcutta (IST +05:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                <option value="Europe/London">Europe/London (GMT +00:00)</option>
                <option value="America/New_York">America/New_York (EST -05:00)</option>
              </select>
            </div>

            {/* Feature Toggles */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project Feature Toggles</span>
              
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Location Verification Enforcement</span>
                <input
                  type="checkbox"
                  checked={formData.perm_location}
                  onChange={e => setFormData({ ...formData, perm_location: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Biometric / Auth Sign-off</span>
                <input
                  type="checkbox"
                  checked={formData.perm_authentication}
                  onChange={e => setFormData({ ...formData, perm_authentication: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Enable RFI Defect Auto-escalation</span>
                <input
                  type="checkbox"
                  checked={formData.perm_rfi}
                  onChange={e => setFormData({ ...formData, perm_rfi: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-teal-500/20 flex items-center gap-2 transition"
            id="submit-project-form-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : initialData ? (
              'Update Project'
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
