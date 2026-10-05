'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, Loader2, Upload, ChevronDown, Download, Search, Edit2, Trash2, FileDown } from 'lucide-react';
import ImportModal from '@/components/ImportModal';
import AddMemberModal from '@/components/AddMemberModal';
import { bulkInsertWithChunking, type ParsedRow, type ImportResult, sanitizeString, parseBoolean, getField } from '@/lib/excelImport';
import { exportToXlsx } from '@/lib/excelExport';
import { downloadSampleExcel } from '@/lib/excelTemplate';
import type { Member, Organization } from '@/lib/types';

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterAccessType, setFilterAccessType] = useState('All');
  const [filterTeam, setFilterTeam] = useState('All');

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, oRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/organizations'),
      ]);
      const m = await mRes.json();
      const o = await oRes.json();
      setMembers(Array.isArray(m) ? m : []);
      setOrgs(Array.isArray(o) ? o : []);
    } catch (err) {
      console.error('Failed to load members data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (data: ParsedRow[]): Promise<ImportResult> => {
    return bulkInsertWithChunking(async (chunk) => {
      const org = orgs[0];
      const rows = chunk.map(r => {
        const name = sanitizeString(getField(r, 'Name', 'name', 'User', 'user', 'Member', 'member', 'userName', 'username'));
        const email = sanitizeString(getField(r, 'Email', 'email', 'Mail', 'mail', 'Email ID', 'email_id'));
        const phone = sanitizeString(getField(r, 'Phone No', 'Phone', 'phone', 'Phone Number', 'phone_number', 'Mobile No', 'mobile_no', 'Mobile Number', 'Contact', 'contact'));
        const accessType = sanitizeString(getField(r, 'Access Type', 'access_type', 'Access', 'access', 'Type', 'type') || 'Paid');
        const activeRaw = getField(r, 'Active', 'active', 'Status', 'status', 'Is Active', 'is_active');
        const defaultRole = sanitizeString(getField(r, 'Default Role', 'default_role', 'Role', 'role') || 'User');
        const teams = sanitizeString(getField(r, 'Team', 'team', 'Teams', 'teams', 'Assigned Team', 'assigned_team'));
        const activeProjects = sanitizeString(getField(r, 'Active Assigned Projects', 'Active Projects', 'active_projects', 'active_assigned_projects'));
        const inactiveProjects = sanitizeString(getField(r, 'Inactive Assigned Projects', 'Inactive Projects', 'inactive_projects', 'inactive_assigned_projects'));

        return {
          organization_id: org?.id || null,
          name: name || 'Unnamed',
          email,
          phone,
          access_type: accessType || 'Paid',
          active: activeRaw !== undefined && activeRaw !== null && activeRaw !== '' ? parseBoolean(activeRaw) : true,
          default_role: defaultRole || 'User',
          teams,
          active_projects: activeProjects,
          inactive_projects: inactiveProjects,
        };
      }).filter(r => r.name && r.name !== 'Unnamed');

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (await res.text()) || 'Failed to import members');
      }
    }, data);
  };

  const handleDelete = async (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete member "${m.name}"?`)) return;
    try {
      const res = await fetch(`/api/members?id=${m.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete member');
      load();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete member.');
    }
  };

  const filteredMembers = members.filter(m => {
    const q = (searchTerm || '').trim().toLowerCase();
    const name = (m?.name || '').toLowerCase();
    const email = (m?.email || '').toLowerCase();
    const matchesSearch = !q || name.includes(q) || email.includes(q);
    const matchesAccess = filterAccessType === 'All' || m.access_type === filterAccessType;
    const matchesStatus = filterStatus === 'All' || (filterStatus === 'Active' ? m.active : !m.active);
    const matchesTeam = filterTeam === 'All' || (m.teams || '').includes(filterTeam);
    return matchesSearch && matchesAccess && matchesStatus && matchesTeam;
  });

  const exportRows = () => filteredMembers.map(m => ({
    Name: m.name,
    Email: m.email,
    Phone: m.phone,
    'Access Type': m.access_type,
    Status: m.active ? 'Active' : 'Inactive',
    Role: m.default_role,
    Team: m.teams,
    'Active Projects': m.active_projects,
    'Inactive Projects': m.inactive_projects,
  }));

  const formatProjectList = (value: string | null | undefined, visible: number = 1) => {
    const items = (value || '').split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return '—';
    if (items.length <= visible) return items.join(', ');
    return `${items[0]} and +${items.length - 1}`;
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-500/10 rounded-2xl text-teal-600">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Members</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {members.length} users configured in this organization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadSampleExcel('members')}
            className="btn-secondary flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-xs font-medium"
          >
            <FileDown size={15} /> Template
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-xs font-medium"
          >
            <Upload size={15} /> Import
          </button>
          <button
            onClick={() => exportRows().length && exportToXlsx(exportRows(), 'valid8-members')}
            className="btn-secondary flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-xs font-medium"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => {
              setEditingMember(null);
              setShowAdd(true);
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition-all shadow-lg shadow-teal-200 text-xs font-medium"
          >
            <Plus size={15} /> Add Member
          </button>
        </div>
      </div>

      <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              className="input pl-8 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-teal-500"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="input pl-8 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-teal-500"
              value={filterAccessType}
              onChange={e => setFilterAccessType(e.target.value)}
            >
              <option value="All">Access Type</option>
              <option value="Paid">Paid</option>
              <option value="Complimentary">Complimentary</option>
            </select>
            <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="input pl-8 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-teal-500"
              value={filterTeam}
              onChange={e => setFilterTeam(e.target.value)}
            >
              <option value="All">All Teams</option>
              {Array.from(new Set(members.flatMap(m => (m.teams || '').split(',').map(s => s.trim()).filter(Boolean)))).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search members by name or email..."
            className="input pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-orange-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="text-orange-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading members list...</p>
        </div>
      ) : (
        <div className="card overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-gray-600 dark:text-gray-400 text-xs">
                  <th className="px-5 py-3 text-left font-medium">#</th>
                  <th className="px-5 py-3 text-left font-medium">USER</th>
                  <th className="px-5 py-3 text-left font-medium">STATUS</th>
                  <th className="px-5 py-3 text-left font-medium">ROLE</th>
                  <th className="px-5 py-3 text-left font-medium">ASSIGNED TEAM</th>
                  <th className="px-5 py-3 text-left font-medium">ASSIGNED PROJECTS</th>
                  <th className="px-5 py-3 text-left font-medium">COUNT</th>
                  <th className="px-5 py-3 text-right font-medium">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredMembers.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative group inline-block">
                          <span className="font-medium text-gray-900 dark:text-white underline decoration-dotted decoration-gray-400 underline-offset-2 cursor-default">{m.name}</span>
                          {(m.email || m.phone) && (
                            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-top-left">
                              <div className="rounded-lg bg-gray-900 dark:bg-gray-800 text-white text-xs leading-relaxed p-3 shadow-xl border border-gray-800 dark:border-gray-700 space-y-1">
                                {m.email && <p className="truncate">Email: {m.email}</p>}
                                {m.phone && <p>Phone: {m.phone}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.access_type === 'Paid' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{m.access_type || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${m.active ? 'badge-active' : 'badge-on_hold'} text-xs`}>
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{m.default_role || 'User'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{m.teams || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">
                      {formatProjectList(m.active_projects)}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                      Inspections: 0 Instructions: 0 Approval given: 0
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMember(m);
                            setShowAdd(true);
                          }}
                          className="p-1 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                          title="Edit Member"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(m, e)}
                          className="p-1 hover:text-red-600 transition-colors"
                          title="Delete Member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">No members found matching your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          isOpen={showImport}
          onClose={() => { setShowImport(false); load(); }}
          title="Import Members"
          description="Upload an Excel file (.xlsx, .xls) or CSV with columns: Name, Email, Phone No, Access Type, Active, Default Role, Team, Active Assigned Projects, Inactive Assigned Projects."
          columns={['Name', 'Email', 'Phone No', 'Access Type', 'Active', 'Default Role', 'Team', 'Active Assigned Projects', 'Inactive Assigned Projects']}
          sampleData={[
            {
              'Name': 'Karan Shah',
              'Email': 'parshwaconstructions2020@gmail.com',
              'Phone No': '9821322140',
              'Access Type': 'Complimentary',
              'Active': 'Yes',
              'Default Role': 'User',
              'Team': 'Parshwa Constructions',
              'Active Assigned Projects': 'CITIZEN CHSL',
              'Inactive Assigned Projects': '',
            },
            {
              'Name': 'Mayuresh Jadhav',
              'Email': 'mayuresh.jadhav@pranavconstructions.com',
              'Phone No': '+919769874571',
              'Access Type': 'Paid',
              'Active': 'Yes',
              'Default Role': 'User',
              'Team': 'Main Team, Phone Contact',
              'Active Assigned Projects': 'AURORA, Training Project, SHINING STAR, ANKUR, MAYUR RESIDENCY, NIRMAL BHAVAN CHSL',
              'Inactive Assigned Projects': '',
            },
            {
              'Name': 'Vishal Tatte',
              'Email': 'vishal.tatte@pranavconstructions.com',
              'Phone No': '+919595530660',
              'Access Type': 'Paid',
              'Active': 'Yes',
              'Default Role': 'User',
              'Team': 'Main Team',
              'Active Assigned Projects': 'Training Project, YOU AND I, VAIBHAV VISTA',
              'Inactive Assigned Projects': '',
            }
          ]}
          onImport={handleImport}
        />
      )}

      <AddMemberModal
        isOpen={showAdd}
        onClose={() => {
          setShowAdd(false);
          setEditingMember(null);
        }}
        onSuccess={() => {
          load();
          setEditingMember(null);
        }}
        member={editingMember}
      />
    </div>
  );
}