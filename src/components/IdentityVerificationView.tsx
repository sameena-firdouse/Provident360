import React, { useState, useEffect } from 'react';
import { BadgeCheck, AlertTriangle, CheckCircle, Shield, FileText, UserCheck } from 'lucide-react';

export const IdentityVerificationView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/identity/records')
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

  const records = data?.records || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <BadgeCheck className="w-5 h-5 text-[#0b3d2e]" />
          <h1 className="text-xl font-bold text-[#12233f]">Identity & Demographic Integrity (KYC)</h1>
        </div>
        <p className="text-xs text-[#4b5f56]">
          Compares employee-provided demographic details with employer-entered records. Sensitive PAN and Aadhaar identifiers are masked and never transmitted in full.
        </p>
      </div>

      <div className="space-y-4">
        {records.map((r: any, idx: number) => (
          <div key={idx} className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8f2ee]">
              <div>
                <h2 className="text-base font-bold text-[#12233f]">{r.organization}</h2>
                <span className="text-xs text-[#4b5f56]">PF Member ID: <strong className="font-mono">{r.pf_masked}</strong></span>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  r.summary === 'Matched'
                    ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                    : 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                }`}
              >
                {r.summary === 'Matched' ? 'All Demographics Match' : 'Discrepancy Detected'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                    <th className="py-2.5 px-3 font-semibold">Demographic Field</th>
                    <th className="py-2.5 px-3 font-semibold">Your Registered Value</th>
                    <th className="py-2.5 px-3 font-semibold">Employer-Entered Value</th>
                    <th className="py-2.5 px-3 font-semibold">Comparison Result</th>
                    <th className="py-2.5 px-3 font-semibold">Resolution Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8f2ee]">
                  {r.fields.map((f: any, fIdx: number) => (
                    <tr key={fIdx} className="hover:bg-[#f5f9f7] transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[#12233f]">{f.field}</td>
                      <td className="py-2.5 px-3 font-medium text-[#16251f]">{f.employee_value}</td>
                      <td className="py-2.5 px-3 font-medium text-[#16251f]">{f.employer_value}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            f.result === 'MATCH'
                              ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                              : f.result === 'MISMATCH'
                              ? 'bg-[#fde8e8] text-[#9b1c1c] border-[#f3c0c0]'
                              : 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                          }`}
                        >
                          {f.result}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#4b5f56]">
                        {f.next_steps || 'Records match standard EPFO verification tolerances.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-[#f8fbf9] border border-[#e8f2ee] rounded-xl text-xs text-[#4b5f56] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0b3d2e] shrink-0" />
              <span>
                Zero sensitive disclosure guarantee: PAN is compared using cryptographic HMAC blind indexing; full PAN characters never leave server memory.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
