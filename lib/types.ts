export interface Organization {
  id: string;
  name: string;
  user_limit: number;
  licensing: string;
  expiry_date: string | null;
  logo_url: string;
  console_uses: number;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
  created_at: string;
}

export interface OrgWithRole {
  id: string;
  name: string;
  licensing: string;
  logo_url: string;
  role: 'admin' | 'member';
}

export interface SuperAdmin {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  mobile_no: string;
  roles: string[];
  created_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  team_lead_name: string;
  spoc_name: string;
  active_projects: string;
  inactive_projects: string;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  nomenclature: string;
  instruction: string;
  profile: string;
  image_url: string;
  status: 'active' | 'completed' | 'on_hold';
  // v2 fields
  unique_code?: string;
  client_name?: string;
  description?: string;
  project_admin_id?: string;
  radius_m?: number;
  timezone?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  perm_location?: boolean;
  perm_authentication?: boolean;
  perm_rfi?: boolean;
  updated_by?: string;
  updated_at?: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'inspector' | 'approver' | 'viewer';
  added_at: string;
  // joined
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export interface ProjectTeam {
  id: string;
  project_id: string;
  team_id: string;
  added_at: string;
  team_name?: string;
}

export interface Checklist {
  id: string;
  project_id: string | null;
  name: string;
  reference_number?: string;
  uom?: string;
  status?: 'active' | 'inactive';
  updated_by?: string;
  updated_at?: string;
  created_at: string;
  project?: { name: string };
  source?: 'org' | 'library';
}

export interface ChecklistStage {
  id: string;
  checklist_id: string;
  sr_no: number;
  name: string;
  witness_required?: boolean;
  drawing_required?: boolean;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  stage_id: string;
  sr_no: number;
  question: string;
  input_type: 'yes_no' | 'numeric' | 'text' | 'options' | 'date';
  drawing_required: boolean;
  witness_required: boolean;
  photo_required?: boolean;
  remark_required?: boolean;
  created_at: string;
}

export interface EQC {
  id: string;
  project_id: string;
  location: string;
  checklist_id: string | null;
  stage_index: number;
  total_stages: number;
  stage_result: 'pass' | 'fail' | 'pending';
  approver_id: string | null;
  approver_log: string;
  status: 'passed' | 'failed' | 'pending' | 'rfi';
  inspected_by: string | null;
  inspected_at: string | null;
  rfi_id: string | null;
  notes: string;
  created_at: string;
  // joined
  checklist_name?: string;
  inspector_name?: string;
  approver_name?: string;
}

export interface Issue {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignee_id: string | null;
  reported_by: string | null;
  due_date: string | null;
  created_at: string;
  assignee_name?: string;
}

export interface RegisterEntry {
  id: string;
  project_id: string;
  document_no: string;
  title: string;
  revision: string;
  status: 'active' | 'superseded' | 'void';
  file_url: string;
  created_at: string;
}

export interface ProjectTarget {
  id: string;
  project_id: string;
  metric: string;
  target_value: number;
  current_value: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'project';
  created_at: string;
}

export interface Nomenclature {
  id: string;
  project_id: string;
  prefix: string;
  description: string;
  example: string;
  created_at: string;
}

export type NavSection =
  | 'dashboard'
  | 'projects'
  | 'checklists'
  | 'teams'
  | 'organizations'
  | 'setup';

// Common timezones for the Site Details form
export const TIMEZONES = [
  'Asia/Calcutta',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Africa/Johannesburg',
  'UTC',
] as const;
