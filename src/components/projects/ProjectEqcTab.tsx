import React, { useState, useEffect } from 'react';
import { EQC, Checklist } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Plus, Search, Filter, ShieldCheck, AlertCircle, FileCheck2, User, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface ProjectEqcTabProps {
  projectId: string;
}

export const ProjectEqcTab: React.FC<ProjectEqcTabProps> = ({ projectId }) => {
  const [eqcs, setEqcs] = useState<EQC[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // New EQC Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [selectedChecklistId, setSelectedChecklistId] = useState('');
  const [status, setStatus] = useState<'passed' | 'failed' | 'pending' | 'rfi'>('passed');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [eqcData, chkData] = await Promise.all([
        api.getProjectEqcs(projectId),
        api.getChecklists(),
      ]);
      setEqcs(eqcData);
      setChecklists(chkData);
    } catch (err) {
      console.error('Failed to load EQCs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleCreateEqc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation || !selectedChecklistId) return;

    const selectedChk = checklists.find(c => c.id === selectedChecklistId);

    try {
      await api.createProjectEqc(projectId, {
        location: newLocation,
        checklist_id: selectedChecklistId,
        checklist_name: selectedChk?.name || 'Inspection Checklist',
        status,
        notes,
      });
      setIsModalOpen(false);
      setNewLocation('');
      setNotes('');
      loadData();
    } catch (err) {
      console.error('Failed to create EQC:', err);
    }
  };

  const filteredEqcs = eqcs.filter(e => {
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchesSearch =
      e.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.checklist_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Controls & Metrics */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Quick Filter Status Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['all', 'passed', 'pending', 'failed', 'rfi'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                filterStatus === st
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search & Add button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search location or checklist..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full placeholder-slate-500"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20 shrink-0"
            id="log-eqc-btn"
          >
            <Plus className="w-4 h-4" /> Log EQC Inspection
          </button>
        </div>
      </div>

      {/* EQC Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
          Loading Executed Quality Checks...
        </div>
      ) : filteredEqcs.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No inspection records found</p>
          <p className="text-xs text-slate-500 mt-1">Log a new EQC to start quality inspection tracking</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Location / Element</th>
                  <th className="px-4 py-3">Checklist Template</th>
                  <th className="px-4 py-3">Stage Progress</th>
                  <th className="px-4 py-3">Inspector / Approver</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Inspected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEqcs.map(e => (
                  <tr key={e.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-100 flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <div>
                        <div>{e.location}</div>
                        {e.notes && <div className="text-[10px] text-slate-400 italic truncate max-w-xs">{e.notes}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">{e.checklist_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-200">
                          Stage {e.stage_index} of {e.total_stages}
                        </span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${(e.stage_index / e.total_stages) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{e.inspected_by}</span>
                      </div>
                      {e.approver_name && (
                        <div className="text-[10px] text-slate-400">Approved by {e.approver_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(e.inspected_at || e.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add EQC Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Quality Inspection (EQC)">
        <form onSubmit={handleCreateEqc} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Inspection Location / Floor / Flat *</label>
            <input
              type="text"
              required
              placeholder="e.g. 16th Floor Flat 1601 Slab Pour"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Checklist Template *</label>
            <select
              required
              value={selectedChecklistId}
              onChange={e => setSelectedChecklistId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="">-- Choose Inspection Template --</option>
              {checklists.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.reference_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Inspection Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="passed">Passed (Cleared)</option>
              <option value="pending">Pending Review</option>
              <option value="failed">Failed (Action Required)</option>
              <option value="rfi">RFI Escalated</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Inspector Field Notes</label>
            <textarea
              rows={3}
              placeholder="Enter site observations, slump test results, line-level remarks..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-3 text-xs text-slate-100 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-teal-500/20 transition"
            >
              Submit EQC Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
