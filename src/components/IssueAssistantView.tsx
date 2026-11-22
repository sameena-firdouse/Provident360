import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Building,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { IssueItem } from '../lib/types.ts';

export const IssueAssistantView: React.FC = () => {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadIssues = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/issues').then(r => r.json());
      setIssues(res.issues || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleUpdateStatus = async (issueId: number, status: string) => {
    try {
      await fetch(`/api/issues/${issueId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      showToast(`Issue status changed to "${status}".`);
      loadIssues();
    } catch (err: any) {
      showToast(err.message || 'Error updating issue');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#4b5f56]">
        <div className="w-8 h-8 border-3 border-[#0b3d2e] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b3d2e] text-white px-4 py-3 rounded-xl shadow-lg border border-[#14573f] text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#dff3e8] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="w-5 h-5 text-[#0b3d2e]" />
            <h1 className="text-xl font-bold text-[#12233f]">Issue Assistant & Dispute Tracker</h1>
          </div>
          <p className="text-xs text-[#4b5f56]">
            Keep track of inquiries, employer date corrections, and follow-up communications without missing deadlines.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? 'Close Form' : 'Log New Inquiry'}</span>
        </button>
      </div>

      {/* New Issue Form */}
      {isAdding && (
        <div className="bg-[#fcfdfd] border border-[#c9ddd3] rounded-xl p-5 shadow-xs space-y-4 animate-in slide-in-from-top-2 duration-150">
          <h2 className="text-sm font-bold text-[#12233f]">Log an Employment or PF Issue</h2>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const category = fd.get('category') as string;
              const title = fd.get('title') as string;
              const description = fd.get('description') as string;
              const employer_name = fd.get('employer_name') as string;

              try {
                await fetch('/api/issues', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ category, title, description, employer_name }),
                });
                showToast('Issue created and tracked.');
                setIsAdding(false);
                loadIssues();
              } catch (err: any) {
                alert(err.message || 'Error creating issue');
              }
            }}
            className="space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Issue Category *</label>
                <select name="category" className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white">
                  <option value="Employment overlap correction">Employment overlap correction</option>
                  <option value="Exit date missing / unrecorded">Exit date missing / unrecorded</option>
                  <option value="Missing monthly contribution">Missing monthly contribution</option>
                  <option value="Name / DOB demographic mismatch">Name / DOB demographic mismatch</option>
                  <option value="UAN transfer pending">UAN transfer pending</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Employer / Organization</label>
                <input
                  name="employer_name"
                  type="text"
                  placeholder="e.g. Sunrise Textiles (Demo)"
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Summary Title *</label>
              <input
                name="title"
                type="text"
                required
                placeholder="e.g. Request Sunrise HR to record exit date as 2024-03-15"
                className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Description / Notes</label>
              <textarea
                name="description"
                rows={3}
                placeholder="Details of conversations, ticket references, or requested dates..."
                className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8f2ee]">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#0b3d2e] text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Create Issue Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Issues List */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#12233f]">Tracked Issues ({issues.length})</h2>

        {issues.length === 0 ? (
          <div className="text-center py-8 text-[#4b5f56] text-xs space-y-1">
            <p>No open issues currently tracked.</p>
            <p className="text-[11px]">
              You can log queries here or initiate them directly from the Employment Timeline overlap cards.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e8f2ee]">
            {issues.map(iss => (
              <div key={iss.id} className="py-4 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#e8f2ee] text-[#0b3d2e] font-semibold text-[10px] px-2 py-0.5 rounded-full border border-[#c9ddd3]">
                      {iss.category}
                    </span>
                    <h3 className="font-bold text-sm text-[#12233f]">{iss.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={iss.status}
                      onChange={e => handleUpdateStatus(iss.id, e.target.value)}
                      className="bg-[#f5f9f7] border border-[#c9ddd3] text-xs font-semibold rounded-lg p-1.5 cursor-pointer"
                    >
                      <option value="Open">Open</option>
                      <option value="Contacted employer">Contacted employer</option>
                      <option value="Awaiting response">Awaiting response</option>
                      <option value="Correction requested">Correction requested</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Unable to resolve">Unable to resolve</option>
                    </select>
                  </div>
                </div>

                {iss.description && (
                  <p className="text-[#4b5f56] leading-relaxed pl-1">{iss.description}</p>
                )}

                <div className="flex items-center gap-4 text-[11px] text-[#6b857a] pt-1">
                  {iss.employer_name && <span>Employer: <strong>{iss.employer_name}</strong></span>}
                  <span>Created: {iss.created_at}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
