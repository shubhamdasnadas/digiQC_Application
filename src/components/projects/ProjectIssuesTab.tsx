import React, { useState, useEffect } from 'react';
import { Issue } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Plus, Search, AlertOctagon, Clock, User, Calendar, CheckCircle, ShieldAlert } from 'lucide-react';

interface ProjectIssuesTabProps {
  projectId: string;
}

export const ProjectIssuesTab: React.FC<ProjectIssuesTabProps> = ({ projectId }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [status, setStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open');
  const [dueDate, setDueDate] = useState('');

  const loadIssues = async () => {
    try {
      setLoading(true);
      const data = await api.getProjectIssues(projectId);
      setIssues(data);
    } catch (err) {
      console.error('Failed to load issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [projectId]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      await api.createProjectIssue(projectId, {
        title,
        description,
        severity,
        status,
        due_date: dueDate,
      });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      loadIssues();
    } catch (err) {
      console.error('Failed to create issue:', err);
    }
  };

  const filteredIssues = issues.filter(i => {
    const matchesSeverity = filterSeverity === 'all' || i.severity === filterSeverity;
    const matchesSearch =
      i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter & Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Severity Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                filterSeverity === sev
                  ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Search & Add Issue Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search defects..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full placeholder-slate-500"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-rose-500/20 shrink-0"
            id="report-issue-btn"
          >
            <Plus className="w-4 h-4" /> Report Punch-List Defect
          </button>
        </div>
      </div>

      {/* Issues Grid / Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
          Loading Punch-List Defects...
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <CheckCircle className="w-10 h-10 text-teal-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">Zero active defects found</p>
          <p className="text-xs text-slate-500 mt-1">All quality punch-list items are cleared for this project</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIssues.map(issue => (
            <div
              key={issue.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className={`w-4 h-4 shrink-0 ${
                      issue.severity === 'critical' ? 'text-rose-500 animate-bounce' : 'text-amber-400'
                    }`} />
                    <h4 className="text-sm font-bold text-slate-100">{issue.title}</h4>
                  </div>
                  <Badge status={issue.severity} />
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {issue.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Assignee: <strong className="text-slate-200">{issue.assignee_name || 'Unassigned'}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge status={issue.status} />
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Due {issue.due_date || 'TBD'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Issue Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Report Quality Defect / Punch-List Item">
        <form onSubmit={handleCreateIssue} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Defect Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Column C14 Starter Plumb Offset (>6mm)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Severity Level</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              >
                <option value="low">Low (Cosmetic)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="high">High (Major Work Stop)</option>
                <option value="critical">Critical (Safety / Structural)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Resolution Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Detailed Description & Recommended Fix</label>
            <textarea
              rows={3}
              placeholder="Describe exact location, measurements, and required corrective action..."
              value={description}
              onChange={e => setDescription(e.target.value)}
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
              className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded-lg shadow-lg shadow-rose-500/20 transition"
            >
              Log Defect Issue
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
