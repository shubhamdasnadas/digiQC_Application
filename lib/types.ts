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
  created_at: string;
}

export interface Checklist {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
}

export interface ChecklistStage {
  id: string;
  checklist_id: string;
  sr_no: number;
  name: string;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  stage_id: string;
  question: string;
  input_type: 'yes_no' | 'numeric' | 'text';
  drawing_required: boolean;
  witness_required: boolean;
  created_at: string;
}

export type NavSection =
  | 'dashboard'
  | 'projects'
  | 'checklists'
  | 'teams'
  | 'organizations'
  | 'setup';
