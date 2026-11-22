export interface User {
  id: number;
  email: string;
  name: string;
  role: 'employee' | 'employer';
}

export interface EmployerProfile {
  id: number;
  user_id: number;
  name: string;
  establishment_id: string;
}

export interface EmployeeProfile {
  id: number;
  user_id: number;
  demo_emp_id: string;
  uan: string;
}

export interface EmploymentRecord {
  id: number;
  employee_id: number;
  employer_name: string;
  establishment_id?: string | null;
  pf_member_id: string;
  pf_masked?: string;
  joining: string;
  exit_date?: string | null;
  status: 'Current' | 'Previous' | 'Pending' | 'Disputed';
  source_type: 'employee_provided' | 'employer_provided' | 'imported' | 'verified';
  verification_status: 'Unverified' | 'Pending Employer Confirmation' | 'Verified' | 'Disputed';
  notes?: string | null;
  hr_contact_name?: string | null;
  hr_contact_email?: string | null;
  hr_contact_phone?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmploymentAudit {
  id: number;
  employment_id: number;
  actor: string;
  action: string;
  field: string;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface EmployerCorrectionRequest {
  id: number;
  employer_id: number;
  employer_name?: string;
  employment_id: number;
  employee_id: number;
  employee_name?: string;
  field: string;
  previous_value?: string | null;
  proposed_value: string;
  reason: string;
  evidence_doc_ref?: string | null;
  status: 'Pending Review' | 'Accepted' | 'Rejected';
  actor: string;
  created_at: string;
  reviewed_at?: string | null;
}

export interface MonthlyRecord {
  id: number;
  employment_id: number;
  month: string; // YYYY-MM
  basic?: number | null;
  da?: number | null;
  pf_wages?: number | null;
  emp_contrib?: number | null;
  er_contrib?: number | null;
  passbook_emp?: number | null;
  passbook_er?: number | null;
  observed_ecr?: string | null;
  doc_ref?: string | null;
  updated_at?: string;
}

export interface EmployerMonthlyRecord {
  id: number;
  employer_id: number;
  employee_name: string;
  employee_ref?: string | null;
  uan?: string | null;
  pf_member_id: string;
  month: string;
  joining?: string | null;
  exit_date?: string | null;
  basic?: number | null;
  da?: number | null;
  pf_wages?: number | null;
  emp_epf?: number | null;
  er_epf?: number | null;
  eps?: number | null;
  ecr_status: 'Submitted' | 'Not submitted' | 'Pending';
  ecr_date?: string | null;
  ecr_ref?: string | null;
  trrn?: string | null;
  pay_status: 'Paid' | 'Pending' | 'Unknown';
  pay_date?: string | null;
  doc_ref?: string | null;
  version: number;
  updated_at?: string;
}

export interface ReconciliationRow {
  id: number;
  employee_id: number;
  employment_id: number;
  month: string;
  employer_record_id?: number | null;
  employer_name: string;
  pf_member_id: string;
  pf_masked?: string;
  status_label: string;
  classification: string;
  expected?: number | null;
  reported?: number | null;
  posted?: number | null;
  diff?: number | null;
  explanation: string;
  updated_at?: string;
  ecr_status?: string | null;
  ecr_date?: string | null;
  ecr_ref?: string | null;
  trrn?: string | null;
  pay_status?: string | null;
  pay_date?: string | null;
  emp_epf?: number | null;
  er_epf?: number | null;
  eps?: number | null;
  r_updated?: string | null;
}

export interface PfContributionCrossCheckItem {
  id: string;
  employment_id: number;
  employer_name: string;
  pf_member_masked: string;
  month: string;
  employee_contribution: number | null;
  employer_epf: number | null;
  employer_eps: number | null;
  expected_estimate: number | null;
  confidence: 'Confirmed (Employer ECR + Payment)' | 'Passbook Only' | 'Discrepancy' | 'Estimate Only';
  is_within_employment_dates: boolean;
  notes: string;
}

export interface ContactPersona {
  id: number;
  key: string;
  name: string;
  title: string;
  organization: string;
  email: string;
  handles: string;
  phone?: string;
  is_verified_demo: boolean;
  can_edit: boolean;
}

export interface IssueItem {
  id: number;
  user_id: number;
  employee_id: number;
  category: string;
  title: string;
  description?: string;
  employment_id?: number;
  reconciliation_id?: number;
  wage_month?: string;
  employer_name?: string;
  reference?: string;
  contact_key?: string;
  next_action?: string;
  follow_up_date?: string;
  status: 'Open' | 'Contacted employer' | 'Awaiting response' | 'Correction requested' | 'Resolved' | 'Unable to resolve';
  dedupe_key: string;
  created_at: string;
  updated_at: string;
}

export interface AttachedDocument {
  id: number;
  user_id: number;
  route?: string;
  purpose?: string;
  doc_type?: string;
  employment_id?: number;
  file_name: string;
  mime: string;
  size: number;
  verification_status: 'Unverified' | 'Verified' | 'Pending Review';
  created_at: string;
}
