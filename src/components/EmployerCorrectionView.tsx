import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileCheck,
  Send,
  History,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Clock,
  Shield,
  X,
  ExternalLink,
} from 'lucide-react';
import { EmployerCorrectionRequest } from '../lib/types.ts';

export const EmployerCorrectionView: React.FC = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Propose correction modal
  const [isProposing, setIsProposing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [proposedField, setProposedField] = useState('exit_date');
  const [proposedValue, setProposedValue] = useState('');
  const [proposedReason, setProposedReason] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employer/dashboard').then(r => r.json());
      setDashboard(res);
    } catch (err: any) {
      showToast(err.message || 'Error loading employer dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProposeCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedValue || !proposedReason) {
      alert('Please provide both proposed value and reason.');
      return;
    }

    try {
      const res = await fetch('/api/employer/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employment_id: selectedRecord?.id || 1,
          field: proposedField,
          proposed_value: proposedValue,
          reason: proposedReason,
        }),
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);

      showToast('Correction proposal submitted. In-app notification sent to the employee.');
      setIsProposing(false);
      setProposedValue('');
      setProposedReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit correction');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#4b5f56]">
        <div className="w-8 h-8 border-3 border-[#0b3d2e] border-t-transparent rounded-full animate-spin mb-3"></div>
      </div>
    );
  }

  if (!dashboard || !dashboard.employer) {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#c9ddd3] text-center">
        <Building2 className="w-12 h-12 text-[#9b1c1c] mx-auto mb-2" />
        <h2 className="text-base font-bold text-[#12233f]">Employer Access Restricted</h2>
        <p className="text-xs text-[#4b5f56] mt-1">
          You must be logged in as an authorized employer persona to view this console. Switch your persona via the top right menu.
        </p>
      </div>
    );
  }

  const { employer, records = [], corrections = [] } = dashboard;

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
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0b3d2e]" />
            <h1 className="text-xl font-bold text-[#12233f]">{employer.name}</h1>
            <span className="bg-[#e8f2ee] text-[#0b3d2e] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#c9ddd3]">
              Est. ID: {employer.establishment_id}
            </span>
          </div>
          <p className="text-xs text-[#4b5f56] mt-1">
            Strictly isolated console: You can only view and propose corrections for employees belonging to establishment <strong>{employer.establishment_id}</strong>.
          </p>
        </div>

        <div className="bg-[#fff7e0] p-2.5 rounded-lg border border-[#ecd9a6] text-[11px] text-[#7a5200]">
          <strong>Notice:</strong> Proposed corrections are subject to employee confirmation and official EPFO Joint Declaration filing.
        </div>
      </div>

      {/* Active Correction Proposals */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e8f2ee]">
          <div>
            <h2 className="text-sm font-bold text-[#12233f] flex items-center gap-2">
              <History className="w-4 h-4 text-[#0b3d2e]" />
              <span>Correction Requests & Audit Trail ({corrections.length})</span>
            </h2>
            <p className="text-xs text-[#4b5f56]">
              History of proposed date adjustments, previous values, reasons, and review outcomes.
            </p>
          </div>

          <button
            onClick={() => {
              setSelectedRecord(null);
              setIsProposing(true);
            }}
            className="flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Propose Date Correction</span>
          </button>
        </div>

        {corrections.length === 0 ? (
          <p className="text-xs text-[#4b5f56] italic py-4 text-center">
            No active correction proposals submitted for this organization.
          </p>
        ) : (
          <div className="divide-y divide-[#e8f2ee]">
            {corrections.map((c: EmployerCorrectionRequest) => (
              <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#12233f]">{c.employee_name || 'Asha Demo'}</span>
                    <span className="text-[#4b5f56]">Field: <strong>{c.field}</strong></span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        c.status === 'Accepted'
                          ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                          : c.status === 'Rejected'
                          ? 'bg-[#fde8e8] text-[#9b1c1c] border-[#f3c0c0]'
                          : 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#4b5f56] mt-1 space-x-2">
                    <span>Previous: <del className="font-mono">{c.previous_value || 'None'}</del></span>
                    <span>→</span>
                    <span>Proposed: <strong className="font-mono text-[#0b5a35]">{c.proposed_value}</strong></span>
                    <span>· Reason: {c.reason}</span>
                  </div>
                </div>

                <div className="text-[10px] text-[#6b857a] text-right">
                  <div>Actor: {c.actor}</div>
                  <div>{c.created_at}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employer-Reported Monthly ECR & Member Records */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-[#e8f2ee]">
          <h2 className="text-sm font-bold text-[#12233f] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#0b3d2e]" />
            <span>Reported Member Records ({records.length})</span>
          </h2>
          <p className="text-xs text-[#4b5f56]">
            ECR filing status, challan TRRN references, and employee/employer contributions for establishment {employer.establishment_id}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                <th className="py-2.5 px-3 font-semibold">Employee</th>
                <th className="py-2.5 px-3 font-semibold">PF Member ID</th>
                <th className="py-2.5 px-3 font-semibold">Month</th>
                <th className="py-2.5 px-3 font-semibold">ECR Status</th>
                <th className="py-2.5 px-3 font-semibold">Payment Status</th>
                <th className="py-2.5 px-3 font-semibold">Emp EPF</th>
                <th className="py-2.5 px-3 font-semibold">Er EPF / EPS</th>
                <th className="py-2.5 px-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f2ee]">
              {records.map((r: any) => (
                <tr key={r.id} className="hover:bg-[#f5f9f7] transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[#16251f]">{r.employee_name}</td>
                  <td className="py-2.5 px-3 font-mono">{r.pf_masked}</td>
                  <td className="py-2.5 px-3 font-semibold">{r.month}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        r.ecr_status === 'Submitted'
                          ? 'bg-[#dff3e8] text-[#0b5a35]'
                          : 'bg-[#fff7e0] text-[#7a5200]'
                      }`}
                    >
                      {r.ecr_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        r.pay_status === 'Paid'
                          ? 'bg-[#dff3e8] text-[#0b5a35]'
                          : 'bg-[#fff7e0] text-[#7a5200]'
                      }`}
                    >
                      {r.pay_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">₹{r.emp_epf || 0}</td>
                  <td className="py-2.5 px-3">
                    ₹{r.er_epf || 0} / ₹{r.eps || 0}
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => {
                        setSelectedRecord(r);
                        setIsProposing(true);
                      }}
                      className="text-[#0b3d2e] hover:underline font-semibold"
                    >
                      Propose Correction
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROPOSE CORRECTION MODAL */}
      {isProposing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#12233f]">Propose Employment Date Correction</h3>
                <p className="text-xs text-[#4b5f56]">
                  Organization: <strong>{employer.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsProposing(false)}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProposeCorrection} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Field to Correct</label>
                <select
                  value={proposedField}
                  onChange={e => setProposedField(e.target.value)}
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                >
                  <option value="exit_date">Exit Date (Date of Exit from Service)</option>
                  <option value="joining">Joining Date (Date of Joining Service)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Proposed Value (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={proposedValue}
                  onChange={e => setProposedValue(e.target.value)}
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#16251f] mb-1">
                  Reason & Supporting Evidence Reference *
                </label>
                <textarea
                  rows={3}
                  required
                  value={proposedReason}
                  onChange={e => setProposedReason(e.target.value)}
                  placeholder="e.g. Verified against company relieving letter ref #RL-2024-0391 issued on employee's last working day."
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                ></textarea>
              </div>

              <div className="bg-[#f5f9f7] p-2.5 rounded-lg border border-[#c9ddd3] text-[11px] text-[#4b5f56]">
                When submitted, an in-app notification is sent to the employee. The audit log retains the original value, actor identity, and change justification.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8f2ee]">
                <button
                  type="button"
                  onClick={() => setIsProposing(false)}
                  className="px-3 py-1.5 text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0b3d2e] hover:bg-[#14573f] text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Submit Proposed Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
