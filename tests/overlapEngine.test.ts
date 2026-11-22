import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInclusiveDays,
  detectEmploymentOverlaps,
  RawEmploymentRecord,
} from '../src/lib/overlapEngine.ts';

test('1. Inclusive day count: 15 June 2025 to 30 June 2025 equals 16 calendar days', () => {
  const days = calculateInclusiveDays('2025-06-15', '2025-06-30');
  assert.equal(days, 16, 'Should count start and end day inclusively (30 - 15 + 1 = 16)');
});

test('2. Non-overlapping consecutive employment periods (seamless transition)', () => {
  // Employer A ends 2024-02-29, Employer B starts 2024-03-01 -> 0 days overlap, 0 gap
  const records: RawEmploymentRecord[] = [
    {
      id: 1,
      employee_id: 1,
      employer_name: 'Employer A',
      pf_member_id: 'MEM-A',
      joining: '2023-01-01',
      exit_date: '2024-02-29',
      status: 'Previous',
    },
    {
      id: 2,
      employee_id: 1,
      employer_name: 'Employer B',
      pf_member_id: 'MEM-B',
      joining: '2024-03-01',
      exit_date: '2025-01-01',
      status: 'Current',
    },
  ];

  const result = detectEmploymentOverlaps(records, '2025-05-01');
  assert.equal(result.overlaps.length, 0, 'Consecutive days should not overlap');
  assert.equal(result.gaps.length, 0, 'Consecutive days should have 0 days gap');
  assert.equal(result.invalid_records.length, 0);
});

test('3. One-day overlap (same-day transition rule)', () => {
  // Employer A exit is 2024-03-01, Employer B joining is 2024-03-01
  const records: RawEmploymentRecord[] = [
    {
      id: 1,
      employee_id: 1,
      employer_name: 'Employer A',
      pf_member_id: 'MEM-A',
      joining: '2023-01-01',
      exit_date: '2024-03-01',
      status: 'Previous',
    },
    {
      id: 2,
      employee_id: 1,
      employer_name: 'Employer B',
      pf_member_id: 'MEM-B',
      joining: '2024-03-01',
      exit_date: '2024-12-31',
      status: 'Previous',
    },
  ];

  const result = detectEmploymentOverlaps(records, '2025-05-01');
  assert.equal(result.overlaps.length, 1);
  const alert = result.overlaps[0];
  assert.equal(alert.overlap_start, '2024-03-01');
  assert.equal(alert.overlap_end, '2024-03-01');
  assert.equal(alert.overlap_days, 1);
  assert.equal(alert.is_same_day_transition, true);
});

test('4. Multi-day overlap with correct inclusive count and prompt example', () => {
  // Employer A: 1 January 2024 to 30 June 2025
  // Employer B: 15 June 2025 to present
  // Expected overlap: 15 June 2025 to 30 June 2025 (16 days)
  const records: RawEmploymentRecord[] = [
    {
      id: 10,
      employee_id: 1,
      employer_name: 'Employer A',
      pf_member_id: 'MEM-10',
      joining: '2024-01-01',
      exit_date: '2025-06-30',
      status: 'Previous',
    },
    {
      id: 11,
      employee_id: 1,
      employer_name: 'Employer B',
      pf_member_id: 'MEM-11',
      joining: '2025-06-15',
      exit_date: null, // ongoing
      status: 'Current',
    },
  ];

  const result = detectEmploymentOverlaps(records, '2026-01-01');
  assert.equal(result.overlaps.length, 1);
  const alert = result.overlaps[0];
  assert.equal(alert.overlap_start, '2025-06-15');
  assert.equal(alert.overlap_end, '2025-06-30');
  assert.equal(alert.overlap_days, 16);
  assert.equal(alert.is_same_day_transition, false);
});

test('5. Multiple overlapping employers (3 concurrent records)', () => {
  // Emp 1: 2024-01-01 to 2024-06-30
  // Emp 2: 2024-04-01 to 2024-08-31
  // Emp 3: 2024-05-01 to 2024-10-31
  const records: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'Corp 1', pf_member_id: 'C1', joining: '2024-01-01', exit_date: '2024-06-30' },
    { id: 2, employee_id: 1, employer_name: 'Corp 2', pf_member_id: 'C2', joining: '2024-04-01', exit_date: '2024-08-31' },
    { id: 3, employee_id: 1, employer_name: 'Corp 3', pf_member_id: 'C3', joining: '2024-05-01', exit_date: '2024-10-31' },
  ];

  const result = detectEmploymentOverlaps(records, '2025-01-01');
  // Overlaps should be:
  // (1, 2): 2024-04-01 to 2024-06-30 (91 days)
  // (1, 3): 2024-05-01 to 2024-06-30 (61 days)
  // (2, 3): 2024-05-01 to 2024-08-31 (123 days)
  assert.equal(result.overlaps.length, 3);
  const pairKeys = result.overlaps.map(o => `${o.record1_id}_${o.record2_id}`).sort();
  assert.deepEqual(pairKeys, ['1_2', '1_3', '2_3']);
});

test('6. Missing exit date treated as ongoing employment', () => {
  const records: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'Corp 1', pf_member_id: 'C1', joining: '2023-01-01', exit_date: null, status: 'Current' },
    { id: 2, employee_id: 1, employer_name: 'Corp 2', pf_member_id: 'C2', joining: '2024-01-01', exit_date: '2024-06-30', status: 'Previous' },
  ];

  const result = detectEmploymentOverlaps(records, '2026-10-24');
  assert.equal(result.overlaps.length, 1);
  const alert = result.overlaps[0];
  assert.equal(alert.overlap_start, '2024-01-01');
  assert.equal(alert.overlap_end, '2024-06-30');
});

test('7. Invalid interval: exit date earlier than joining date', () => {
  const records: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'Broken Corp', pf_member_id: 'C1', joining: '2024-05-01', exit_date: '2024-02-01' },
  ];

  const result = detectEmploymentOverlaps(records, '2025-01-01');
  assert.equal(result.invalid_records.length, 1);
  assert.equal(result.invalid_records[0].category, 'Invalid or inconsistent dates');
  assert.match(result.invalid_records[0].issue, /earlier than joining date/);
});

test('8. Employment gap detection without error assumption', () => {
  // Exit: 2023-05-15, Next Join: 2023-08-01 -> Gap from 2023-05-16 to 2023-07-31
  const records: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'First Corp', pf_member_id: 'C1', joining: '2022-01-01', exit_date: '2023-05-15' },
    { id: 2, employee_id: 1, employer_name: 'Second Corp', pf_member_id: 'C2', joining: '2023-08-01', exit_date: '2024-01-01' },
  ];

  const result = detectEmploymentOverlaps(records, '2025-01-01');
  assert.equal(result.overlaps.length, 0);
  assert.equal(result.gaps.length, 1);
  const gap = result.gaps[0];
  assert.equal(gap.gap_start, '2023-05-16');
  assert.equal(gap.gap_end, '2023-07-31');
  assert.equal(gap.gap_days, 77);
  assert.match(gap.explanation, /not treated as errors/);
});

test('9. Record edits causing alerts to be created or cleared', () => {
  // Initial state with overlap:
  const records1: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'Corp 1', pf_member_id: 'C1', joining: '2022-01-01', exit_date: '2023-06-30' },
    { id: 2, employee_id: 1, employer_name: 'Corp 2', pf_member_id: 'C2', joining: '2023-06-01', exit_date: '2024-01-01' },
  ];
  const res1 = detectEmploymentOverlaps(records1);
  assert.equal(res1.overlaps.length, 1);

  // Corrected exit date to 2023-05-31:
  const records2: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'Corp 1', pf_member_id: 'C1', joining: '2022-01-01', exit_date: '2023-05-31' },
    { id: 2, employee_id: 1, employer_name: 'Corp 2', pf_member_id: 'C2', joining: '2023-06-01', exit_date: '2024-01-01' },
  ];
  const res2 = detectEmploymentOverlaps(records2);
  assert.equal(res2.overlaps.length, 0, 'Overlap cleared after correcting exit date');
});

test('10. Duplicate alert prevention', () => {
  const records: RawEmploymentRecord[] = [
    { id: 1, employee_id: 1, employer_name: 'Corp 1', pf_member_id: 'C1', joining: '2023-01-01', exit_date: '2023-06-30' },
    { id: 2, employee_id: 1, employer_name: 'Corp 2', pf_member_id: 'C2', joining: '2023-06-15', exit_date: '2024-01-01' },
  ];
  const res = detectEmploymentOverlaps(records);
  assert.equal(res.overlaps.length, 1, 'Only one alert generated for the pair (1, 2)');
});
