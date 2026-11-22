import React, { useState, useEffect } from 'react';
import { FileCheck2, Clock, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';

export const ClaimsView: React.FC = () => {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/claims/status')
      .then(r => r.json())
      .then(d => {
        setClaims(d.claims || []);
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
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCheck2 className="w-5 h-5 text-[#0b3d2e]" />
            <h1 className="text-xl font-bold text-[#12233f]">EPF Claims & Withdrawal Status</h1>
          </div>
          <p className="text-xs text-[#4b5f56]">
            Tracks status of Form 19 (Full Final Settlement), Form 10C (Pension Withdrawal Scheme), and Form 31 (PF Advances).
          </p>
        </div>

        <a
          href="https://unifiedportal-mem.epfindia.gov.in/memberinterface/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#e8f2ee] text-[#0b3d2e] hover:bg-[#c9ddd3] px-3 py-2 rounded-lg border border-[#c9ddd3] transition-colors"
        >
          <span>EPFO Member Portal</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="space-y-4">
        {claims.map((c, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#e8f2ee]">
              <div>
                <span className="font-mono text-xs text-[#4b5f56] block">Claim ID: {c.claimId}</span>
                <h3 className="font-bold text-sm text-[#12233f]">{c.formType}</h3>
              </div>

              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border self-start ${
                  c.status.includes('Settled')
                    ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                    : 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                }`}
              >
                {c.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[#4b5f56] block text-[10px]">Submitted Date</span>
                <span className="font-semibold text-[#16251f]">{c.submissionDate}</span>
              </div>
              <div>
                <span className="text-[#4b5f56] block text-[10px]">Regional Field Office</span>
                <span className="font-semibold text-[#16251f]">{c.fieldOffice}</span>
              </div>
              <div>
                <span className="text-[#4b5f56] block text-[10px]">Claim Amount</span>
                <span className="font-bold text-[#0b3d2e]">{c.claimAmount}</span>
              </div>
              <div>
                <span className="text-[#4b5f56] block text-[10px]">Last Status Update</span>
                <span className="font-semibold text-[#16251f]">{c.lastUpdated}</span>
              </div>
            </div>

            {c.remarks && (
              <div className="p-2.5 bg-[#f8fbf9] border border-[#e8f2ee] rounded-lg text-xs text-[#4b5f56]">
                <strong className="text-[#0b3d2e]">Field Office Remarks:</strong> {c.remarks}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
