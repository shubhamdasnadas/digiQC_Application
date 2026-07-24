import React, { useState, useEffect } from 'react';
import { Organization } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Building2, Plus, Users, Shield, Check, ArrowRight } from 'lucide-react';

export const Organizations: React.FC = () => {
  const { currentOrg, switchOrg, joinOrg } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [licensing, setLicensing] = useState<'Starter' | 'Professional' | 'Enterprise'>('Enterprise');

  const loadOrgs = async () => {
    try {
      setLoading(true);
      const data = await api.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const created = await api.createOrganization({
        name,
        licensing,
        user_limit: licensing === 'Enterprise' ? 50 : 20,
      });
      await joinOrg(created.id, 'admin');
      setIsModalOpen(false);
      setName('');
      loadOrgs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Multi-Tenant Organization Accounts</h2>
          <p className="text-xs text-slate-500">Schema-isolated enterprise tenant spaces and user limit allocations</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition shadow-xs"
          id="add-org-btn"
        >
          <Plus className="w-4 h-4" /> Create Organization
        </button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs animate-pulse">Loading Organizations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map(org => {
            const isCurrent = currentOrg?.id === org.id;
            return (
              <div
                key={org.id}
                className={`p-6 rounded-xl border transition shadow-sm flex flex-col justify-between space-y-5 ${
                  isCurrent
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      <Building2 className="w-6 h-6" />
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active Session
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-1">
                    <h3 className="text-base font-bold text-slate-900">{org.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                        {org.licensing} Tier
                      </span>
                      <span>•</span>
                      <span>Max {org.user_limit || 50} Engineers</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Projects: <strong className="text-slate-800">5 Active Sites</strong>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => switchOrg(org.id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg flex items-center gap-1 transition"
                    >
                      <span>Switch To</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Provision New Enterprise Tenant Organization">
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Organization / Enterprise Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Shapoorji Pallonji Constructions"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Licensing Tier</label>
            <select
              value={licensing}
              onChange={e => setLicensing(e.target.value as any)}
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
            >
              <option value="Enterprise">Enterprise (50 Users, Custom EQC Rules)</option>
              <option value="Professional">Professional (20 Users)</option>
              <option value="Starter">Starter (10 Users)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition"
            >
              Provision Tenant
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
