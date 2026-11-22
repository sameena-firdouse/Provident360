/**
 * Employment Overlap Detection and Interval Engine
 * 
 * Rules and Conventions:
 * 1. Inclusive Day Counting Convention:
 *    The number of calendar days between startDate and endDate is inclusive:
 *    days = Math.floor((endDate - startDate) / 86400000) + 1
 *    Example: 2025-06-15 to 2025-06-30 inclusive = 16 calendar days.
 * 
 * 2. Ongoing Employment Handling:
 *    When an employment record has no exit_date (exit_date is null or empty),
 *    it represents ongoing current employment. For overlap detection with past records,
 *    it is treated as extending to the reference date (default: today) or open-ended.
 * 
 * 3. Same-Day Transitions:
 *    When Job A's exit date matches Job B's joining date (e.g., Job A exits on 2024-03-01
 *    and Job B joins on 2024-03-01), the inclusive overlap is exactly 1 calendar day.
 *    The engine classifies this as "Potential employment-date overlap" with a note
 *    "Same-day transition (1 calendar day overlap)", prompting the employee to clarify
 *    whether their last working day and new start day officially coincided.
 * 
 * 4. Duplicate Alert Prevention:
 *    Alerts are de-duplicated by unordered record pair (min(idA, idB), max(idA, idB)).
 * 
 * 5. Monthly PF Contributions Distinction:
 *    Monthly contributions (e.g., both employers depositing in March 2024) DO NOT
 *    establish daily employment dates. Overlaps are computed purely from verified/reported
 *    joining and exit dates.
 */

export interface RawEmploymentRecord {
  id: number;
  employee_id: number;
  employer_name: string;
  establishment_id?: string | null;
  pf_member_id: string;
  pf_masked?: string;
  joining: string; // YYYY-MM-DD
  exit_date?: string | null; // YYYY-MM-DD or null
  status?: string; // 'Current' | 'Previous' | 'Pending' | 'Disputed'
  source_type?: 'employee_provided' | 'employer_provided' | 'imported' | 'verified';
  verification_status?: 'Unverified' | 'Pending Employer Confirmation' | 'Verified' | 'Disputed';
  notes?: string | null;
  hr_contact_name?: string | null;
  hr_contact_email?: string | null;
  hr_contact_phone?: string | null;
}

export type WarningCategory =
  | 'Potential employment-date overlap'
  | 'Missing exit date'
  | 'Possible delayed exit update'
  | 'Employment gap'
  | 'Invalid or inconsistent dates'
  | 'Potential PF contribution inconsistency'
  | 'Needs employee verification'
  | 'Employer confirmation required';

export interface OverlapAlert {
  id: string; // unique dedupe key
  record1_id: number;
  record2_id: number;
  employer1_name: string;
  employer2_name: string;
  pf_member1_masked: string;
  pf_member2_masked: string;
  overlap_start: string; // YYYY-MM-DD
  overlap_end: string; // YYYY-MM-DD
  overlap_days: number;
  category: WarningCategory;
  severity: 'warning' | 'info' | 'error';
  is_same_day_transition: boolean;
  explanation: string;
  unknown_factors: string[];
  evidence_needed: string[];
  suggested_actions: string[];
  status: 'Needs review' | 'Contacted employer' | 'Awaiting response' | 'Correction requested' | 'Resolved' | 'Unable to resolve';
}

export interface EmploymentGap {
  id: string;
  previous_employer: string;
  previous_exit: string;
  next_employer: string;
  next_joining: string;
  gap_start: string;
  gap_end: string;
  gap_days: number;
  explanation: string;
}

export interface TimelineValidationResult {
  invalid_records: Array<{
    record_id: number;
    employer_name: string;
    issue: string;
    category: WarningCategory;
  }>;
  overlaps: OverlapAlert[];
  gaps: EmploymentGap[];
}

/**
 * Normalizes YYYY-MM-DD strings to integer days since Unix epoch (UTC)
 * to avoid timezone shifts or daylight saving issues.
 */
export function parseDateToUtc(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day));
}

export function formatUtcToDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar days inclusive:
 * Example: 2025-06-15 to 2025-06-30 inclusive = 16 calendar days.
 */
export function calculateInclusiveDays(startDateStr: string, endDateStr: string): number {
  const start = parseDateToUtc(startDateStr);
  const end = parseDateToUtc(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return 0;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function maskPfId(pfId?: string | null): string {
  if (!pfId) return '••••';
  const clean = pfId.trim();
  if (clean.length <= 4) return clean;
  return '••••' + clean.slice(-4);
}

/**
 * Runs overlap detection and timeline validation for a list of employment records.
 * Accepts an optional referenceDate (defaults to current UTC date).
 */
export function detectEmploymentOverlaps(
  records: RawEmploymentRecord[],
  referenceDateStr?: string
): TimelineValidationResult {
  const todayStr = referenceDateStr || formatUtcToDateString(new Date());
  const invalid_records: TimelineValidationResult['invalid_records'] = [];
  const overlaps: OverlapAlert[] = [];
  const gaps: EmploymentGap[] = [];

  // Filter and validate individual record intervals first
  const validRecords: Array<{
    record: RawEmploymentRecord;
    startDateStr: string;
    endDateStr: string;
    isOngoing: boolean;
  }> = [];

  for (const r of records) {
    if (!r.joining) {
      invalid_records.push({
        record_id: r.id,
        employer_name: r.employer_name,
        issue: 'Joining date is missing.',
        category: 'Invalid or inconsistent dates',
      });
      continue;
    }

    const joiningStr = r.joining.trim();
    const exitStr = r.exit_date ? r.exit_date.trim() : null;

    if (exitStr) {
      const joinDate = parseDateToUtc(joiningStr);
      const exitDate = parseDateToUtc(exitStr);
      if (exitDate.getTime() < joinDate.getTime()) {
        invalid_records.push({
          record_id: r.id,
          employer_name: r.employer_name,
          issue: `Exit date (${exitStr}) is earlier than joining date (${joiningStr}).`,
          category: 'Invalid or inconsistent dates',
        });
        continue;
      }
      validRecords.push({
        record: r,
        startDateStr: joiningStr,
        endDateStr: exitStr,
        isOngoing: false,
      });
    } else {
      // Ongoing employment without exit date
      validRecords.push({
        record: r,
        startDateStr: joiningStr,
        endDateStr: todayStr, // for interval calculations
        isOngoing: true,
      });
    }
  }

  // Detect pairwise overlaps
  const seenPairKeys = new Set<string>();

  for (let i = 0; i < validRecords.length; i++) {
    for (let j = i + 1; j < validRecords.length; j++) {
      const itemA = validRecords[i];
      const itemB = validRecords[j];

      // Ensure consistent deduplication key
      const minId = Math.min(itemA.record.id, itemB.record.id);
      const maxId = Math.max(itemA.record.id, itemB.record.id);
      const pairKey = `${minId}_${maxId}`;
      if (seenPairKeys.has(pairKey)) continue;

      // Intervals: [A_start, A_end] and [B_start, B_end]
      // Overlap occurs if max(A_start, B_start) <= min(A_end, B_end)
      const aStart = itemA.startDateStr;
      const aEnd = itemA.endDateStr;
      const bStart = itemB.startDateStr;
      const bEnd = itemB.endDateStr;

      const overlapStart = aStart > bStart ? aStart : bStart;
      const overlapEnd = aEnd < bEnd ? aEnd : bEnd;

      if (overlapStart <= overlapEnd) {
        seenPairKeys.add(pairKey);
        const inclusiveDays = calculateInclusiveDays(overlapStart, overlapEnd);
        const isSameDay = overlapStart === overlapEnd && inclusiveDays === 1;

        const isDelayedExitCandidate =
          (itemA.isOngoing && !itemB.isOngoing) ||
          (!itemA.isOngoing && itemB.isOngoing) ||
          (itemA.record.status === 'Previous' && !itemA.record.exit_date);

        const category: WarningCategory = isDelayedExitCandidate
          ? 'Possible delayed exit update'
          : 'Potential employment-date overlap';

        const explanation = isSameDay
          ? `Same-day transition detected between ${itemA.record.employer_name} and ${itemB.record.employer_name} on ${overlapStart} (1 calendar day). This may represent an overlapping last-working-day and joining day.`
          : `Employment dates for ${itemA.record.employer_name} and ${itemB.record.employer_name} overlap from ${overlapStart} to ${overlapEnd} (${inclusiveDays} calendar days inclusive).`;

        overlaps.push({
          id: `overlap_${pairKey}`,
          record1_id: itemA.record.id,
          record2_id: itemB.record.id,
          employer1_name: itemA.record.employer_name,
          employer2_name: itemB.record.employer_name,
          pf_member1_masked: maskPfId(itemA.record.pf_member_id),
          pf_member2_masked: maskPfId(itemB.record.pf_member_id),
          overlap_start: overlapStart,
          overlap_end: overlapEnd,
          overlap_days: inclusiveDays,
          category,
          severity: inclusiveDays > 30 ? 'warning' : 'info',
          is_same_day_transition: isSameDay,
          explanation,
          unknown_factors: [
            'Official last working day versus contractual notice period release date.',
            'Whether concurrent dual-employment was permitted or intended.',
            'Whether employer exit date was recorded or delayed in EPFO backend records.',
          ],
          evidence_needed: [
            'Relieving letter / Experience certificate showing official last working day.',
            'Formal appointment letter or joining confirmation from the succeeding employer.',
            'PF Member Passbook extract for the overlapping wage months.',
          ],
          suggested_actions: [
            'Review joining and exit dates against your relieving documents.',
            'Use the Guided Resolution assistant to request an exit-date correction from the earlier employer.',
            'Attach supporting relieving and appointment letters for record keeping.',
          ],
          status: 'Needs review',
        });
      }
    }
  }

  // Detect Gaps between chronologically ordered non-overlapping employments
  // Sort records by joining date
  const sortedByJoin = [...validRecords].sort((a, b) =>
    a.startDateStr.localeCompare(b.startDateStr)
  );

  for (let i = 0; i < sortedByJoin.length - 1; i++) {
    const current = sortedByJoin[i];
    const next = sortedByJoin[i + 1];

    // If current is ongoing, no gap after it
    if (current.isOngoing) continue;

    // A gap exists if next.startDateStr > current.endDateStr
    const currEnd = parseDateToUtc(current.endDateStr);
    const nextStart = parseDateToUtc(next.startDateStr);

    // Difference in milliseconds
    const diff = nextStart.getTime() - currEnd.getTime();
    const dayDiff = Math.round(diff / (1000 * 60 * 60 * 24));

    // If dayDiff > 1, there is at least 1 calendar day gap between exit and next join
    if (dayDiff > 1) {
      // The gap starts day after currEnd and ends day before nextStart
      const gapStartDate = new Date(currEnd.getTime() + 86400000);
      const gapEndDate = new Date(nextStart.getTime() - 86400000);
      const gapStartStr = formatUtcToDateString(gapStartDate);
      const gapEndStr = formatUtcToDateString(gapEndDate);
      const gapDays = calculateInclusiveDays(gapStartStr, gapEndStr);

      gaps.push({
        id: `gap_${current.record.id}_${next.record.id}`,
        previous_employer: current.record.employer_name,
        previous_exit: current.endDateStr,
        next_employer: next.record.employer_name,
        next_joining: next.startDateStr,
        gap_start: gapStartStr,
        gap_end: gapEndStr,
        gap_days: gapDays,
        explanation: `A gap of ${gapDays} calendar day(s) occurred between leaving ${current.record.employer_name} (${current.endDateStr}) and joining ${next.record.employer_name} (${next.startDateStr}). Employment gaps are common and are not treated as errors.`,
      });
    }
  }

  return {
    invalid_records,
    overlaps,
    gaps,
  };
}
