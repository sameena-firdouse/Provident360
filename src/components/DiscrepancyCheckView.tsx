import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Info,
  Calendar,
  Building,
  CreditCard,
} from 'lucide-react';
import { ReconciliationRow } from '../lib/types.ts';

export const DiscrepancyCheckView: React.FC = () => {
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<ReconciliationRow | null>(null);

  useEffect(() => {
    fetch('/api/employee/dashboard')
      .then(r => r.json())
      .then(d => {
        setRows(d.reconciliations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-[#4b5f56]">
        <div className="w-8 h-8 border-3 border-[#0b3d2e] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="w-5 h-5 text-[#0b3d2e]" />
          <h1 className="text-xl font-bold text-[#12233f]">EPF Discrepancy & Reconciliation Engine</h1>
        </div>
        <p className="text-xs text-[#4b5f56]">
          Cross-examines your recorded member passbook entries against employer Electronic Challan Returns (ECR) and TRRN challan payment receipts.
        </p>
      </div>

      {/* Discrepancy Table Card */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e8f2ee]">
          <div>
            <h2 className="text-sm font-bold text-[#12233f]">Monthly Reconciliation Records</h2>
            <p className="text-[11px] text-[#4b5f56]">
              “Difference” compares passbook posting against employer-reported return, or against the statutory estimate.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#14573f] bg-[#e8f2ee] px-2.5 py-1 rounded-lg border border-[#c9ddd3]">
            {rows.length} Wage Months
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                <th className="py-2.5 px-3 font-semibold">Employer</th>
                <th className="py-2.5 px-3 font-semibold">Wage Month</th>
                <th className="py-2.5 px-3 font-semibold">Reconciliation Status</th>
                <th className="py-2.5 px-3 font-semibold">ECR Filing</th>
                <th className="py-2.5 px-3 font-semibold">Challan Payment</th>
                <th className="py-2.5 px-3 font-semibold">Reported vs Expected</th>
                <th className="py-2.5 px-3 font-semibold">Passbook Credit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f2ee]">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-[#f5f9f7] transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[#16251f]">
                    {r.employer_name}
                    <span className="block text-[10px] text-[#4b5f56] font-mono">{r.pf_masked}</span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#16251f]">{r.month}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        r.status_label === 'Passbook credit recorded'
                          ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                          : r.status_label === 'Needs review'
                          ? 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                          : 'bg-[#fde8e8] text-[#9b1c1c] border-[#f3c0c0]'
                      }`}
                    >
                      {r.status_label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div>{r.ecr_status || 'Not filed'}</div>
                    {r.ecr_ref && <span className="text-[10px] text-[#4b5f56] font-mono">{r.ecr_ref}</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div>{r.pay_status || 'Unknown'}</div>
                    {r.trrn && <span className="text-[10px] text-[#4b5f56] font-mono">TRRN: {r.trrn}</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div>Rep: ₹{r.reported || r.emp_epf || 0}</div>
                    <div className="text-[10px] text-[#4b5f56]">Exp: ₹{r.expected || 1800}</div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold">
                    {r.posted ? `₹${r.posted}` : <span className="text-[#7a5200] text-[11px]">Unposted</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setSelectedRow(r)}
                      className="text-[#0b3d2e] hover:underline font-semibold cursor-pointer"
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#e8f2ee] text-[#0b3d2e] px-2 py-0.5 rounded-full border border-[#c9ddd3]">
                  {selectedRow.classification}
                </span>
                <h3 className="text-base font-bold text-[#12233f] mt-1">
                  {selectedRow.employer_name} · {selectedRow.month}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[#f5f9f7] rounded-xl border border-[#c9ddd3] text-xs leading-relaxed text-[#16251f]">
              <strong>Detailed Assessment:</strong> {selectedRow.explanation}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-[#fcfdfd] border border-[#e8f2ee] rounded-lg">
                <span className="text-[#4b5f56] block text-[10px]">PF Member ID</span>
                <span className="font-mono font-bold text-[#12233f]">{selectedRow.pf_member_id}</span>
              </div>
              <div className="p-2.5 bg-[#fcfdfd] border border-[#e8f2ee] rounded-lg">
                <span className="text-[#4b5f56] block text-[10px]">ECR Status</span>
                <span className="font-semibold text-[#12233f]">{selectedRow.ecr_status || 'No return matched'}</span>
              </div>
              <div className="p-2.5 bg-[#fcfdfd] border border-[#e8f2ee] rounded-lg">
                <span className="text-[#4b5f56] block text-[10px]">Challan Payment Status</span>
                <span className="font-semibold text-[#12233f]">{selectedRow.pay_status || 'Pending / Unknown'}</span>
              </div>
              <div className="p-2.5 bg-[#fcfdfd] border border-[#e8f2ee] rounded-lg">
                <span className="text-[#4b5f56] block text-[10px]">Challan TRRN</span>
                <span className="font-mono font-bold text-[#12233f]">{selectedRow.trrn || '—'}</span>
              </div>
            </div>

            <div className="bg-[#fff7e0] p-3 rounded-lg border border-[#ecd9a6] text-[11px] text-[#7a5200]">
              <strong>EPFO Note:</strong> Timing lags between employer payment submission and member passbook posting are normal. Differences often have ordinary administrative causes rather than non-compliance.
            </div>

            <div className="flex justify-end pt-2 border-t border-[#e8f2ee]">
              <button
                onClick={() => setSelectedRow(null)}
                className="bg-[#0b3d2e] text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
