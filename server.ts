import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  findUserById,
  findUserByEmail,
  getAllDemoUsers,
  getEmployeeProfile,
  getEmployerProfile,
  getEmploymentsByEmployee,
  getEmploymentWithAudits,
  insertEmployment,
  updateEmployment,
  getAlertStatus,
  setAlertStatus,
  getReconciliationsByEmployee,
  getPfContributionCrossCheck,
  getEmployerDashboard,
  createEmployerCorrection,
  reviewEmployerCorrection,
  getIssuesByEmployee,
  createIssue,
  updateIssueStatus,
  getDemoContacts,
  getNotifications,
  markNotificationsRead,
  db,
  getNowUtc,
} from './src/lib/db.ts';
import { detectEmploymentOverlaps, maskPfId } from './src/lib/overlapEngine.ts';
import { analyzeTextForSensitiveContent } from './src/lib/sensitiveDetect.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Mock session management: cookie 'p360_uid' stores user ID (1 = Asha Demo, 2 = Sunrise HR, 3 = Lakeview HR)
app.use((req, res, next) => {
  const uid = req.cookies.p360_uid ? parseInt(req.cookies.p360_uid, 10) : 1; // default to Asha Demo
  const user = findUserById(uid) || findUserById(1);
  (req as any).user = user;
  next();
});

// Auth endpoints
app.get('/api/auth/me', (req, res) => {
  const user = (req as any).user;
  const employeeProfile = user.role === 'employee' ? getEmployeeProfile(user.id) : null;
  const employerProfile = user.role === 'employer' ? getEmployerProfile(user.id) : null;
  const demoUsers = getAllDemoUsers();
  res.json({
    user,
    employeeProfile,
    employerProfile,
    demoUsers,
  });
});

app.post('/api/auth/switch', (req, res) => {
  const { userId } = req.body;
  const user = findUserById(Number(userId));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.cookie('p360_uid', String(user.id), { path: '/', httpOnly: false });
  res.json({ success: true, user });
});

// Employee Timeline and History endpoints
app.get('/api/employee/timeline', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') {
    return res.status(403).json({ error: 'Access restricted to employees.' });
  }
  const profile = getEmployeeProfile(user.id);
  if (!profile) return res.status(404).json({ error: 'Employee profile not found' });

  const records = getEmploymentsByEmployee(profile.id);
  const result = detectEmploymentOverlaps(records);

  // Overlay saved alert statuses (e.g., Contacted employer, Resolved)
  const enrichedOverlaps = result.overlaps.map(o => {
    const savedStatus = getAlertStatus(o.id, profile.id);
    return {
      ...o,
      status: savedStatus || o.status,
    };
  });

  res.json({
    profile,
    records,
    overlaps: enrichedOverlaps,
    gaps: result.gaps,
    invalid_records: result.invalid_records,
  });
});

// Update alert status
app.post('/api/employee/overlap/:id/status', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = [
    'Needs review',
    'Contacted employer',
    'Awaiting response',
    'Correction requested',
    'Resolved',
    'Unable to resolve',
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  setAlertStatus(id, profile.id, status, notes);
  res.json({ success: true, status });
});

// Employee Employments CRUD
app.get('/api/employee/employments', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const records = getEmploymentsByEmployee(profile.id);
  res.json({ records });
});

app.get('/api/employee/employments/:id', (req, res) => {
  const user = (req as any).user;
  const empId = parseInt(req.params.id, 10);
  const profile = user.role === 'employee' ? getEmployeeProfile(user.id) : null;
  const record = getEmploymentWithAudits(empId, profile ? profile.id : undefined);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json({ record });
});

app.post('/api/employee/employments', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const { employer_name, establishment_id, pf_member_id, joining, exit_date, notes, hr_contact_name, hr_contact_email, hr_contact_phone } = req.body;

  if (!employer_name || !pf_member_id || !joining) {
    return res.status(400).json({ error: 'Employer name, PF Member ID, and Joining date are required.' });
  }

  // Validate dates
  if (exit_date && exit_date < joining) {
    return res.status(400).json({ error: `Exit date (${exit_date}) cannot be earlier than joining date (${joining}).` });
  }

  const newId = insertEmployment(profile.id, {
    employer_name,
    establishment_id,
    pf_member_id,
    joining,
    exit_date,
    notes,
    hr_contact_name,
    hr_contact_email,
    hr_contact_phone,
    source_type: 'employee_provided',
  });

  res.json({ success: true, id: newId });
});

app.put('/api/employee/employments/:id', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const empId = parseInt(req.params.id, 10);
  const { joining, exit_date, status, notes, hr_contact_name, hr_contact_email, hr_contact_phone, reason } = req.body;

  // Validate dates
  if (exit_date && joining && exit_date < joining) {
    return res.status(400).json({ error: `Exit date (${exit_date}) cannot be earlier than joining date (${joining}).` });
  }

  try {
    updateEmployment(
      empId,
      profile.id,
      { joining, exit_date, status, notes, hr_contact_name, hr_contact_email, hr_contact_phone },
      user.name,
      reason || 'Updated by employee'
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PF Contribution Cross-Check
app.get('/api/employee/crosscheck', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const items = getPfContributionCrossCheck(profile.id);
  res.json({ items });
});

// Employee Dashboard
app.get('/api/employee/dashboard', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const employments = getEmploymentsByEmployee(profile.id);
  const reconciliations = getReconciliationsByEmployee(profile.id);
  const timelineResult = detectEmploymentOverlaps(employments);

  res.json({
    profile,
    employments,
    reconciliations,
    overlap_count: timelineResult.overlaps.length,
    gap_count: timelineResult.gaps.length,
  });
});

// Reconciliations detail
app.get('/api/employee/detail/:id', (req, res) => {
  const recId = parseInt(req.params.id, 10);
  const row = db.prepare(`
    SELECT r.*, e.employer_name, e.pf_member_id, er.ecr_status, er.ecr_date, er.ecr_ref,
           er.trrn, er.pay_status, er.pay_date, er.emp_epf, er.er_epf, er.eps, er.updated_at as r_updated
    FROM reconciliations r
    JOIN employments e ON r.employment_id = e.id
    LEFT JOIN employer_records er ON r.employer_record_id = er.id
    WHERE r.id = ?
  `).get(recId) as any;

  if (!row) return res.status(404).json({ error: 'Reconciliation record not found' });
  res.json({
    row: {
      ...row,
      pf_masked: maskPfId(row.pf_member_id),
    },
  });
});

// Employer Dashboard & Records (Strictly Isolated to employer's organization)
app.get('/api/employer/dashboard', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employer') return res.status(403).json({ error: 'Access restricted to authorized employer users.' });
  const empProfile = getEmployerProfile(user.id);
  if (!empProfile) return res.status(404).json({ error: 'Employer profile not found' });

  const data = getEmployerDashboard(empProfile.id);
  res.json(data);
});

// Propose employer correction
app.post('/api/employer/corrections', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employer') return res.status(403).json({ error: 'Unauthorized' });
  const empProfile = getEmployerProfile(user.id);
  const { employment_id, field, proposed_value, reason } = req.body;

  if (!employment_id || !field || !proposed_value || !reason) {
    return res.status(400).json({ error: 'All fields are required to propose a correction.' });
  }

  // Verify employment belongs to employer's establishment or name
  const emp = db.prepare('SELECT * FROM employments WHERE id = ?').get(employment_id) as any;
  if (!emp) return res.status(404).json({ error: 'Employment record not found' });

  if (emp.establishment_id && empProfile.establishment_id && emp.establishment_id !== empProfile.establishment_id) {
    return res.status(403).json({ error: 'Access denied: You cannot propose corrections for other organizations.' });
  }

  const id = createEmployerCorrection(
    empProfile.id,
    employment_id,
    field,
    proposed_value,
    reason,
    user.name
  );

  res.json({ success: true, id });
});

// Review employer correction (by employee)
app.post('/api/employer/corrections/:id/review', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const corrId = parseInt(req.params.id, 10);
  const { accept } = req.body;

  try {
    reviewEmployerCorrection(corrId, profile.id, Boolean(accept));
    res.json({ success: true, accepted: accept });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Contact Assistant and Message Template Generator
app.get('/api/assistant/contacts', (req, res) => {
  const contacts = getDemoContacts();
  res.json({
    contacts: contacts.map(c => ({
      ...c,
      is_verified_demo: true,
      can_edit: false,
    })),
    grievance_url: 'https://epfigms.gov.in/',
  });
});

app.post('/api/assistant/template', (req, res) => {
  const { employer_name, joining_date, exit_date, overlap_start, overlap_end } = req.body;

  const overlapPeriod = overlap_start && overlap_end
    ? `${overlap_start} to ${overlap_end}`
    : 'as recorded in Provident360';

  const body = `Subject: Request to verify employment dates and PF records

Dear HR/Payroll Team,

I am reviewing my employment history in Provident360 and would appreciate your help verifying the recorded employment dates.

The records currently show:
- Organization: ${employer_name || '[organization name]'}
- Joining date: ${joining_date || '[joining date]'}
- Exit date: ${exit_date || 'not recorded (present)'}
- Potential overlapping period: ${overlapPeriod}

Could you please confirm whether these dates are correct and advise whether any update is required in the relevant employment or PF records?

I can provide supporting documents if needed. Please let me know the appropriate next steps.

Thank you.`;

  res.json({
    subject: 'Request to verify employment dates and PF records',
    body,
  });
});

// Issues endpoints
app.get('/api/issues', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const issues = getIssuesByEmployee(profile.id);
  res.json({ issues });
});

app.post('/api/issues', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const { category, title, description, employment_id, employer_name, dedupe_key } = req.body;

  if (!category || !title) {
    return res.status(400).json({ error: 'Category and title are required.' });
  }

  const id = createIssue(user.id, profile.id, {
    category,
    title,
    description,
    employment_id,
    employer_name,
    dedupe_key: dedupe_key || `issue_${Date.now()}`,
  });

  res.json({ success: true, id });
});

app.post('/api/issues/:id/status', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'employee') return res.status(403).json({ error: 'Unauthorized' });
  const profile = getEmployeeProfile(user.id);
  const id = parseInt(req.params.id, 10);
  const { status, note } = req.body;

  updateIssueStatus(id, profile.id, status, note);
  res.json({ success: true });
});

// Notifications
app.get('/api/notifications', (req, res) => {
  const user = (req as any).user;
  const notifications = getNotifications(user.id);
  res.json({ notifications });
});

app.post('/api/notifications/read', (req, res) => {
  const user = (req as any).user;
  markNotificationsRead(user.id);
  res.json({ success: true });
});

// Safe Document Uploads with OTP & Sensitive Content Screening
app.post('/api/documents/upload', (req, res) => {
  const user = (req as any).user;
  const { fileName, textContent, docType, employmentId } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  // Run sensitive scan
  const findings = analyzeTextForSensitiveContent(textContent || '');
  const blockedFinding = findings.find(f => f.category === 'otp' || f.category === 'credential');

  if (blockedFinding) {
    return res.status(422).json({
      error: blockedFinding.message,
      blocked: true,
      category: blockedFinding.category,
      findings,
    });
  }

  const now = getNowUtc();
  const info = db.prepare(`
    INSERT INTO document_attachments (
      user_id, employment_id, doc_type, file_name, file_path, file_size, mime_type, verification_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?)
  `).run(
    user.id,
    employmentId || null,
    docType || 'Employment Document',
    fileName,
    `/uploads_private/${fileName}`,
    (textContent || '').length,
    'application/pdf',
    now
  );

  res.json({
    success: true,
    documentId: Number(info.lastInsertRowid),
    fileName,
    docType: docType || 'Employment Document',
    status: 'Pending Review',
    findings,
  });
});

app.get('/api/documents', (req, res) => {
  const user = (req as any).user;
  const docs = db.prepare(`
    SELECT d.*, e.employer_name
    FROM document_attachments d
    LEFT JOIN employments e ON d.employment_id = e.id
    WHERE d.user_id = ?
    ORDER BY d.id DESC
  `).all(user.id) as any[];

  res.json({ documents: docs });
});

// Future PF Calculator projection endpoint
app.post('/api/calculator/projection', (req, res) => {
  const { currentBalance, monthlyBasic, annualSalaryHike, years, epfInterestRate } = req.body;

  const r = (epfInterestRate || 8.25) / 100;
  const hike = (annualSalaryHike || 5) / 100;
  let basic = monthlyBasic || 25000;
  let balance = currentBalance || 50000;
  const numYears = Math.min(Math.max(years || 10, 1), 35);

  const projection = [];
  let totalEmployeeContrib = 0;
  let totalEmployerContrib = 0;
  let totalInterest = 0;

  for (let yr = 1; yr <= numYears; yr++) {
    // 12% employee, 3.67% employer to EPF (8.33% to EPS capped)
    const annualEmployee = basic * 0.12 * 12;
    const annualEmployerEpf = basic * 0.0367 * 12;
    const annualDeposits = annualEmployee + annualEmployerEpf;

    // Approximate average balance for annual compounding
    const interest = (balance + annualDeposits / 2) * r;
    balance += annualDeposits + interest;

    totalEmployeeContrib += annualEmployee;
    totalEmployerContrib += annualEmployerEpf;
    totalInterest += interest;

    projection.push({
      year: yr,
      salary: Math.round(basic),
      annualContributions: Math.round(annualDeposits),
      annualInterest: Math.round(interest),
      closingBalance: Math.round(balance),
    });

    basic *= 1 + hike;
  }

  res.json({
    projectedCorpus: Math.round(balance),
    totalEmployeeContrib: Math.round(totalEmployeeContrib),
    totalEmployerContrib: Math.round(totalEmployerContrib),
    totalInterest: Math.round(totalInterest),
    projection,
  });
});

// EPF Claims tracking
app.get('/api/claims/status', (req, res) => {
  const user = (req as any).user;
  // Demo EPF claims data
  const claims = [
    {
      claimId: 'CLM20240988172',
      formType: 'Form 19 (Final PF Settlement)',
      submissionDate: '2024-03-20',
      status: 'Under Process by Field Office',
      fieldOffice: 'Regional Office, Chennai South',
      claimAmount: '₹ 86,400',
      lastUpdated: '2024-03-28',
      remarks: 'Awaiting employer exit mark confirmation from Sunrise Textiles.',
    },
    {
      claimId: 'CLM20231100431',
      formType: 'Form 31 (Advance for Illness / House construction)',
      submissionDate: '2023-06-10',
      status: 'Settled & Credited',
      fieldOffice: 'Regional Office, Chennai South',
      claimAmount: '₹ 45,000',
      lastUpdated: '2023-06-18',
      remarks: 'Payment dispatched via NEFT to linked bank account ending in ••4012.',
    },
  ];

  res.json({ claims });
});

// Identity Verification records
app.get('/api/identity/records', (req, res) => {
  const user = (req as any).user;
  const cases = db.prepare(`
    SELECT ic.*, ie.legal_name as employer_legal_name, ie.dob as employer_dob, ie.pan_last4,
           e.name as employer_name, e.establishment_id
    FROM identity_cases ic
    JOIN identity_employer ie ON ic.record_id = ie.id
    JOIN employers e ON ic.employer_id = e.id
    WHERE ic.employee_id = 1
  `).all() as any[];

  res.json({
    role: user.role,
    records: [
      {
        organization: 'Sunrise Textiles (Demo)',
        pf_masked: 'DEMO-TN-••••0001',
        summary: cases.some((c: any) => c.status === 'Open') ? 'Discrepancy' : 'Matched',
        fields: cases.map((c: any) => ({
          field: c.field,
          employee_value: c.field === 'Legal name' ? 'Asha Demo' : '1992-05-14',
          employer_value: c.field === 'Legal name' ? c.employer_legal_name : c.employer_dob,
          result: c.result,
          status: c.status,
          explanation: c.notes || 'Values compared securely without exposing full identifiers.',
          detected: c.detected_at,
          possible_cause: c.field === 'Date of birth' ? 'Typographical entry on employer portal' : 'Initials / name ordering difference',
          next_steps: 'Submit Joint Declaration form with supporting Aadhaar / PAN copy.',
        })),
      },
    ],
  });
});

// Mount Vite middleware in development
async function startServer() {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Provident360 full-stack running at http://localhost:${PORT}`);
  });
}

startServer();
