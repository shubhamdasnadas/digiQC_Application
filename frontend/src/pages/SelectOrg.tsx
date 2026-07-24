import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Building2, Plus, ArrowRight, ShieldCheck, Layers, Loader2 } from 'lucide-react';

interface SelectOrgProps {
  onNavigate: (page: string) => void;
}

export const SelectOrg: React.FC<SelectOrgProps> = ({ onNavigate }) => {
  const { user, orgs, switchOrg, joinOrg } = useAuth();
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgLicensing, setNewOrgLicensing] = useState<'Starter' | 'Professional' | 'Enterprise'>('Enterprise');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    api.getOrganizations()
      .then(res => setAllOrgs(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectOrg = async (orgId: string) => {
    try {
      await switchOrg(orgId);
      onNavigate('dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName) return;

    setIsCreating(true);
    try {
      const created = await api.createOrganization({
        name: newOrgName,
        licensing: newOrgLicensing,
        user_limit: newOrgLicensing === 'Enterprise' ? 50 : 20,
      });

      await joinOrg(created.id, 'admin');
      onNavigate('dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#f3f4f6] text-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-8 animate-scale-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Select Tenant Organization</h2>
          <p className="text-xs text-slate-500">
            Welcome, <strong className="text-slate-800">{user?.name}</strong>. Choose an organization to activate.
          </p>
        </div>

        {/* Multi-Tenant Choice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Joined Organizations */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Your Assigned Organizations
            </h3>

            {orgs.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-xs text-slate-500">You are not linked to any organization yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Create a new organization on the right to start.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {orgs.map(org => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                        {org.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                        <span className="bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">
                          Role: {org.role}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span>{org.licensing} Tier</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Create New Organization */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200 pt-6 md:pt-0 md:pl-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create New Organization
            </h3>

            <form onSubmit={handleCreateOrg} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Infrastructure Pvt Ltd"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
                  id="create-org-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Licensing Plan</label>
                <select
                  value={newOrgLicensing}
                  onChange={e => setNewOrgLicensing(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
                >
                  <option value="Enterprise">Enterprise Tier (50 Engineers, Full Analytics)</option>
                  <option value="Professional">Professional Tier (20 Engineers)</option>
                  <option value="Starter">Starter Tier (10 Engineers)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xs flex items-center justify-center gap-2 transition"
                id="create-org-submit-btn"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Create & Activate Org</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
