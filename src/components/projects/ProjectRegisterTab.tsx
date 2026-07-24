import React, { useState, useEffect } from 'react';
import { RegisterEntry } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Plus, Search, FileText, ExternalLink, Hash, Clock } from 'lucide-react';

interface ProjectRegisterTabProps {
  projectId: string;
}

export const ProjectRegisterTab: React.FC<ProjectRegisterTabProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documentNo, setDocumentNo] = useState('');
  const [title, setTitle] = useState('');
  const [revision, setRevision] = useState('R0');
  const [fileUrl, setFileUrl] = useState('');

  const loadRegister = async () => {
    try {
      setLoading(true);
      const data = await api.getProjectRegister(projectId);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegister();
  }, [projectId]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      await api.createProjectRegisterEntry(projectId, {
        document_no: documentNo,
        title,
        revision,
        file_url: fileUrl,
        status: 'active',
      });
      setIsModalOpen(false);
      setDocumentNo('');
      setTitle('');
      setRevision('R0');
      setFileUrl('');
      loadRegister();
    } catch (err) {
      console.error('Failed to add register entry:', err);
    }
  };

  const filtered = entries.filter(r =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.document_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search document no. or title..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full placeholder-slate-500"
          />
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20"
          id="add-doc-register-btn"
        >
          <Plus className="w-4 h-4" /> Add Document Revision
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs animate-pulse">Loading Register Log...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-300">No documents registered yet</p>
          <p className="text-xs text-slate-500 mt-1">Keep drawings and GFC layouts in sync with version revisions</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Document Number</th>
                <th className="px-4 py-3">Drawing / Document Title</th>
                <th className="px-4 py-3">Revision</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date Added</th>
                <th className="px-4 py-3">File Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-teal-400">{r.document_no}</td>
                  <td className="px-4 py-3 font-semibold text-slate-100">{r.title}</td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-800 text-slate-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700">
                      {r.revision}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.file_url ? (
                      <a
                        href={r.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View PDF
                      </a>
                    ) : (
                      <span className="text-slate-500">No URL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Document Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Document / Drawing Revision Entry">
        <form onSubmit={handleCreateEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Document Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. DWG-AUR-STR-SLB-1400-R2"
              value={documentNo}
              onChange={e => setDocumentNo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Drawing / Document Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. 14th Floor Slab Reinforcement & Column Detail Plan"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Revision Code</label>
              <input
                type="text"
                value={revision}
                onChange={e => setRevision(e.target.value)}
                placeholder="R0, R1, R2..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">File / CAD URL</label>
              <input
                type="url"
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                placeholder="https://cloud.storage.com/drawings/dwg-01.pdf"
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>
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
              Register Drawing
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
