import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  RawEmploymentRecord,
  detectEmploymentOverlaps,
  maskPfId,
} from './overlapEngine.ts';

const DB_PATH = path.resolve(process.cwd(), 'data/provident360.db');

// Ensure directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

/**
 * Run safe schema migrations
 */
export function migrateDatabase() {
  // Check employments columns
  const empCols = (db.prepare(`PRAGMA table_info(employments)`).all() as any[]).map(c => c.name);

  if (!empCols.includes('source_type')) {
    db.exec(`ALTER TABLE employments ADD COLUMN source_type TEXT DEFAULT 'employee_provided'`);
  }
  if (!empCols.includes('verification_status')) {
    db.exec(`ALTER TABLE employments ADD COLUMN verification_status TEXT DEFAULT 'Unverified'`);
  }
  if (!empCols.includes('notes')) {
    db.exec(`ALTER TABLE employments ADD COLUMN notes TEXT`);
  }
  if (!empCols.includes('hr_contact_name')) {
    db.exec(`ALTER TABLE employments ADD COLUMN hr_contact_name TEXT`);
  }
  if (!empCols.includes('hr_contact_email')) {
    db.exec(`ALTER TABLE employments ADD COLUMN hr_contact_email TEXT`);
  }
  if (!empCols.includes('hr_contact_phone')) {
    db.exec(`ALTER TABLE employments ADD COLUMN hr_contact_phone TEXT`);
  }
  if (!empCols.includes('created_at')) {
    db.exec(`ALTER TABLE employments ADD COLUMN created_at TEXT`);
  }
  if (!empCols.includes('updated_at')) {
    db.exec(`ALTER TABLE employments ADD COLUMN updated_at TEXT`);
  }

  // Create audit table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employment_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employment_id INTEGER NOT NULL REFERENCES employments(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Create overlap alert states
  db.exec(`
    CREATE TABLE IF NOT EXISTS overlap_alert_states (
      alert_id TEXT PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employee_profiles(id),
      status TEXT NOT NULL DEFAULT 'Needs review',
      notes TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Create employer corrections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employer_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL REFERENCES employers(id),
      employment_id INTEGER NOT NULL REFERENCES employments(id),
      field TEXT NOT NULL,
      previous_value TEXT,
      proposed_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_doc_ref TEXT,
      status TEXT NOT NULL DEFAULT 'Pending Review',
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );
  `);

  // Create uploads documents metadata table if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      employment_id INTEGER REFERENCES employments(id),
      doc_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'Unverified',
      created_at TEXT NOT NULL
    );
  `);

  // Add initial timestamps / sources if missing
  db.exec(`
    UPDATE employments 
    SET source_type = CASE WHEN id = 1 THEN 'employer_provided' ELSE 'employee_provided' END,
        verification_status = CASE WHEN id = 1 THEN 'Verified' ELSE 'Pending Employer Confirmation' END,
        hr_contact_name = CASE WHEN id = 1 THEN 'Ananya Rao' ELSE 'Lakeview HR Support' END,
        hr_contact_email = CASE WHEN id = 1 THEN 'hr.sunrise@example.com' ELSE 'hr.lakeview@example.com' END
    WHERE source_type IS NULL OR source_type = '';
  `);
}

// Run migrations on init
migrateDatabase();

export function getNowUtc(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

/**
 * Authentication queries
 */
export function findUserByEmail(email: string) {
  return db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email) as any;
}

export function findUserById(id: number) {
  return db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id) as any;
}

export function getAllDemoUsers() {
  return db.prepare('SELECT id, email, name, role FROM users').all() as any[];
}

export function getEmployeeProfile(userId: number) {
  return db.prepare('SELECT id, user_id, demo_emp_id, uan FROM employee_profiles WHERE user_id = ?').get(userId) as any;
}

export function getEmployerProfile(userId: number) {
  return db.prepare('SELECT id, user_id, name, establishment_id FROM employers WHERE user_id = ?').get(userId) as any;
}

/**
 * Employment records for employee
 */
export function getEmploymentsByEmployee(employeeId: number): RawEmploymentRecord[] {
  const rows = db.prepare(`
    SELECT id, employee_id, employer_name, establishment_id, pf_member_id, joining, exit_date,
           status, source_type, verification_status, notes, hr_contact_name, hr_contact_email, hr_contact_phone
    FROM employments
    WHERE employee_id = ?
    ORDER BY joining ASC
  `).all(employeeId) as any[];

  return rows.map(r => ({
    ...r,
    pf_masked: maskPfId(r.pf_member_id),
  }));
}

/**
 * Get single employment record with audit trail
 */
export function getEmploymentWithAudits(id: number, employeeId?: number) {
  const emp = (employeeId
    ? db.prepare('SELECT * FROM employments WHERE id = ? AND employee_id = ?').get(id, employeeId)
    : db.prepare('SELECT * FROM employments WHERE id = ?').get(id)) as any;

  if (!emp) return null;

  const audits = db.prepare(`
    SELECT id, employment_id, actor, action, field, old_value, new_value, reason, created_at
    FROM employment_audits
    WHERE employment_id = ?
    ORDER BY id DESC
  `).all(id) as any[];

  return {
    ...emp,
    pf_masked: maskPfId(emp.pf_member_id),
    audits,
  };
}

/**
 * Insert new employment record
 */
export function insertEmployment(employeeId: number, data: {
  employer_name: string;
  establishment_id?: string;
  pf_member_id: string;
  joining: string;
  exit_date?: string | null;
  status?: string;
  source_type?: string;
  hr_contact_name?: string;
  hr_contact_email?: string;
  hr_contact_phone?: string;
  notes?: string;
}, actor = 'employee') {
  const now = getNowUtc();
  const info = db.prepare(`
    INSERT INTO employments (
      employee_id, employer_name, establishment_id, pf_member_id,
      joining, exit_date, status, source_type, verification_status,
      notes, hr_contact_name, hr_contact_email, hr_contact_phone,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    employeeId,
    data.employer_name,
    data.establishment_id || null,
    data.pf_member_id,
    data.joining,
    data.exit_date || null,
    data.status || (data.exit_date ? 'Previous' : 'Current'),
    data.source_type || 'employee_provided',
    'Unverified',
    data.notes || null,
    data.hr_contact_name || null,
    data.hr_contact_email || null,
    data.hr_contact_phone || null,
    now,
    now
  );

  const empId = Number(info.lastInsertRowid);

  // Log audit
  db.prepare(`
    INSERT INTO employment_audits (employment_id, actor, action, field, new_value, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(empId, actor, 'CREATE', 'employment_record', JSON.stringify(data), 'Initial record created', now);

  return empId;
}

/**
 * Update employment record while strictly preserving history and never silently overwriting
 */
export function updateEmployment(
  empId: number,
  employeeId: number,
  updates: Partial<RawEmploymentRecord>,
  actor: string,
  reason = 'User record correction'
) {
  const existing = db.prepare('SELECT * FROM employments WHERE id = ? AND employee_id = ?').get(empId, employeeId) as any;
  if (!existing) {
    throw new Error('Employment record not found or unauthorized.');
  }

  const now = getNowUtc();

  // Audit each modified field
  for (const [key, newVal] of Object.entries(updates)) {
    if (key === 'id' || key === 'employee_id') continue;
    const oldVal = existing[key];
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      db.prepare(`
        INSERT INTO employment_audits (employment_id, actor, action, field, old_value, new_value, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(empId, actor, 'UPDATE', key, String(oldVal ?? ''), String(newVal ?? ''), reason, now);
    }
  }

  const updatedJoining = updates.joining !== undefined ? updates.joining : existing.joining;
  const updatedExit = updates.exit_date !== undefined ? updates.exit_date : existing.exit_date;
  const updatedStatus = updates.status !== undefined ? updates.status : (updatedExit ? 'Previous' : 'Current');
  const updatedNotes = updates.notes !== undefined ? updates.notes : existing.notes;
  const updatedHrName = updates.hr_contact_name !== undefined ? updates.hr_contact_name : existing.hr_contact_name;
  const updatedHrEmail = updates.hr_contact_email !== undefined ? updates.hr_contact_email : existing.hr_contact_email;
  const updatedHrPhone = updates.hr_contact_phone !== undefined ? updates.hr_contact_phone : existing.hr_contact_phone;

  db.prepare(`
    UPDATE employments
    SET joining = ?, exit_date = ?, status = ?, notes = ?,
        hr_contact_name = ?, hr_contact_email = ?, hr_contact_phone = ?,
        updated_at = ?
    WHERE id = ? AND employee_id = ?
  `).run(
    updatedJoining,
    updatedExit || null,
    updatedStatus,
    updatedNotes || null,
    updatedHrName || null,
    updatedHrEmail || null,
    updatedHrPhone || null,
    now,
    empId,
    employeeId
  );

  return true;
}

/**
 * Overlap Alert Statuses
 */
export function getAlertStatus(alertId: string, employeeId: number): string {
  const row = db.prepare('SELECT status FROM overlap_alert_states WHERE alert_id = ? AND employee_id = ?').get(alertId, employeeId) as any;
  return row ? row.status : 'Needs review';
}

export function setAlertStatus(alertId: string, employeeId: number, status: string, notes?: string) {
  const now = getNowUtc();
  db.prepare(`
    INSERT INTO overlap_alert_states (alert_id, employee_id, status, notes, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(alert_id) DO UPDATE SET
      status = excluded.status,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(alertId, employeeId, status, notes || null, now);
}

/**
 * Reconciliations & Dashboard records
 */
export function getReconciliationsByEmployee(employeeId: number) {
  const rows = db.prepare(`
    SELECT r.*, e.employer_name, e.pf_member_id, er.ecr_status, er.ecr_date, er.ecr_ref,
           er.trrn, er.pay_status, er.pay_date, er.emp_epf, er.er_epf, er.eps, er.updated_at as r_updated
    FROM reconciliations r
    JOIN employments e ON r.employment_id = e.id
    LEFT JOIN employer_records er ON r.employer_record_id = er.id
    WHERE r.employee_id = ?
    ORDER BY r.month DESC
  `).all(employeeId) as any[];

  return rows.map(r => ({
    ...r,
    pf_masked: maskPfId(r.pf_member_id),
  }));
}

/**
 * PF Contribution Cross-Check Data
 */
export function getPfContributionCrossCheck(employeeId: number) {
  const employments = getEmploymentsByEmployee(employeeId);
  const reconciliations = getReconciliationsByEmployee(employeeId);

  // Link each monthly record to employment and cross-check
  const items: any[] = [];

  for (const rec of reconciliations) {
    const emp = employments.find(e => e.id === rec.employment_id);
    const wageMonth = rec.month; // YYYY-MM
    let isWithin = false;

    if (emp && emp.joining) {
      const joinMonth = emp.joining.substring(0, 7);
      const exitMonth = emp.exit_date ? emp.exit_date.substring(0, 7) : '9999-99';
      isWithin = wageMonth >= joinMonth && wageMonth <= exitMonth;
    }

    let confidence = 'Estimate Only';
    if (rec.pay_status === 'Paid' && rec.ecr_status === 'Submitted') {
      confidence = 'Confirmed (Employer ECR + Payment)';
    } else if (rec.posted) {
      confidence = 'Passbook Only';
    } else if (rec.status_label === 'Needs review' || rec.classification === 'Potential overlap') {
      confidence = 'Discrepancy';
    }

    items.push({
      id: `cross_${rec.id}`,
      employment_id: rec.employment_id,
      employer_name: rec.employer_name,
      pf_member_masked: maskPfId(rec.pf_member_id),
      month: rec.month,
      employee_contribution: rec.emp_epf ?? rec.reported ?? rec.posted ?? null,
      employer_epf: rec.er_epf ?? null,
      employer_eps: rec.eps ?? null,
      expected_estimate: rec.expected ?? 1800,
      confidence,
      is_within_employment_dates: isWithin,
      notes: isWithin
        ? 'Within recorded employment period.'
        : 'Wage month falls outside recorded joining/exit dates for this organization.',
    });
  }

  return items;
}

/**
 * Employer Portal Queries - Strictly Isolated
 */
export function getEmployerDashboard(employerId: number) {
  const employer = db.prepare('SELECT * FROM employers WHERE id = ?').get(employerId) as any;
  if (!employer) return null;

  const records = db.prepare(`
    SELECT * FROM employer_records
    WHERE employer_id = ?
    ORDER BY month DESC
  `).all(employerId) as any[];

  // Corrections pending for this employer
  const corrections = db.prepare(`
    SELECT c.*, e.employer_name, u.name as employee_name
    FROM employer_corrections c
    JOIN employments e ON c.employment_id = e.id
    JOIN employee_profiles ep ON e.employee_id = ep.id
    JOIN users u ON ep.user_id = u.id
    WHERE c.employer_id = ?
    ORDER BY c.id DESC
  `).all(employerId) as any[];

  return {
    employer,
    records: records.map(r => ({
      ...r,
      pf_masked: maskPfId(r.pf_member_id),
    })),
    corrections,
  };
}

/**
 * Propose employer correction
 */
export function createEmployerCorrection(
  employerId: number,
  employmentId: number,
  field: string,
  proposedValue: string,
  reason: string,
  actor: string
) {
  const now = getNowUtc();
  const emp = db.prepare('SELECT * FROM employments WHERE id = ?').get(employmentId) as any;
  if (!emp) throw new Error('Employment record not found');

  const prevValue = emp[field] ?? null;

  const info = db.prepare(`
    INSERT INTO employer_corrections (
      employer_id, employment_id, field, previous_value, proposed_value,
      reason, status, actor, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Pending Review', ?, ?)
  `).run(employerId, employmentId, field, String(prevValue ?? ''), proposedValue, reason, actor, now);

  // Notify the employee
  const employeeProfile = db.prepare('SELECT user_id FROM employee_profiles WHERE id = ?').get(emp.employee_id) as any;
  if (employeeProfile) {
    db.prepare(`
      INSERT INTO notifications (user_id, message, sig, created_at, is_read)
      VALUES (?, ?, ?, ?, 0)
    `).run(
      employeeProfile.user_id,
      `Employer ${emp.employer_name} submitted a proposed correction for your ${field} record: "${proposedValue}".`,
      `correction_${info.lastInsertRowid}`,
      now
    );
  }

  return Number(info.lastInsertRowid);
}

/**
 * Review / Accept employer correction (by employee)
 */
export function reviewEmployerCorrection(correctionId: number, employeeId: number, accept: boolean) {
  const now = getNowUtc();
  const corr = db.prepare(`
    SELECT c.*, e.employee_id
    FROM employer_corrections c
    JOIN employments e ON c.employment_id = e.id
    WHERE c.id = ?
  `).get(correctionId) as any;

  if (!corr || corr.employee_id !== employeeId) {
    throw new Error('Correction not found or unauthorized.');
  }

  const newStatus = accept ? 'Accepted' : 'Rejected';
  db.prepare(`
    UPDATE employer_corrections
    SET status = ?, reviewed_at = ?
    WHERE id = ?
  `).run(newStatus, now, correctionId);

  if (accept) {
    // Apply correction to employments table
    updateEmployment(
      corr.employment_id,
      employeeId,
      { [corr.field]: corr.proposed_value } as any,
      corr.actor,
      `Accepted employer correction: ${corr.reason}`
    );
  }

  return true;
}

/**
 * Issues & Assistant
 */
export function getIssuesByEmployee(employeeId: number) {
  return db.prepare(`
    SELECT * FROM issues
    WHERE employee_id = ?
    ORDER BY id DESC
  `).all(employeeId) as any[];
}

export function createIssue(
  userId: number,
  employeeId: number,
  data: {
    category: string;
    title: string;
    description?: string;
    employment_id?: number;
    wage_month?: string;
    employer_name?: string;
    reference?: string;
    contact_key?: string;
    next_action?: string;
    follow_up_date?: string;
    dedupe_key: string;
  }
) {
  const now = getNowUtc();
  const info = db.prepare(`
    INSERT INTO issues (
      user_id, employee_id, category, title, description,
      employment_id, wage_month, employer_name, reference,
      contact_key, next_action, follow_up_date, status, dedupe_key,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?)
  `).run(
    userId,
    employeeId,
    data.category,
    data.title,
    data.description || null,
    data.employment_id || null,
    data.wage_month || null,
    data.employer_name || null,
    data.reference || null,
    data.contact_key || null,
    data.next_action || null,
    data.follow_up_date || null,
    data.dedupe_key,
    now,
    now
  );

  return Number(info.lastInsertRowid);
}

export function updateIssueStatus(issueId: number, employeeId: number, status: string, notes?: string) {
  const now = getNowUtc();
  db.prepare(`
    UPDATE issues
    SET status = ?, updated_at = ?
    WHERE id = ? AND employee_id = ?
  `).run(status, now, issueId, employeeId);

  if (notes) {
    db.prepare(`
      INSERT INTO issue_notes (issue_id, user_id, note, created_at)
      SELECT ?, user_id, ?, ? FROM issues WHERE id = ?
    `).run(issueId, notes, now, issueId);
  }

  return true;
}

/**
 * Demo Contacts Directory
 */
export function getDemoContacts() {
  return db.prepare('SELECT * FROM demo_contacts ORDER BY id ASC').all() as any[];
}

/**
 * Notifications
 */
export function getNotifications(userId: number) {
  return db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 20
  `).all(userId) as any[];
}

export function markNotificationsRead(userId: number) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
}
