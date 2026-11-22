import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Coins,
  ArrowRight,
  TrendingUp,
  FileCheck,
  Building,
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';

interface DashboardProps {
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/employee/dashboard')
      .then(r => r.json())
      .then(d => {
        setData(d);
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

  const reconciliations = data?.reconciliations || [];
  const employments = data?.employments || [];
  const overlapCount = data?.overlap_count || 0;

  const discrepancies = reconciliations.filter(
    (r: any) => r.status_label === 'Needs review' || r.classification === 'Potential overlap'
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#12233f]">PF Dashboard & Integrity Overview</h1>
          <p className="text-xs text-[#4b5f56] mt-1">
            Consolidated overview of your EPF accounts, passbook vs employer ECR reconciliations, and employment date health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('timeline')}
            className="flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Open Employment Timeline</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="flex items-center justify-between text-[#4b5f56] text-xs font-semibold">
            <span>Employment Tenures</span>
            <Building className="w-4 h-4 text-[#0b3d2e]" />
          </div>
          <div className="text-2xl font-bold text-[#12233f] mt-2">{employments.length}</div>
          <p className="text-[11px] text-[#4b5f56] mt-1">
            {employments.filter((e: any) => !e.exit_date).length} Active · {employments.filter((e: any) => !!e.exit_date).length} Previous
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="flex items-center justify-between text-[#7a5200] text-xs font-semibold">
            <span>Timeline Overlaps</span>
            <AlertTriangle className="w-4 h-4 text-[#7a5200]" />
          </div>
          <div className="text-2xl font-bold text-[#7a5200] mt-2">{overlapCount}</div>
          <p className="text-[11px] text-[#7a5200] mt-1">
            {overlapCount > 0 ? 'Potential date overlap detected' : 'All date intervals distinct'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="flex items-center justify-between text-[#14573f] text-xs font-semibold">
            <span>Reconciled Wage Months</span>
            <FileSpreadsheet className="w-4 h-4 text-[#14573f]" />
          </div>
          <div className="text-2xl font-bold text-[#12233f] mt-2">{reconciliations.length}</div>
          <p className="text-[11px] text-[#4b5f56] mt-1">
            {discrepancies.length} discrepancy warnings to review
          </p>
        </div>
      </div>

      {/* Feature Navigation Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Employment Timeline Callout */}
        <div className="bg-gradient-to-br from-[#f8fbf9] to-[#e8f2ee] p-5 rounded-xl border border-[#c9ddd3] shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#0b3d2e] text-white">
              <CalendarClock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-[#0b3d2e]">Employment Timeline & Overlap Engine</h3>
              <p className="text-xs text-[#4b5f56]">Consolidated view across all organizations with inclusive date calculations.</p>
            </div>
          </div>
          <p className="text-xs text-[#16251f] leading-relaxed">
            Identifies overlapping employment intervals (e.g. Sunrise Textiles vs Lakeview Tech), calculates exact days, and prepares guided employer inquiries.
          </p>
          <button
            onClick={() => onNavigate('timeline')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0b3d2e] hover:underline cursor-pointer"
          >
            <span>Review Employment Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Future PF Calculator Callout */}
        <div className="bg-gradient-to-br from-[#fcfdfd] to-[#eef3fc] p-5 rounded-xl border border-[#c9ddd3] shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#2a4a82] text-white">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-[#12233f]">Future PF Growth Calculator</h3>
              <p className="text-xs text-[#4b5f56]">EPF compound corpus growth projection at current 8.25% interest.</p>
            </div>
          </div>
          <p className="text-xs text-[#16251f] leading-relaxed">
            Project your total retirement wealth, annual employee and employer contributions, and compounding returns.
          </p>
          <button
            onClick={() => onNavigate('calculator')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#2a4a82] hover:underline cursor-pointer"
          >
            <span>Launch PF Calculator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recent Reconciliations Table */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e8f2ee]">
          <div>
            <h2 className="text-sm font-bold text-[#12233f]">Recent Reconciliation Records</h2>
            <p className="text-xs text-[#4b5f56]">Matched by PF Member ID, employer, and wage month. Not verified by EPFO.</p>
          </div>
          <button
            onClick={() => onNavigate('discrepancy')}
            className="text-xs font-semibold text-[#0b3d2e] hover:underline cursor-pointer"
          >
            View Full Table →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                <th className="py-2.5 px-3 font-semibold">Employer</th>
                <th className="py-2.5 px-3 font-semibold">Month</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">ECR Filing</th>
                <th className="py-2.5 px-3 font-semibold">Expected</th>
                <th className="py-2.5 px-3 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f2ee]">
              {reconciliations.slice(0, 5).map((r: any) => (
                <tr key={r.id} className="hover:bg-[#f5f9f7] transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[#16251f]">{r.employer_name}</td>
                  <td className="py-2.5 px-3 font-semibold">{r.month}</td>
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
                  <td className="py-2.5 px-3">{r.ecr_status || 'Not matched'}</td>
                  <td className="py-2.5 px-3 font-mono">₹{r.expected || 1800}</td>
                  <td className="py-2.5 px-3 text-[#4b5f56] truncate max-w-xs">{r.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
