import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building,
  Plus,
  Edit2,
  History,
  FileText,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Upload,
  Filter,
  Eye,
  Info,
  Layers,
  ArrowRight,
  HelpCircle,
  X,
  FileCheck,
  Calendar,
} from 'lucide-react';
import {
  RawEmploymentRecord,
  OverlapAlert,
  EmploymentGap,
  calculateInclusiveDays,
} from '../lib/overlapEngine.ts';
import {
  PfContributionCrossCheckItem,
  ContactPersona,
  EmploymentAudit,
} from '../lib/types.ts';

interface TimelineData {
  profile: { id: number; demo_emp_id: string; uan: string };
  records: RawEmploymentRecord[];
  overlaps: OverlapAlert[];
  gaps: EmploymentGap[];
  invalid_records: Array<{
    record_id: number;
    employer_name: string;
    issue: string;
    category: string;
  }>;
}

export const EmploymentHistoryPage: React.FC = () => {
  const [data, setData] = useState<TimelineData | null>(null);
  const [crossCheckItems, setCrossCheckItems] = useState<PfContributionCrossCheckItem[]>([]);
  const [contacts, setContacts] = useState<ContactPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
  const [activeTab, setActiveTab] = useState<'timeline' | 'crosscheck' | 'contacts'>('timeline');

  // Modals state
  const [selectedAlert, setSelectedAlert] = useState<OverlapAlert | null>(null);
  const [resolutionAlert, setResolutionAlert] = useState<OverlapAlert | null>(null);
  const [editingRecord, setEditingRecord] = useState<RawEmploymentRecord | null>(null);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<{ record: RawEmploymentRecord; audits: EmploymentAudit[] } | null>(null);
  const [attachModalRecord, setAttachModalRecord] = useState<RawEmploymentRecord | null>(null);

  // Resolution Assistant draft state
  const [helpType, setHelpType] = useState<string>('Request an exit-date update');
  const [templateDraft, setTemplateDraft] = useState<{ subject: string; body: string }>({ subject: '', body: '' });
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Safe upload in modal state
  const [uploadDocType, setUploadDocType] = useState<string>('Relieving / Experience Letter');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadTextContent, setUploadTextContent] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [timelineRes, crossRes, contactsRes] = await Promise.all([
        fetch('/api/employee/timeline').then(r => r.json()),
        fetch('/api/employee/crosscheck').then(r => r.json()),
        fetch('/api/assistant/contacts').then(r => r.json()),
      ]);

      setData(timelineRes);
      setCrossCheckItems(crossRes.items || []);
      setContacts(contactsRes.contacts || []);
    } catch (err: any) {
      showToast(err.message || 'Error loading employment history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Generate Guided Resolution template when resolution modal opens
  const openGuidedResolution = async (alert: OverlapAlert) => {
    setResolutionAlert(alert);
    setCopiedSuccess(false);

    try {
      const res = await fetch('/api/assistant/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employer_name: alert.employer1_name,
          joining_date: alert.overlap_start,
          exit_date: alert.overlap_end,
          overlap_start: alert.overlap_start,
          overlap_end: alert.overlap_end,
        }),
      }).then(r => r.json());

      setTemplateDraft({
        subject: res.subject,
        body: res.body,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Update alert status
  const handleUpdateAlertStatus = async (alertId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/employee/overlap/${alertId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }).then(r => r.json());

      if (res.success) {
        showToast(`Alert status updated to "${newStatus}". Note: Official EPFO record is not modified.`);
        // Refresh local state
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            overlaps: prev.overlaps.map(o => (o.id === alertId ? { ...o, status: newStatus as any } : o)),
          };
        });
        if (selectedAlert && selectedAlert.id === alertId) {
          setSelectedAlert(prev => (prev ? { ...prev, status: newStatus as any } : null));
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating status');
    }
  };

  // View record audit history
  const openAuditHistory = async (empId: number) => {
    try {
      const res = await fetch(`/api/employee/employments/${empId}`).then(r => r.json());
      if (res.record) {
        setHistoryRecord({
          record: res.record,
          audits: res.record.audits || [],
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading history');
    }
  };

  // Safe file upload handler with OTP / credential detection
  const handleSafeUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: uploadFileName || `doc_${Date.now()}.pdf`,
          textContent: uploadTextContent,
          docType: uploadDocType,
          employmentId: attachModalRecord?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error || 'Upload was rejected by safety policy.');
      } else {
        setUploadSuccess('Document passed safety checks and was stored securely in private storage.');
        setTimeout(() => {
          setAttachModalRecord(null);
          setUploadTextContent('');
          setUploadFileName('');
          showToast('Supporting document attached successfully.');
        }, 1500);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-[#4b5f56]">
        <div className="w-8 h-8 border-3 border-[#0b3d2e] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm">Consolidating employment records and calculating timeline intervals...</p>
      </div>
    );
  }

  if (!data) return <div>Failed to load employment history.</div>;

  const records = data.records || [];
  const overlaps = data.overlaps || [];
  const gaps = data.gaps || [];

  // Filter records
  const filteredRecords = records.filter(r => {
    if (filterType === 'current') return !r.exit_date;
    if (filterType === 'previous') return !!r.exit_date;
    if (filterType === 'unverified') return r.verification_status !== 'Verified';
    if (filterType === 'overlaps') {
      return overlaps.some(o => o.record1_id === r.id || o.record2_id === r.id);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b3d2e] text-white px-4 py-3 rounded-xl shadow-lg border border-[#14573f] text-xs flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle className="w-4 h-4 text-[#dff3e8] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[#12233f]">Employment Timeline & History</h1>
            <span className="bg-[#e8f2ee] text-[#0b3d2e] font-semibold text-xs px-2.5 py-0.5 rounded-full border border-[#c9ddd3]">
              Unified Profile
            </span>
          </div>
          <p className="text-xs text-[#4b5f56] max-w-2xl">
            One centralized history consolidating employment tenures across all organizations, identifying date overlaps, calculating calendar intervals, and guiding resolution with employers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingRecord(true)}
            className="flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="text-[11px] font-medium text-[#4b5f56] uppercase tracking-wider">Organizations</div>
          <div className="text-2xl font-bold text-[#0b3d2e] mt-1">{records.length}</div>
          <div className="text-[11px] text-[#4b5f56] mt-0.5">
            {records.filter(r => !r.exit_date).length} Active · {records.filter(r => !!r.exit_date).length} Previous
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="text-[11px] font-medium text-[#4b5f56] uppercase tracking-wider">Date Overlaps</div>
          <div className="text-2xl font-bold text-[#7a5200] mt-1">{overlaps.length}</div>
          <div className="text-[11px] text-[#7a5200] mt-0.5 flex items-center gap-1">
            {overlaps.length > 0 ? (
              <>
                <AlertTriangle className="w-3 h-3 text-[#7a5200]" />
                <span>Requires clarification</span>
              </>
            ) : (
              <span>No overlaps detected</span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="text-[11px] font-medium text-[#4b5f56] uppercase tracking-wider">Career Gaps</div>
          <div className="text-2xl font-bold text-[#12233f] mt-1">{gaps.length}</div>
          <div className="text-[11px] text-[#4b5f56] mt-0.5">Normal career transitions</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c9ddd3] shadow-xs">
          <div className="text-[11px] font-medium text-[#4b5f56] uppercase tracking-wider">Verification Status</div>
          <div className="text-2xl font-bold text-[#14573f] mt-1">
            {records.filter(r => r.verification_status === 'Verified').length} / {records.length}
          </div>
          <div className="text-[11px] text-[#4b5f56] mt-0.5">Verified with employer/ECR</div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-[#c9ddd3] bg-white rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'timeline'
              ? 'border-[#0b3d2e] text-[#0b3d2e]'
              : 'border-transparent text-[#4b5f56] hover:text-[#16251f]'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>Timeline & Records</span>
          {overlaps.length > 0 && (
            <span className="bg-[#fff3d6] text-[#7a5200] font-bold text-[10px] px-1.5 py-0.2 rounded-full border border-[#ecd9a6]">
              {overlaps.length} alerts
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('crosscheck')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'crosscheck'
              ? 'border-[#0b3d2e] text-[#0b3d2e]'
              : 'border-transparent text-[#4b5f56] hover:text-[#16251f]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>PF Contribution Cross-Check</span>
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'contacts'
              ? 'border-[#0b3d2e] text-[#0b3d2e]'
              : 'border-transparent text-[#4b5f56] hover:text-[#16251f]'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Employer HR Contacts Directory</span>
        </button>
      </div>

      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Overlap Alerts Banner if any */}
          {overlaps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#7a5200] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#7a5200]" />
                  <span>Detected Employment Overlaps ({overlaps.length})</span>
                </h2>
                <span className="text-[11px] text-[#4b5f56]">
                  Overlaps indicate overlapping reported dates, not proof of wrongdoing.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {overlaps.map(alert => (
                  <div
                    key={alert.id}
                    className="bg-white border-2 border-[#ecd9a6] rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#7a5200]"></div>
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="inline-block bg-[#fff3d6] text-[#7a5200] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#ecd9a6] mb-1">
                            {alert.category}
                          </span>
                          <h3 className="font-bold text-sm text-[#12233f]">
                            {alert.employer1_name} & {alert.employer2_name}
                          </h3>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            alert.status === 'Resolved'
                              ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                              : alert.status === 'Contacted employer' || alert.status === 'Correction requested'
                              ? 'bg-[#eef3fc] text-[#2a4a82] border-[#bed0ec]'
                              : 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </div>

                      <div className="bg-[#fcfaf5] p-2.5 rounded-lg border border-[#f3e7c4] text-xs space-y-1 mb-3">
                        <div className="flex justify-between text-[#16251f]">
                          <span className="text-[#4b5f56]">Overlapping Interval:</span>
                          <span className="font-semibold">
                            {alert.overlap_start} → {alert.overlap_end}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#16251f]">
                          <span className="text-[#4b5f56]">Overlap Duration:</span>
                          <span className="font-bold text-[#7a5200]">
                            {alert.overlap_days} calendar days (inclusive count)
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#4b5f56] leading-relaxed mb-4">
                        {alert.explanation}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#f5f9f7]">
                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="flex-1 min-w-[120px] text-center bg-[#f5f9f7] hover:bg-[#e8f2ee] text-[#0b3d2e] border border-[#c9ddd3] text-xs font-semibold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Details & Checklist
                      </button>

                      <button
                        onClick={() => openGuidedResolution(alert)}
                        className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Contact Assistant</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Visual Timeline */}
          <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e8f2ee]">
              <div>
                <h2 className="text-base font-bold text-[#12233f] flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#0b3d2e]" />
                  <span>Chronological Employment Timeline</span>
                </h2>
                <p className="text-xs text-[#4b5f56]">
                  Visual representation of all organizations, active tenures, overlap zones, and career breaks.
                </p>
              </div>

              {/* View toggles and filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-[#f5f9f7] p-1 rounded-lg border border-[#c9ddd3] text-xs">
                  <button
                    onClick={() => setViewMode('visual')}
                    className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                      viewMode === 'visual' ? 'bg-white text-[#0b3d2e] font-semibold shadow-xs' : 'text-[#4b5f56]'
                    }`}
                  >
                    Visual Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                      viewMode === 'table' ? 'bg-white text-[#0b3d2e] font-semibold shadow-xs' : 'text-[#4b5f56]'
                    }`}
                  >
                    Records Table
                  </button>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-[#4b5f56]" />
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="bg-[#f5f9f7] border border-[#c9ddd3] rounded-lg px-2.5 py-1 text-xs text-[#16251f] cursor-pointer"
                  >
                    <option value="all">All Employments ({records.length})</option>
                    <option value="current">Current Job Only</option>
                    <option value="previous">Previous Jobs</option>
                    <option value="overlaps">Overlapping Only ({overlaps.length})</option>
                    <option value="unverified">Unverified Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Visual Timeline Mode */}
            {viewMode === 'visual' && (
              <div className="py-4 space-y-6">
                {/* Visual Legend */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#4b5f56] bg-[#f8fbf9] p-2.5 rounded-lg border border-[#e8f2ee]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#0b3d2e] inline-block"></span>
                    <span>Verified Employment</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#2a4a82] inline-block"></span>
                    <span>Current Employment (Ongoing)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#fff3d6] border border-[#ecd9a6] inline-block"></span>
                    <span className="text-[#7a5200] font-medium">Overlap Interval</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#e8eef3] border border-[#c0d0dc] border-dashed inline-block"></span>
                    <span>Career Gap / Hiatus</span>
                  </div>
                </div>

                {/* Timeline Items */}
                <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#c9ddd3]">
                  {filteredRecords.map((r, index) => {
                    const isCurrent = !r.exit_date;
                    const isOverlapping = overlaps.some(o => o.record1_id === r.id || o.record2_id === r.id);
                    const matchingOverlap = overlaps.find(o => o.record1_id === r.id || o.record2_id === r.id);

                    // Associated gap after this job
                    const gapAfter = gaps.find(g => g.previous_employer === r.employer_name);

                    return (
                      <div key={r.id} className="relative group">
                        {/* Timeline Node dot */}
                        <div
                          className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                            isCurrent
                              ? 'bg-[#2a4a82]'
                              : isOverlapping
                              ? 'bg-[#7a5200]'
                              : 'bg-[#0b3d2e]'
                          }`}
                        ></div>

                        {/* Card */}
                        <div className="bg-[#fcfdfd] border border-[#c9ddd3] hover:border-[#0b3d2e] rounded-xl p-4 transition-all shadow-xs">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-sm text-[#12233f]">{r.employer_name}</h3>
                                <span className="bg-[#e8f2ee] text-[#0b3d2e] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#c9ddd3]">
                                  {r.status || (isCurrent ? 'Current' : 'Previous')}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    r.verification_status === 'Verified'
                                      ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                                      : 'bg-[#fff7e0] text-[#7a5200] border-[#ecd9a6]'
                                  }`}
                                >
                                  {r.verification_status || 'Unverified'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4b5f56] mt-1.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-[#14573f]" />
                                  <span className="font-semibold text-[#16251f]">{r.joining}</span>
                                  <span>→</span>
                                  <span className="font-semibold text-[#16251f]">
                                    {r.exit_date || 'Present (Ongoing)'}
                                  </span>
                                </span>

                                <span>·</span>
                                <span>PF Member ID: <strong className="text-[#16251f]">{r.pf_masked}</strong></span>

                                {r.establishment_id && (
                                  <>
                                    <span>·</span>
                                    <span>Est. ID: {r.establishment_id}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 self-start">
                              <button
                                onClick={() => setEditingRecord(r)}
                                className="flex items-center gap-1 text-[11px] font-medium text-[#0b3d2e] hover:bg-[#e8f2ee] px-2 py-1 rounded border border-[#c9ddd3] transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => openAuditHistory(r.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-[#4b5f56] hover:bg-[#f5f9f7] px-2 py-1 rounded border border-[#c9ddd3] transition-colors cursor-pointer"
                                title="View audit history"
                              >
                                <History className="w-3 h-3" />
                                <span>History</span>
                              </button>
                              <button
                                onClick={() => {
                                  setAttachModalRecord(r);
                                  setUploadTextContent('');
                                  setUploadError(null);
                                  setUploadSuccess(null);
                                }}
                                className="flex items-center gap-1 text-[11px] font-medium text-[#14573f] hover:bg-[#e8f2ee] px-2 py-1 rounded border border-[#c9ddd3] transition-colors cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Attach Doc</span>
                              </button>
                            </div>
                          </div>

                          {/* Overlap Highlight Banner inside timeline card */}
                          {matchingOverlap && (
                            <div className="mt-3 p-3 bg-[#fff9ed] border border-[#ecd9a6] rounded-lg text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-[#7a5200]">
                                <span className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#7a5200]" />
                                  <span>Overlap Detected: {matchingOverlap.overlap_days} Days</span>
                                </span>
                                <span className="text-[11px] font-medium bg-white px-2 py-0.5 rounded border border-[#ecd9a6]">
                                  {matchingOverlap.overlap_start} to {matchingOverlap.overlap_end}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#4b5f56]">
                                Coincides with tenure at{' '}
                                <strong>
                                  {matchingOverlap.employer1_name === r.employer_name
                                    ? matchingOverlap.employer2_name
                                    : matchingOverlap.employer1_name}
                                </strong>. Contact employer to verify final working day.
                              </p>
                            </div>
                          )}

                          {/* Contact Info Footer if available */}
                          {r.hr_contact_name && (
                            <div className="mt-2.5 pt-2 border-t border-[#e8f2ee] flex items-center justify-between text-[11px] text-[#4b5f56]">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-[#14573f]" />
                                <span>HR Contact: {r.hr_contact_name} ({r.hr_contact_email})</span>
                              </span>
                              <span className="text-[10px] text-[#6b857a]">Source: {r.source_type}</span>
                            </div>
                          )}
                        </div>

                        {/* Gap indicator between jobs */}
                        {gapAfter && (
                          <div className="my-3 ml-4 p-2.5 bg-[#f0f4f8] rounded-lg border border-[#c0d0dc] border-dashed text-xs text-[#2a4a82] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-[#2a4a82]" />
                              <span>
                                <strong>{gapAfter.gap_days} Days Career Gap</strong> ({gapAfter.gap_start} to {gapAfter.gap_end})
                              </span>
                            </div>
                            <span className="text-[10px] text-[#4b5f56]">Transition between organizations</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Table Mode */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                      <th className="py-2.5 px-3 font-semibold">Organization</th>
                      <th className="py-2.5 px-3 font-semibold">Member ID (Masked)</th>
                      <th className="py-2.5 px-3 font-semibold">Joining Date</th>
                      <th className="py-2.5 px-3 font-semibold">Exit Date</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Verification</th>
                      <th className="py-2.5 px-3 font-semibold">Date Source</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8f2ee]">
                    {filteredRecords.map(r => (
                      <tr key={r.id} className="hover:bg-[#f5f9f7] transition-colors">
                        <td className="py-2.5 px-3 font-medium text-[#16251f]">
                          {r.employer_name}
                          {r.establishment_id && (
                            <span className="block text-[10px] text-[#4b5f56]">{r.establishment_id}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{r.pf_masked}</td>
                        <td className="py-2.5 px-3">{r.joining}</td>
                        <td className="py-2.5 px-3">{r.exit_date || <span className="text-[#0b5a35] font-semibold">Present</span>}</td>
                        <td className="py-2.5 px-3">
                          <span className="bg-[#e8f2ee] text-[#0b3d2e] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#c9ddd3]">
                            {r.status || (!r.exit_date ? 'Current' : 'Previous')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              r.verification_status === 'Verified'
                                ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                                : 'bg-[#fff7e0] text-[#7a5200] border-[#ecd9a6]'
                            }`}
                          >
                            {r.verification_status || 'Unverified'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#4b5f56]">{r.source_type}</td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <button
                            onClick={() => setEditingRecord(r)}
                            className="text-[#0b3d2e] hover:underline font-semibold"
                          >
                            Edit
                          </button>
                          <span>·</span>
                          <button
                            onClick={() => openAuditHistory(r.id)}
                            className="text-[#4b5f56] hover:underline"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PF Contribution Cross-Check Tab */}
      {activeTab === 'crosscheck' && (
        <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-[#e8f2ee]">
            <h2 className="text-base font-bold text-[#12233f] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0b3d2e]" />
              <span>PF Monthly Contribution Cross-Check</span>
            </h2>
            <p className="text-xs text-[#4b5f56]">
              Links recorded EPF/EPS contributions to your verified employment periods. Identifies months where contributions are unposted or outside tenure dates.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#e8f2ee] text-[#0b3d2e] border-b border-[#c9ddd3]">
                  <th className="py-2.5 px-3 font-semibold">Employer</th>
                  <th className="py-2.5 px-3 font-semibold">Member ID</th>
                  <th className="py-2.5 px-3 font-semibold">Wage Month</th>
                  <th className="py-2.5 px-3 font-semibold">Employee EPF</th>
                  <th className="py-2.5 px-3 font-semibold">Employer EPF</th>
                  <th className="py-2.5 px-3 font-semibold">Employer EPS</th>
                  <th className="py-2.5 px-3 font-semibold">Tenure Match</th>
                  <th className="py-2.5 px-3 font-semibold">Verification Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8f2ee]">
                {crossCheckItems.map(item => (
                  <tr key={item.id} className="hover:bg-[#f5f9f7] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#16251f]">{item.employer_name}</td>
                    <td className="py-2.5 px-3 font-mono">{item.pf_member_masked}</td>
                    <td className="py-2.5 px-3 font-semibold">{item.month}</td>
                    <td className="py-2.5 px-3">{item.employee_contribution ? `₹${item.employee_contribution}` : '—'}</td>
                    <td className="py-2.5 px-3">{item.employer_epf ? `₹${item.employer_epf}` : '—'}</td>
                    <td className="py-2.5 px-3">{item.employer_eps ? `₹${item.employer_eps}` : '—'}</td>
                    <td className="py-2.5 px-3">
                      {item.is_within_employment_dates ? (
                        <span className="text-[#0b5a35] font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Within tenure</span>
                        </span>
                      ) : (
                        <span className="text-[#9b1c1c] font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Outside dates</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.confidence.includes('Confirmed')
                            ? 'bg-[#dff3e8] text-[#0b5a35] border-[#a3e0bf]'
                            : item.confidence.includes('Discrepancy')
                            ? 'bg-[#fff3d6] text-[#7a5200] border-[#ecd9a6]'
                            : 'bg-[#f5f9f7] text-[#4b5f56] border-[#c9ddd3]'
                        }`}
                      >
                        {item.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contacts Directory Tab */}
      {activeTab === 'contacts' && (
        <div className="bg-white rounded-xl border border-[#c9ddd3] p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-[#e8f2ee] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#12233f] flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0b3d2e]" />
                <span>Authorized Employer & Grievance Directory</span>
              </h2>
              <p className="text-xs text-[#4b5f56]">
                Designated HR/Payroll officers for employee inquiries. All demo contacts are synthetic.
              </p>
            </div>

            <a
              href="https://epfigms.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#e8f2ee] text-[#0b3d2e] hover:bg-[#c9ddd3] px-3 py-1.5 rounded-lg border border-[#c9ddd3] transition-colors"
            >
              <span>EPFiGMS Official Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {contacts.map(c => (
              <div key={c.id} className="bg-[#fcfdfd] border border-[#c9ddd3] rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#12233f]">{c.name}</h3>
                    <p className="text-xs text-[#14573f] font-medium">{c.title}</p>
                    <p className="text-[11px] text-[#4b5f56]">{c.organization}</p>
                  </div>
                  <span className="text-[9px] bg-[#fff7e0] text-[#7a5200] px-1.5 py-0.5 rounded border border-[#ecd9a6] font-bold">
                    DEMO PERSONA
                  </span>
                </div>

                <div className="bg-[#f5f9f7] p-2 rounded-lg text-xs font-mono text-[#16251f] break-all border border-[#e8f2ee]">
                  {c.email}
                </div>

                <p className="text-[11px] text-[#4b5f56] leading-snug">
                  {c.handles}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OVERLAP ALERT DETAIL MODAL */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#fff3d6] text-[#7a5200] px-2 py-0.5 rounded-full border border-[#ecd9a6]">
                  {selectedAlert.category}
                </span>
                <h2 className="text-lg font-bold text-[#12233f] mt-1">
                  Overlap Analysis & Evidence Guide
                </h2>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overlap Summary Box */}
            <div className="bg-[#fff9ed] border border-[#ecd9a6] rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-center text-[#16251f]">
                <span className="font-semibold">{selectedAlert.employer1_name}</span>
                <span className="text-[#7a5200] font-bold">vs</span>
                <span className="font-semibold">{selectedAlert.employer2_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#f3e7c4]">
                <div>
                  <span className="text-[#4b5f56]">Overlapping Period:</span>
                  <div className="font-bold text-[#16251f]">
                    {selectedAlert.overlap_start} to {selectedAlert.overlap_end}
                  </div>
                </div>
                <div>
                  <span className="text-[#4b5f56]">Calendar Days (Inclusive):</span>
                  <div className="font-bold text-[#7a5200]">{selectedAlert.overlap_days} Days</div>
                </div>
              </div>
            </div>

            {/* Why this matters */}
            <div className="space-y-1.5 text-xs">
              <h4 className="font-bold text-[#12233f] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#0b3d2e]" />
                <span>Why this record overlap matters:</span>
              </h4>
              <p className="text-[#4b5f56] leading-relaxed">
                When two employers report active employment during the same window, EPFO automated systems may delay online PF transfer requests (Form 13) or flag dual contributions. Resolving the official last working day at the previous employer prevents transfer claim rejections.
              </p>
            </div>

            {/* Unknown factors & What evidence is needed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#f5f9f7] p-3 rounded-xl border border-[#c9ddd3]">
                <h5 className="font-bold text-[#0b3d2e] mb-1.5">Evidence Needed:</h5>
                <ul className="list-disc list-inside space-y-1 text-[#4b5f56] text-[11px]">
                  {selectedAlert.evidence_needed.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#f5f9f7] p-3 rounded-xl border border-[#c9ddd3]">
                <h5 className="font-bold text-[#0b3d2e] mb-1.5">Suggested Action Checklist:</h5>
                <ul className="list-disc list-inside space-y-1 text-[#4b5f56] text-[11px]">
                  {selectedAlert.suggested_actions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Status Selector */}
            <div className="pt-2 border-t border-[#e8f2ee] space-y-2">
              <label className="block text-xs font-semibold text-[#16251f]">
                Update Your Resolution Progress:
              </label>
              <select
                value={selectedAlert.status}
                onChange={e => handleUpdateAlertStatus(selectedAlert.id, e.target.value)}
                className="w-full bg-[#fcfdfd] border border-[#c9ddd3] rounded-lg p-2 text-xs font-medium cursor-pointer"
              >
                <option value="Needs review">Needs review (Initial assessment)</option>
                <option value="Contacted employer">Contacted employer (Inquiry sent)</option>
                <option value="Awaiting response">Awaiting response from HR</option>
                <option value="Correction requested">Correction requested (Joint declaration submitted)</option>
                <option value="Resolved">Resolved (Dates reconciled in records)</option>
                <option value="Unable to resolve">Unable to resolve</option>
              </select>
              <p className="text-[10px] text-[#6b857a] italic">
                * Note: Changing status in Provident360 updates your personal tracking dashboard; it does not change official EPFO portal records.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8f2ee]">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-3 py-1.5 text-xs text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedAlert(null);
                  openGuidedResolution(selectedAlert);
                }}
                className="bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Contact Assistant</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GUIDED RESOLUTION MODAL */}
      {resolutionAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#e8f2ee] text-[#0b3d2e] px-2 py-0.5 rounded-full border border-[#c9ddd3]">
                  Guided Resolution
                </span>
                <h2 className="text-lg font-bold text-[#12233f] mt-1">
                  Draft Inquiry for {resolutionAlert.employer1_name}
                </h2>
              </div>
              <button
                onClick={() => setResolutionAlert(null)}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type of help needed */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#16251f]">
                What type of assistance do you need?
              </label>
              <select
                value={helpType}
                onChange={e => setHelpType(e.target.value)}
                className="w-full bg-[#fcfdfd] border border-[#c9ddd3] rounded-lg p-2 text-xs font-medium cursor-pointer"
              >
                <option value="Verify joining/exit dates">Verify joining/exit dates</option>
                <option value="Request an exit-date update">Request an exit-date update (mark Date of Exit in EPFO)</option>
                <option value="Request clarification of PF contributions">Request clarification of PF contributions</option>
                <option value="Investigate a missing contribution">Investigate a missing contribution</option>
                <option value="Check member-account/UAN linkage">Check member-account/UAN linkage</option>
                <option value="Other employment-history issue">Other employment-history issue</option>
              </select>
            </div>

            {/* Editable Template Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#16251f]">
                  Editable Message Template (Facts Populated from Records):
                </label>
                <span className="text-[10px] text-[#4b5f56]">Feel free to customize before copying</span>
              </div>
              <textarea
                rows={11}
                value={templateDraft.body}
                onChange={e => setTemplateDraft({ ...templateDraft, body: e.target.value })}
                className="w-full font-mono text-xs p-3 rounded-xl border border-[#c9ddd3] bg-[#fcfdfd] text-[#16251f] focus:outline-none focus:ring-2 focus:ring-[#0b3d2e] leading-relaxed"
              ></textarea>
            </div>

            {/* Notice */}
            <div className="bg-[#f5f9f7] p-3 rounded-lg border border-[#c9ddd3] text-[11px] text-[#4b5f56] space-y-1">
              <p className="font-semibold text-[#0b3d2e]">Privacy Notice:</p>
              <p>
                This template avoids sensitive bank account or full Aadhaar numbers. You can copy it to your email client to contact your employer's HR or payroll desk directly. Provident360 does not send emails automatically.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#e8f2ee]">
              <a
                href="https://epfigms.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#14573f] hover:underline font-medium flex items-center gap-1"
              >
                <span>If unresponsive, lodge EPFiGMS grievance</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResolutionAlert(null)}
                  className="px-3 py-1.5 text-xs text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(templateDraft.body);
                    setCopiedSuccess(true);
                    handleUpdateAlertStatus(resolutionAlert.id, 'Contacted employer');
                    showToast('Template copied to clipboard. Status updated to "Contacted employer".');
                    setTimeout(() => setCopiedSuccess(false), 3000);
                  }}
                  className="bg-[#0b3d2e] hover:bg-[#14573f] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSuccess ? 'Copied to Clipboard!' : 'Copy Inquiry Message'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT RECORD MODAL */}
      {(isAddingRecord || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#12233f]">
                  {isAddingRecord ? 'Add Employment Record' : 'Edit Employment Dates & Contacts'}
                </h2>
                <p className="text-xs text-[#4b5f56]">
                  {isAddingRecord
                    ? 'Enter details from your appointment or joining records.'
                    : 'Changes are preserved in an audit history with previous values kept.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddingRecord(false);
                  setEditingRecord(null);
                }}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const employer_name = fd.get('employer_name') as string;
                const establishment_id = fd.get('establishment_id') as string;
                const pf_member_id = fd.get('pf_member_id') as string;
                const joining = fd.get('joining') as string;
                const exit_date = (fd.get('exit_date') as string) || null;
                const notes = fd.get('notes') as string;
                const hr_contact_name = fd.get('hr_contact_name') as string;
                const hr_contact_email = fd.get('hr_contact_email') as string;
                const reason = fd.get('reason') as string;

                if (exit_date && exit_date < joining) {
                  alert(`Exit date (${exit_date}) cannot be earlier than joining date (${joining}).`);
                  return;
                }

                try {
                  if (isAddingRecord) {
                    const res = await fetch('/api/employee/employments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        employer_name,
                        establishment_id,
                        pf_member_id,
                        joining,
                        exit_date,
                        notes,
                        hr_contact_name,
                        hr_contact_email,
                      }),
                    }).then(r => r.json());

                    if (res.error) throw new Error(res.error);
                    showToast('Employment record added. Overlap checks re-calculated.');
                  } else if (editingRecord) {
                    const res = await fetch(`/api/employee/employments/${editingRecord.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        joining,
                        exit_date,
                        notes,
                        hr_contact_name,
                        hr_contact_email,
                        reason: reason || 'Updated by employee',
                      }),
                    }).then(r => r.json());

                    if (res.error) throw new Error(res.error);
                    showToast('Employment dates updated. Audit log preserved.');
                  }

                  setIsAddingRecord(false);
                  setEditingRecord(null);
                  loadAllData();
                } catch (err: any) {
                  alert(err.message || 'Error saving record');
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Organization Name *</label>
                <input
                  name="employer_name"
                  type="text"
                  required
                  defaultValue={editingRecord ? editingRecord.employer_name : ''}
                  disabled={!!editingRecord}
                  placeholder="e.g. Acme Technologies Pvt Ltd"
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd] disabled:bg-[#f5f9f7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">PF Member ID *</label>
                  <input
                    name="pf_member_id"
                    type="text"
                    required
                    defaultValue={editingRecord ? editingRecord.pf_member_id : ''}
                    disabled={!!editingRecord}
                    placeholder="e.g. DEMO-TN-0001"
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd] disabled:bg-[#f5f9f7]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">Establishment ID</label>
                  <input
                    name="establishment_id"
                    type="text"
                    defaultValue={editingRecord ? editingRecord.establishment_id || '' : ''}
                    disabled={!!editingRecord}
                    placeholder="e.g. TNMAS0012345"
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd] disabled:bg-[#f5f9f7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">Joining Date *</label>
                  <input
                    name="joining"
                    type="date"
                    required
                    defaultValue={editingRecord ? editingRecord.joining : ''}
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">
                    Exit Date <span className="font-normal text-[#4b5f56]">(leave blank if current)</span>
                  </label>
                  <input
                    name="exit_date"
                    type="date"
                    defaultValue={editingRecord ? editingRecord.exit_date || '' : ''}
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">HR Contact Name</label>
                  <input
                    name="hr_contact_name"
                    type="text"
                    defaultValue={editingRecord ? editingRecord.hr_contact_name || '' : ''}
                    placeholder="e.g. Ananya Rao"
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">HR Contact Email</label>
                  <input
                    name="hr_contact_email"
                    type="email"
                    defaultValue={editingRecord ? editingRecord.hr_contact_email || '' : ''}
                    placeholder="e.g. hr@company.com"
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Notes</label>
                <input
                  name="notes"
                  type="text"
                  defaultValue={editingRecord ? editingRecord.notes || '' : ''}
                  placeholder="e.g. Relieving letter dated 15 March received"
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                />
              </div>

              {editingRecord && (
                <div>
                  <label className="block font-semibold text-[#16251f] mb-1">
                    Reason for Date Modification *
                  </label>
                  <input
                    name="reason"
                    type="text"
                    required
                    placeholder="e.g. Corrected exit date per relieving certificate"
                    className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fff9ed] border-[#ecd9a6]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e8f2ee]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingRecord(false);
                    setEditingRecord(null);
                  }}
                  className="px-3 py-1.5 text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0b3d2e] hover:bg-[#14573f] text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  {isAddingRecord ? 'Save Record' : 'Update Record & Record Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT HISTORY MODAL */}
      {historyRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#12233f]">
                  Audit History: {historyRecord.record.employer_name}
                </h2>
                <p className="text-xs text-[#4b5f56]">
                  Full trail of all previous values and reasons. No records are silently overwritten.
                </p>
              </div>
              <button
                onClick={() => setHistoryRecord(null)}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {historyRecord.audits.length === 0 ? (
                <p className="text-xs text-[#4b5f56] italic">No prior modifications recorded.</p>
              ) : (
                historyRecord.audits.map((a, i) => (
                  <div key={i} className="p-3 bg-[#f5f9f7] rounded-xl border border-[#c9ddd3] text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-[#12233f]">
                      <span className="bg-[#e8f2ee] text-[#0b3d2e] px-2 py-0.5 rounded text-[10px]">
                        {a.action}: {a.field}
                      </span>
                      <span className="text-[10px] text-[#4b5f56]">{a.created_at}</span>
                    </div>

                    {a.old_value && (
                      <div className="text-[#9b1c1c] text-[11px]">
                        Previous: <del className="font-mono">{a.old_value}</del>
                      </div>
                    )}
                    {a.new_value && (
                      <div className="text-[#0b5a35] text-[11px]">
                        Updated to: <strong className="font-mono">{a.new_value}</strong>
                      </div>
                    )}

                    {a.reason && (
                      <div className="text-[11px] text-[#4b5f56] italic pt-1 border-t border-[#e8f2ee]">
                        Reason: {a.reason} · Actor: {a.actor}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#e8f2ee]">
              <button
                onClick={() => setHistoryRecord(null)}
                className="bg-[#0b3d2e] text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT ATTACHMENT MODAL WITH SAFE OTP GUARD */}
      {attachModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c9ddd3] space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#e8f2ee] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#dff3e8] text-[#0b5a35] px-2 py-0.5 rounded-full border border-[#a3e0bf]">
                  Safe Upload Pipeline
                </span>
                <h2 className="text-lg font-bold text-[#12233f] mt-1">
                  Attach Evidence for {attachModalRecord.employer_name}
                </h2>
              </div>
              <button
                onClick={() => setAttachModalRecord(null)}
                className="text-[#4b5f56] hover:text-[#16251f] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-[#fde8e8] border border-[#f3c0c0] rounded-xl text-xs text-[#9b1c1c] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#9b1c1c]" />
                  <span>Upload Rejected by Safety Filter</span>
                </div>
                <p>{uploadError}</p>
                <p className="text-[11px] text-[#7a1c1c]">
                  Please redact OTPs, verification codes, or banking passwords before uploading.
                </p>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 bg-[#dff3e8] border border-[#a3e0bf] rounded-xl text-xs text-[#0b5a35] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#0b5a35]" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSafeUpload} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Document Category</label>
                <select
                  value={uploadDocType}
                  onChange={e => setUploadDocType(e.target.value)}
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                >
                  <option value="Relieving / Experience Letter">Relieving / Experience Letter</option>
                  <option value="Appointment Letter">Appointment Letter</option>
                  <option value="Salary Slip / Payslip">Salary Slip / Payslip</option>
                  <option value="PF Member Passbook Extract">PF Member Passbook Extract</option>
                  <option value="Employer Joint Declaration Copy">Employer Joint Declaration Copy</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#16251f] mb-1">Document File Name</label>
                <input
                  type="text"
                  required
                  value={uploadFileName}
                  onChange={e => setUploadFileName(e.target.value)}
                  placeholder="e.g. Relieving_Letter_Sunrise.pdf"
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#16251f] mb-1">
                  Document Content / Text Extract <span className="font-normal text-[#4b5f56]">(Simulating scanned text)</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={uploadTextContent}
                  onChange={e => setUploadTextContent(e.target.value)}
                  placeholder="Paste or enter extracted text (e.g. Relieving letter dated 15 March 2024 confirming release...)"
                  className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd] font-mono text-[11px]"
                ></textarea>
              </div>

              <div className="bg-[#fff7e0] p-3 rounded-lg border border-[#ecd9a6] text-[11px] text-[#7a5200]">
                <strong className="block mb-0.5">Automated Upload Protection:</strong>
                All files are scanned in-memory prior to storage. Screenshots containing OTPs, 2FA codes, or credentials are automatically rejected to protect your EPFO account security.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8f2ee]">
                <button
                  type="button"
                  onClick={() => setAttachModalRecord(null)}
                  className="px-3 py-1.5 text-[#4b5f56] hover:bg-[#f5f9f7] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-[#0b3d2e] hover:bg-[#14573f] text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{uploading ? 'Scanning...' : 'Scan & Attach Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
