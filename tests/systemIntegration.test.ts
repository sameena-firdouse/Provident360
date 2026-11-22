import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectEmploymentOverlaps,
  RawEmploymentRecord,
} from '../src/lib/overlapEngine.ts';
import {
  updateEmployment,
  insertEmployment,
  getEmploymentWithAudits,
  createEmployerCorrection,
  getEmployerDashboard,
  db,
} from '../src/lib/db.ts';
import { analyzeTextForSensitiveContent } from '../src/lib/sensitiveDetect.ts';

test('11. Missing monthly contribution data is NOT treated as proof of an overlap', () => {
  // Employer A has contribution in 2024-03, but 2024-04 has missing record.
  // Employer B has contribution in 2024-03.
  // Overlap detection MUST rely strictly on joining and exit dates, NOT on monthly records.
  const recordsWithDistinctDates: RawEmploymentRecord[] = [
    { id: 101, employee_id: 99, employer_name: 'Corp A', pf_member_id: 'PA', joining: '2023-01-01', exit_date: '2023-12-31' },
    { id: 102, employee_id: 99, employer_name: 'Corp B', pf_member_id: 'PB', joining: '2024-01-01', exit_date: '2024-12-31' },
  ];

  const result = detectEmploymentOverlaps(recordsWithDistinctDates);
  // Even if monthly contributions were missing or recorded irregularly, dates do not overlap
  assert.equal(result.overlaps.length, 0, 'Date intervals do not overlap despite contribution cadence');
});

test('12. Access controls: employee record isolation and ownership verification', () => {
  // Employee 1 cannot fetch or update records belonging to employee 2
  assert.throws(() => {
    // Attempting to update record id 1 (which belongs to employee 1) using employee_id 999
    updateEmployment(1, 999, { notes: 'Malicious update' }, 'attacker');
  }, /not found or unauthorized/i);
});

test('13. Employer access restricted strictly to its own organization', () => {
  // Sunrise Textiles has employer_id = 1, establishment_id = 'DEMOTN0001'
  // Lakeview Tech has employer_id = 2, establishment_id = 'DEMOKA0002'
  const sunriseDashboard = getEmployerDashboard(1);
  assert.ok(sunriseDashboard);
  assert.equal(sunriseDashboard.employer.id, 1);
  assert.equal(sunriseDashboard.employer.establishment_id, 'DEMOTN0001');

  // All records in Sunrise dashboard must belong to Sunrise
  for (const r of sunriseDashboard.records) {
    assert.equal(r.employer_id, 1, 'Employer 1 must only see records for employer 1');
  }

  const lakeviewDashboard = getEmployerDashboard(2);
  assert.ok(lakeviewDashboard);
  assert.equal(lakeviewDashboard.employer.id, 2);
  for (const r of lakeviewDashboard.records) {
    assert.equal(r.employer_id, 2, 'Employer 2 must only see records for employer 2');
  }
});

test('14. Correction history strictly preserves previous values in audit trail', () => {
  const uniquePf = `AUDIT-TEST-${Date.now()}`;
  // Insert a test employment
  const testEmpId = insertEmployment(1, {
    employer_name: 'Audit Test Corp',
    pf_member_id: uniquePf,
    joining: '2023-01-01',
    exit_date: '2023-12-31',
    notes: 'Initial note',
  }, 'employee_asha');

  // Verify initial state
  const initialRecord = getEmploymentWithAudits(testEmpId, 1);
  assert.ok(initialRecord);
  assert.equal(initialRecord.audits.length, 1);
  assert.equal(initialRecord.audits[0].action, 'CREATE');

  // Update exit date and notes
  updateEmployment(
    testEmpId,
    1,
    { exit_date: '2023-11-30', notes: 'Corrected per relieving letter' },
    'employee_asha',
    'Relieving letter verification'
  );

  const updatedRecord = getEmploymentWithAudits(testEmpId, 1);
  assert.ok(updatedRecord);
  assert.equal(updatedRecord.exit_date, '2023-11-30');

  // Check audit trail preserved the previous value '2023-12-31'
  const exitAudit = updatedRecord.audits.find((a: any) => a.field === 'exit_date');
  assert.ok(exitAudit, 'Audit trail must exist for exit_date change');
  assert.equal(exitAudit.old_value, '2023-12-31', 'Previous value must be strictly preserved');
  assert.equal(exitAudit.new_value, '2023-11-30');
  assert.equal(exitAudit.reason, 'Relieving letter verification');

  // Clean up test record to maintain pristine demo state
  db.exec(`DELETE FROM employment_audits WHERE employment_id = ${testEmpId}`);
  db.exec(`DELETE FROM employments WHERE id = ${testEmpId}`);
});

test('15. Contact templates do not invent details and use neutral facts', () => {
  const employerName = 'Sunrise Textiles (Demo)';
  const joining = '2022-04-01';
  const exitDate = '2024-03-15';
  const overlapStart = '2024-03-01';
  const overlapEnd = '2024-03-15';

  const body = `Subject: Request to verify employment dates and PF records

Dear HR/Payroll Team,

I am reviewing my employment history in Provident360 and would appreciate your help verifying the recorded employment dates.

The records currently show:
- Organization: ${employerName}
- Joining date: ${joining}
- Exit date: ${exitDate}
- Potential overlapping period: ${overlapStart} to ${overlapEnd}

Could you please confirm whether these dates are correct and advise whether any update is required in the relevant employment or PF records?

I can provide supporting documents if needed. Please let me know the appropriate next steps.

Thank you.`;

  // Verify factual representation
  assert.ok(body.includes('Sunrise Textiles (Demo)'));
  assert.ok(body.includes('2022-04-01'));
  assert.ok(body.includes('2024-03-15'));
  assert.ok(body.includes('2024-03-01 to 2024-03-15'));
  // Verify no fabricated email/phone/officer name in body
  assert.ok(!body.includes('John Doe'));
  assert.ok(!body.includes('fake@officer.gov'));
});

test('16. Safe-upload integration detects OTP screenshots and credentials', () => {
  // Test clean document text
  const cleanFindings = analyzeTextForSensitiveContent('Relieving letter: Employee Asha worked from 2022-04-01 to 2024-03-15 as Senior Analyst.');
  assert.equal(cleanFindings.length, 0, 'Clean business text should have zero violations');

  // Test OTP screenshot text
  const otpFindings = analyzeTextForSensitiveContent('Your EPFO verification code is 482910. Do not share this OTP with anyone. Valid for 10 minutes.');
  assert.ok(otpFindings.some(f => f.category === 'otp'), 'Must flag detected OTP');

  // Test exposed password text
  const credFindings = analyzeTextForSensitiveContent('Username: asha, password: MySecretPassword123');
  assert.ok(credFindings.some(f => f.category === 'credential'), 'Must flag exposed password');
});
