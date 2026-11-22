import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Upload,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  FileText,
  Trash2,
  Lock,
} from 'lucide-react';
import { AttachedDocument } from '../lib/types.ts';

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadText, setUploadText] = useState('');
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Relieving / Experience Letter');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents').then(r => r.json());
      setDocuments(res.documents || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setScanning(true);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: docName || `document_${Date.now()}.pdf`,
          textContent: uploadText,
          docType,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Upload failed security policy.');
      } else {
        setSuccessMsg('Document successfully scanned and saved to private encrypted storage.');
        setDocName('');
        setUploadText('');
        loadDocs();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <FolderLock className="w-5 h-5 text-[#0b3d2e]" />
          <h1 className="text-xl font-bold text-[#12233f]">Private Documents & Evidence Vault</h1>
        </div>
        <p className="text-xs text-[#4b5f56]">
          Secure repository for appointment letters, relieving certificates, and passbook statements. Protected by real-time OTP screenshot detection.
        </p>
      </div>

      {/* Safe Upload Card */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#e8f2ee]">
          <ShieldCheck className="w-4 h-4 text-[#0b3d2e]" />
          <h2 className="text-sm font-bold text-[#12233f]">Safe Document Upload (Screened for OTPs)</h2>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#fde8e8] border border-[#f3c0c0] rounded-xl text-xs text-[#9b1c1c] space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Upload Blocked by Sensitive-Content Scanner</span>
            </div>
            <p>{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[#dff3e8] border border-[#a3e0bf] rounded-xl text-xs text-[#0b5a35] flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#16251f] mb-1">Document Category</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
              >
                <option value="Relieving / Experience Letter">Relieving / Experience Letter</option>
                <option value="Appointment Letter">Appointment Letter</option>
                <option value="Monthly Payslip">Monthly Payslip</option>
                <option value="PF Member Passbook Statement">PF Member Passbook Statement</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#16251f] mb-1">File Name</label>
              <input
                type="text"
                required
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="e.g. Sunrise_Relieving_Letter.pdf"
                className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#16251f] mb-1">
              Document Text Extract / OCR Simulation
            </label>
            <textarea
              rows={4}
              required
              value={uploadText}
              onChange={e => setUploadText(e.target.value)}
              placeholder="Paste or simulate document text (e.g. This is to certify that employee was relieved on 15 March 2024...)"
              className="w-full p-2.5 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd] font-mono text-[11px]"
            ></textarea>
          </div>

          <div className="bg-[#fff7e0] p-3 rounded-lg border border-[#ecd9a6] text-[11px] text-[#7a5200]">
            <strong>Security Guard Active:</strong> Any image or document mentioning OTP, login codes, 2FA tokens, or plain-text passwords will be immediately rejected to prevent accidental disclosure.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={scanning}
              className="bg-[#0b3d2e] hover:bg-[#14573f] text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>{scanning ? 'Screening Document...' : 'Verify & Store in Vault'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Saved Documents */}
      <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#12233f]">Vault Records ({documents.length})</h2>

        {documents.length === 0 ? (
          <p className="text-xs text-[#4b5f56] text-center py-6 italic">No documents uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {documents.map(d => (
              <div key={d.id} className="p-3 bg-[#fcfdfd] border border-[#c9ddd3] rounded-xl text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#0b3d2e]" />
                    <div className="truncate font-bold text-[#12233f]">{d.file_name}</div>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-[#14573f]" />
                </div>

                <div className="text-[11px] text-[#4b5f56]">
                  <div>Category: {d.doc_type || d.purpose}</div>
                  <div>Uploaded: {d.created_at}</div>
                </div>

                <div className="pt-2 border-t border-[#e8f2ee] flex items-center justify-between text-[10px]">
                  <span className="bg-[#e8f2ee] text-[#0b3d2e] font-semibold px-2 py-0.5 rounded">
                    Encrypted Storage
                  </span>
                  <span className="text-[#0b5a35] font-semibold">Verified Safe</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
