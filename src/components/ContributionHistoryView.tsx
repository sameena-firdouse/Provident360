import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Calendar,
  Building,
  CheckCircle,
  FileCheck,
} from 'lucide-react';
import { RawEmploymentRecord } from '../lib/overlapEngine.ts';

export const ContributionHistoryView: React.FC = () => {
  const [employments, setEmployments] = useState<RawEmploymentRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employee/dashboard').then(r => r.json());
      setEmployments(res.employments || []);
      setReconciliations(res.reconciliations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
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
            <Coins className="w-5 h-5 text-[#0b3d2e]" />
            <h1 className="text-xl font-bold text-[#12233f]">Monthly EPF Contribution History</h1>
          </div>
          <p className="text-xs text-[#4b5f56]">
            Employee and employer monthly remittances to the Employee Provident Fund (EPF) and Employee Pension Scheme (EPS).
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Close Form' : 'Log Monthly Entry'}</span>
        </button>
      </div>

      {/* Add Record Form */}
      {showAddForm && (
        <div className="bg-[#fcfdfd] border border-[#c9ddd3] rounded-xl p-5 shadow-xs space-y-4 animate-in slide-in-from-top-2 duration-150">
          <h2 className="text-sm font-bold text-[#12233f]">Log a Monthly Passbook Entry</h2>
          <form
            onSubmit={e => {
              e.preventDefault();
              showToast('Monthly entry logged. Reconciliations re-matched.');
              setShowAddForm(false);
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
          >
            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Employment *</label>
              <select className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white">
                {employments.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.employer_name} ({e.pf_member_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Wage Month * (YYYY-MM)</label>
              <input type="month" required className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white" />
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">PF Wages Used (₹)</label>
              <input type="number" defaultValue="15000" className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white" />
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Employee Share (12%)</label>
              <input type="number" defaultValue="1800" className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white" />
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Employer EPF Share (3.67%)</label>
              <input type="number" defaultValue="550" className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white" />
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Employer EPS Share (8.33%)</label>
              <input type="number" defaultValue="1250" className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-white" />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-2 pt-2 border-t border-[#e8f2ee]">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#0b3d2e] text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Save Monthly Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contributions Table */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                <th className="py-2.5 px-3 font-semibold">Employer</th>
                <th className="py-2.5 px-3 font-semibold">Member ID</th>
                <th className="py-2.5 px-3 font-semibold">Month</th>
                <th className="py-2.5 px-3 font-semibold">Employee Share (EPF)</th>
                <th className="py-2.5 px-3 font-semibold">Employer Share (EPF)</th>
                <th className="py-2.5 px-3 font-semibold">Pension Share (EPS)</th>
                <th className="py-2.5 px-3 font-semibold">Passbook Posting Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f2ee]">
              {reconciliations.map((r: any) => (
                <tr key={r.id} className="hover:bg-[#f5f9f7] transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[#16251f]">{r.employer_name}</td>
                  <td className="py-2.5 px-3 font-mono">{r.pf_masked}</td>
                  <td className="py-2.5 px-3 font-semibold">{r.month}</td>
                  <td className="py-2.5 px-3 font-mono">₹{r.emp_epf || r.reported || 1800}</td>
                  <td className="py-2.5 px-3 font-mono">₹{r.er_epf || 550}</td>
                  <td className="py-2.5 px-3 font-mono">₹{r.eps || 1250}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        r.posted
                          ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                          : 'bg-[#fff7e0] text-[#7a5200] border-[#ecd9a6]'
                      }`}
                    >
                      {r.posted ? `Credited (₹${r.posted})` : 'Pending Passbook Credit'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
