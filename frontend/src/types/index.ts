export interface Organization {
  id: string;
  name: string;
  user_limit: number;
  licensing: 'Starter' | 'Professional' | 'Enterprise';
  expiry_date: string;
  logo_url?: string;
  console_uses: number;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile_no?: string;
  avatar_url?: string;
}

export interface CurrentOrg {
  id: string;
  name: string;
  role: 'admin' | 'member';
  licensing: 'Starter' | 'Professional' | 'Enterprise';
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  nomenclature: string;
  unique_code: string;
  client_name: string;
  profile: string;
  instruction: string;
  description: string;
  image_url: string;
  status: 'active' | 'completed' | 'on_hold';
  project_admin_id: string;
  radius_m: number;
  timezone: string;
  latitude: number;
  longitude: number;
  address: string;
  perm_location: boolean;
  perm_authentication: boolean;
  perm_rfi: boolean;
  updated_by: string;
  updated_at: string;
  created_at: string;
  members_count?: number;
  assigned_users?: string[];
  my_role?: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  type: 'inspection' | 'audit' | 'compliance';
  team_lead_name: string;
  spoc_name: string;
  active_projects: string;
  inactive_projects: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

export interface ChecklistCheckpoint {
  id: string;
  stage_id: string;
  sr_no: number;
  question: string;
  input_type: 'yes_no' | 'options' | 'text' | 'numeric' | 'date';
  options?: string[];
  fail_rule?: string;
  drawing_required: boolean;
  witness_required: boolean;
  photo_required: boolean;
  remark_required: boolean;
  created_at: string;
}

export interface ChecklistStage {
  id: string;
  checklist_id: string;
  sr_no: number;
  name: string;
  witness_required: boolean;
  drawing_required: boolean;
  checkpoints: ChecklistCheckpoint[];
  created_at: string;
}

export interface Checklist {
  id: string;
  organization_id: string;
  project_id: string | null;
  project_name?: string;
  name: string;
  reference_number: string;
  uom: string;
  status: 'active' | 'inactive';
  stages_count?: number;
  checkpoints_count?: number;
  updated_by: string;
  updated_at: string;
  created_at: string;
  source?: 'org' | 'library';
}

export interface EQC {
  id: string;
  project_id: string;
  location: string;
  checklist_id: string;
  checklist_name: string;
  stage_index: number;
  total_stages: number;
  stage_result: 'pass' | 'fail' | 'pending';
  approver_id?: string;
  approver_name?: string;
  approver_log?: string;
  status: 'passed' | 'failed' | 'pending' | 'rfi';
  inspected_by: string;
  inspected_at: string;
  rfi_id?: string;
  notes?: string;
  created_at: string;
}

export interface Issue {
  id: string;
  project_id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignee_id?: string;
  assignee_name?: string;
  reported_by: string;
  due_date: string;
  created_at: string;
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

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: 'admin' | 'member' | 'inspector' | 'approver' | 'viewer';
  added_at: string;
}
