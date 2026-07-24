import React, { useState, useEffect } from 'react';
import { Checklist } from '../types';
import { api } from '../services/api';
import { ChecklistBuilder } from '../components/checklists/ChecklistBuilder';
import { ImportModal } from '../components/common/ImportModal';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  CheckSquare,
  Plus,
  FileSpreadsheet,
  Search,
  Layers,
  CheckCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

interface ChecklistsProps {
  initialBuilderChecklistId?: string | null;
}

export const Checklists: React.FC<ChecklistsProps> = ({ initialBuilderChecklistId }) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Builder View State
  const [activeBuilderId, setActiveBuilderId] = useState<string | null>(initialBuilderChecklistId || null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uom, setUom] = useState('Sq. Ft');

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const data = await api.getChecklists();
      setChecklists(data);
    } catch (err) {
      console.error('Failed to load checklists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChecklists();
  }, []);

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const created = await api.createChecklist({
        name,
        reference_number: referenceNumber || `CHK-REF-${Math.floor(100 + Math.random() * 900)}`,
        uom,
        status: 'active',
        source: 'library',
      });
      setIsFormModalOpen(false);
      setName('');
      setReferenceNumber('');
      loadChecklists();
      setActiveBuilderId(created.id);
    } catch (err) {
      console.error('Failed to create checklist:', err);
    }
  };

  const handleImportChecklists = async (rows: any[]) => {
    for (const row of rows) {
      await api.createChecklist({
        name: row.Name || row['Checklist Name'] || 'Imported Quality Checklist',
        reference_number: row['Ref No'] || `CHK-IMP-${Math.floor(100 + Math.random() * 900)}`,
        uom: row.UOM || 'Sq. Mtr',
        status: 'active',
        source: 'library',
      });
    }
    loadChecklists();
  };

  const filteredChecklists = checklists.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.reference_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If builder mode is active, render the 2-pane stage & checkpoint builder
  if (activeBuilderId) {
    return (
      <div className="max-w-7xl mx-auto">
        <ChecklistBuilder
          checklistId={activeBuilderId}
          onBack={() => {
            setActiveBuilderId(null);
            loadChecklists();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 w-full md:w-80 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search checklists or reference no..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full placeholder-slate-400"
            id="search-checklists-input"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            id="import-checklists-btn"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            Import
          </button>

          <button
            onClick={() => setIsFormModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition shadow-xs"
            id="add-checklist-btn"
          >
            <Plus className="w-4 h-4" /> Create Checklist
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs animate-pulse">Loading Global Checklists...</div>
      ) : filteredChecklists.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200 space-y-3 shadow-sm">
          <CheckSquare className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-slate-900">No Checklists Found</p>
          <p className="text-xs text-slate-500">Create a master checklist or import standard template sets</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChecklists.map(c => (
            <div
              key={c.id}
              onClick={() => setActiveBuilderId(c.id)}
              className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <Badge status={c.status} />
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {c.name}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                    {c.reference_number}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <strong>{c.stages_count || 3}</strong> Stages
                </span>
                <span className="flex items-center gap-1 font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  Configure Stages <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Checklist Modal */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title="Create Inspection Checklist Standard">
        <form onSubmit={handleCreateChecklist} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Checklist Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Pre-Pour Concrete Slab Quality Standard"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reference Code / Standard ID</label>
              <input
                type="text"
                placeholder="e.g. IS-456-CONC-01"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measurement (UOM)</label>
              <input
                type="text"
                value={uom}
                onChange={e => setUom(e.target.value)}
                placeholder="Sq. Ft, Cu. Mtr, Items"
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition"
            >
              Build Stages
            </button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityName="Checklists"
        onImportSubmit={handleImportChecklists}
      />
    </div>
  );
};
