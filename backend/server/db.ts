import { randomUUID as uuidv4 } from 'crypto';

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
  password_hash: string;
  avatar_url?: string;
  mobile_no?: string;
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

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  nomenclature: string;
  instruction: string;
  profile: string;
  image_url: string;
  status: 'active' | 'completed' | 'on_hold';
  unique_code: string;
  client_name: string;
  description: string;
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
  fail_rule?: string; // e.g. "No" or condition value
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
  project_id: string | null; // null means org-generic library
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

// In-Memory Database Store
class DatabaseStore {
  public organizations: Organization[] = [];
  public users: User[] = [];
  public orgMembers: OrgMember[] = [];
  public projects: Project[] = [];
  public teams: Team[] = [];
  public teamMembers: TeamMember[] = [];
  public checklists: Checklist[] = [];
  public stages: ChecklistStage[] = [];
  public checkpoints: ChecklistCheckpoint[] = [];
  public eqcs: EQC[] = [];
  public issues: Issue[] = [];
  public registerEntries: RegisterEntry[] = [];
  public projectTargets: ProjectTarget[] = [];
  public projectMembers: ProjectMember[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    const org1Id = 'org-city-hospital';
    const org2Id = 'org-green-ross';
    const org3Id = 'org-coastal-resorts';

    this.organizations = [
      {
        id: org1Id,
        name: 'City Hospital',
        user_limit: 50,
        licensing: 'Enterprise',
        expiry_date: '2027-12-31',
        logo_url: 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg',
        console_uses: 1420,
        created_at: '2025-01-15T08:00:00Z',
      },
      {
        id: org2Id,
        name: 'Green Ross Infrastructure',
        user_limit: 25,
        licensing: 'Professional',
        expiry_date: '2026-10-15',
        logo_url: 'https://images.pexels.com/photos/159358/construction-site-build-construction-structure-159358.jpeg',
        console_uses: 890,
        created_at: '2025-02-01T10:30:00Z',
      },
      {
        id: org3Id,
        name: 'Coastal Resorts Group',
        user_limit: 10,
        licensing: 'Starter',
        expiry_date: '2026-08-30',
        logo_url: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg',
        console_uses: 310,
        created_at: '2025-03-12T14:15:00Z',
      },
    ];

    const u1 = 'usr-sarvesh';
    const u2 = 'usr-mayuresh';
    const u3 = 'usr-pankti';
    const u4 = 'usr-vishal';

    this.users = [
      {
        id: u1,
        name: 'Sarvesh Gupta',
        email: 'sarvesh.gupta@pranavconstructions.com',
        password_hash: '$2a$12$eImiTXuWVxfM37uY4JANjO9K8N9h0U0G83k0g8b2Z5kXgO5z9bKiu', // 'password'
        mobile_no: '+91 97457 917773',
        created_at: '2025-01-01T00:00:00Z',
      },
      {
        id: u2,
        name: 'Mayuresh Jadhav',
        email: 'mayuresh.jadhav@pranavconstructions.com',
        password_hash: '$2a$12$eImiTXuWVxfM37uY4JANjO9K8N9h0U0G83k0g8b2Z5kXgO5z9bKiu',
        mobile_no: '+91 97698 74571',
        created_at: '2025-01-02T00:00:00Z',
      },
      {
        id: u3,
        name: 'Pankti Mehta',
        email: 'pankti.mehta@pranavconstructions.com',
        password_hash: '$2a$12$eImiTXuWVxfM37uY4JANjO9K8N9h0U0G83k0g8b2Z5kXgO5z9bKiu',
        mobile_no: '+91 73038 44757',
        created_at: '2025-01-03T00:00:00Z',
      },
      {
        id: u4,
        name: 'Vishal Kadam',
        email: 'vishal.kadam@pranavconstructions.com',
        password_hash: '$2a$12$eImiTXuWVxfM37uY4JANjO9K8N9h0U0G83k0g8b2Z5kXgO5z9bKiu',
        mobile_no: '+91 99671 87333',
        created_at: '2025-01-04T00:00:00Z',
      },
    ];

    this.orgMembers = [
      { id: 'om-1', user_id: u1, organization_id: org1Id, role: 'admin', status: 'active', created_at: '2025-01-15T08:00:00Z' },
      { id: 'om-2', user_id: u2, organization_id: org1Id, role: 'member', status: 'active', created_at: '2025-01-16T08:00:00Z' },
      { id: 'om-3', user_id: u3, organization_id: org1Id, role: 'admin', status: 'active', created_at: '2025-01-17T08:00:00Z' },
      { id: 'om-4', user_id: u4, organization_id: org1Id, role: 'member', status: 'active', created_at: '2025-01-18T08:00:00Z' },
      { id: 'om-5', user_id: u1, organization_id: org2Id, role: 'admin', status: 'active', created_at: '2025-02-01T10:30:00Z' },
      { id: 'om-6', user_id: u2, organization_id: org2Id, role: 'member', status: 'active', created_at: '2025-02-02T10:30:00Z' },
      { id: 'om-7', user_id: u1, organization_id: org3Id, role: 'admin', status: 'active', created_at: '2025-03-12T14:15:00Z' },
    ];

    const p1 = 'proj-aurora';
    const p2 = 'proj-falcon-crest';
    const p3 = 'proj-42-aura';
    const p4 = 'proj-om-manikanta';

    this.projects = [
      {
        id: p1,
        organization_id: org1Id,
        name: 'AURORA Tower A',
        nomenclature: 'AUR-T1',
        unique_code: 'PCPL-AUR-2025',
        client_name: 'Sunrise Realty Partners',
        profile: 'Civil Structural & High-Rise Finishing',
        instruction: 'Ensure 100% stage sign-off before concrete pour. Check all MEP sleeves in slab.',
        image_url: 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg',
        status: 'active',
        description: 'Multi-storey luxury residential tower featuring 32 floors with RCC framed structure and modern amenities.',
        project_admin_id: u1,
        radius_m: 150,
        timezone: 'Asia/Calcutta',
        latitude: 19.0760,
        longitude: 72.8777,
        address: 'Plot 42, Sector 18, Powai, Mumbai',
        perm_location: true,
        perm_authentication: true,
        perm_rfi: true,
        updated_by: 'Sarvesh Gupta',
        updated_at: '2026-07-20T11:00:00Z',
        created_at: '2025-02-10T09:00:00Z',
      },
      {
        id: p2,
        organization_id: org1Id,
        name: 'FALCON CREST Commercial',
        nomenclature: 'FLC-C2',
        unique_code: 'PCPL-FLC-2025',
        client_name: 'Meridian Infra Corp',
        profile: 'Commercial IT Park & Structural Glazing',
        instruction: 'Special emphasis on post-tensioning slab tendon elongation and fire safety risers.',
        image_url: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg',
        status: 'active',
        description: 'Grade-A commercial IT park with 2 basements, podium parking and PT slab construction.',
        project_admin_id: u3,
        radius_m: 200,
        timezone: 'Asia/Calcutta',
        latitude: 19.1136,
        longitude: 72.8697,
        address: 'Andheri East Industrial Zone, Mumbai',
        perm_location: true,
        perm_authentication: true,
        perm_rfi: false,
        updated_by: 'Pankti Mehta',
        updated_at: '2026-07-18T15:30:00Z',
        created_at: '2025-03-01T10:00:00Z',
      },
      {
        id: p3,
        organization_id: org1Id,
        name: '42 AURA Residences',
        nomenclature: '42A-R1',
        unique_code: 'PCPL-42A-2025',
        client_name: 'Aura Developers',
        profile: 'Interior Finishing & Gypsum Plastering',
        instruction: 'Daily inspection of block masonry line-level and water-testing in all toilet sunks.',
        image_url: 'https://images.pexels.com/photos/259950/pexels-photo-259950.jpeg',
        status: 'active',
        description: 'Boutique premium apartments with customized Mivan formwork shuttering.',
        project_admin_id: u2,
        radius_m: 100,
        timezone: 'Asia/Calcutta',
        latitude: 19.0176,
        longitude: 72.8561,
        address: 'Worli Sea Face, Mumbai',
        perm_location: true,
        perm_authentication: false,
        perm_rfi: true,
        updated_by: 'Mayuresh Jadhav',
        updated_at: '2026-07-21T09:45:00Z',
        created_at: '2025-04-15T12:00:00Z',
      },
      {
        id: p4,
        organization_id: org1Id,
        name: 'OM MANIKANTA Complex',
        nomenclature: 'OMM-C1',
        unique_code: 'PCPL-OMM-2025',
        client_name: 'Vipul J. Patel Developers',
        profile: 'Foundation Piling & Basement Retaining Wall',
        instruction: 'Verify shore pile depth and ultrasonic integrity testing prior to pile cap casting.',
        image_url: 'https://images.pexels.com/photos/159358/construction-site-build-construction-structure-159358.jpeg',
        status: 'on_hold',
        description: 'Redevelopment housing project currently in foundation and basement excavation stage.',
        project_admin_id: u4,
        radius_m: 100,
        timezone: 'Asia/Calcutta',
        latitude: 19.1760,
        longitude: 72.8480,
        address: 'Malad West, Mumbai',
        perm_location: false,
        perm_authentication: true,
        perm_rfi: true,
        updated_by: 'Vishal Kadam',
        updated_at: '2026-07-05T14:20:00Z',
        created_at: '2025-05-01T11:00:00Z',
      },
    ];

    const t1 = 'team-main';
    const t2 = 'team-leak-art';
    const t3 = 'team-pg-const';

    this.teams = [
      {
        id: t1,
        organization_id: org1Id,
        name: 'Main Quality & Execution Team',
        type: 'inspection',
        team_lead_name: 'Sarvesh Gupta',
        spoc_name: 'Mayuresh Jadhav',
        active_projects: 'AURORA Tower A, FALCON CREST Commercial, 42 AURA Residences',
        inactive_projects: 'OM MANIKANTA Complex',
        created_at: '2025-01-20T10:00:00Z',
      },
      {
        id: t2,
        organization_id: org1Id,
        name: 'Leak Art Water Proofing Team',
        type: 'audit',
        team_lead_name: 'R K Waterworks',
        spoc_name: 'Pankti Mehta',
        active_projects: 'AURORA Tower A, 42 AURA Residences',
        inactive_projects: '',
        created_at: '2025-02-15T11:30:00Z',
      },
      {
        id: t3,
        organization_id: org1Id,
        name: 'Safety & Compliance Audit Cell',
        type: 'compliance',
        team_lead_name: 'Vishal Kadam',
        spoc_name: 'Sarvesh Gupta',
        active_projects: 'FALCON CREST Commercial',
        inactive_projects: '',
        created_at: '2025-03-01T09:15:00Z',
      },
    ];

    this.teamMembers = [
      { id: 'tm-1', team_id: t1, user_id: u1, name: 'Sarvesh Gupta', email: 'sarvesh.gupta@pranavconstructions.com', role: 'Team Lead', joined_at: '2025-01-20T10:00:00Z' },
      { id: 'tm-2', team_id: t1, user_id: u2, name: 'Mayuresh Jadhav', email: 'mayuresh.jadhav@pranavconstructions.com', role: 'Senior Inspector', joined_at: '2025-01-21T10:00:00Z' },
      { id: 'tm-3', team_id: t2, user_id: u3, name: 'Pankti Mehta', email: 'pankti.mehta@pranavconstructions.com', role: 'Auditor', joined_at: '2025-02-15T11:30:00Z' },
      { id: 'tm-4', team_id: t3, user_id: u4, name: 'Vishal Kadam', email: 'vishal.kadam@pranavconstructions.com', role: 'Compliance Officer', joined_at: '2025-03-01T09:15:00Z' },
    ];

    const c1 = 'chk-beam-slab';
    const c2 = 'chk-col-starter';
    const c3 = 'chk-block-masonry';
    const c4 = 'chk-waterproofing';

    this.checklists = [
      {
        id: c1,
        organization_id: org1Id,
        project_id: p1,
        name: 'Arch - Beam & Slab Checking',
        reference_number: 'PCPL/ARCH/BEAM-SLAB-SHT/2025/0001',
        uom: 'Slab Pour (Sft)',
        status: 'active',
        stages_count: 3,
        checkpoints_count: 12,
        updated_by: 'Sarvesh Gupta',
        updated_at: '2026-07-15T10:00:00Z',
        created_at: '2025-02-12T08:00:00Z',
        source: 'org',
      },
      {
        id: c2,
        organization_id: org1Id,
        project_id: p1,
        name: 'Arch - Column Starter & Verticality',
        reference_number: 'PCPL/ARCH/COL-STARTER/2025/0002',
        uom: 'Nos',
        status: 'active',
        stages_count: 2,
        checkpoints_count: 8,
        updated_by: 'Mayuresh Jadhav',
        updated_at: '2026-07-18T14:20:00Z',
        created_at: '2025-02-15T09:00:00Z',
        source: 'org',
      },
      {
        id: c3,
        organization_id: org1Id,
        project_id: p3,
        name: 'Arch - Block Masonry & Lintel',
        reference_number: 'PCPL/ARCH/MSNRY/2025/0003',
        uom: 'Rft/Sft',
        status: 'active',
        stages_count: 2,
        checkpoints_count: 9,
        updated_by: 'Pankti Mehta',
        updated_at: '2026-07-19T16:00:00Z',
        created_at: '2025-03-01T11:00:00Z',
        source: 'org',
      },
      {
        id: c4,
        organization_id: org1Id,
        project_id: null, // Shared Library Template
        name: 'Exec - Toilet & Kitchen Waterproofing',
        reference_number: 'PCPL/EXEC/WATP/2025/0004',
        uom: 'Sq. Meter',
        status: 'active',
        stages_count: 3,
        checkpoints_count: 10,
        updated_by: 'System Standard',
        updated_at: '2026-01-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        source: 'library',
      },
    ];

    // Stages for Beam & Slab
    const s1 = 'stg-pre-pour';
    const s2 = 'stg-during-pour';
    const s3 = 'stg-post-pour';

    this.stages = [
      {
        id: s1,
        checklist_id: c1,
        sr_no: 1,
        name: 'Pre-Concreting Shuttering & Steel Inspection',
        witness_required: true,
        drawing_required: true,
        created_at: '2025-02-12T08:00:00Z',
        checkpoints: [
          {
            id: 'cp-1',
            stage_id: s1,
            sr_no: 1,
            question: 'Slab shuttering measurements and level (TOS) checked against Architectural WD?',
            input_type: 'yes_no',
            fail_rule: 'No',
            drawing_required: true,
            witness_required: true,
            photo_required: true,
            remark_required: true,
            created_at: '2025-02-12T08:00:00Z',
          },
          {
            id: 'cp-2',
            stage_id: s1,
            sr_no: 2,
            question: 'Electrical conduits and junction boxes placed according to lower floor blockwork layout?',
            input_type: 'yes_no',
            fail_rule: 'No',
            drawing_required: true,
            witness_required: false,
            photo_required: true,
            remark_required: false,
            created_at: '2025-02-12T08:00:00Z',
          },
          {
            id: 'cp-3',
            stage_id: s1,
            sr_no: 3,
            question: 'Plumbing sleeves and cut-outs provided for drain risers and vent pipes?',
            input_type: 'yes_no',
            fail_rule: 'No',
            drawing_required: true,
            witness_required: true,
            photo_required: true,
            remark_required: true,
            created_at: '2025-02-12T08:00:00Z',
          },
          {
            id: 'cp-4',
            stage_id: s1,
            sr_no: 4,
            question: 'Slab cover block thickness verified in mm (Standard 20mm-25mm)?',
            input_type: 'numeric',
            fail_rule: '<20',
            drawing_required: false,
            witness_required: false,
            photo_required: true,
            remark_required: true,
            created_at: '2025-02-12T08:00:00Z',
          },
        ],
      },
      {
        id: s2,
        checklist_id: c1,
        sr_no: 2,
        name: 'During Concrete Pouring Inspection',
        witness_required: true,
        drawing_required: false,
        created_at: '2025-02-12T08:10:00Z',
        checkpoints: [
          {
            id: 'cp-5',
            stage_id: s2,
            sr_no: 1,
            question: 'Concrete slump test result at pour site (target 120-140 mm)?',
            input_type: 'numeric',
            fail_rule: '<120',
            drawing_required: false,
            witness_required: true,
            photo_required: true,
            remark_required: true,
            created_at: '2025-02-12T08:10:00Z',
          },
          {
            id: 'cp-6',
            stage_id: s2,
            sr_no: 2,
            question: 'Is needle vibrator used systematically with zero concrete segregation?',
            input_type: 'yes_no',
            fail_rule: 'No',
            drawing_required: false,
            witness_required: false,
            photo_required: false,
            remark_required: false,
            created_at: '2025-02-12T08:10:00Z',
          },
        ],
      },
      {
        id: s3,
        checklist_id: c1,
        sr_no: 3,
        name: 'Post-Pour Deshuttering & Curing Quality',
        witness_required: false,
        drawing_required: false,
        created_at: '2025-02-12T08:20:00Z',
        checkpoints: [
          {
            id: 'cp-7',
            stage_id: s3,
            sr_no: 1,
            question: 'Ponding curing setup maintained on top slab surface for minimum 7 days?',
            input_type: 'yes_no',
            fail_rule: 'No',
            drawing_required: false,
            witness_required: true,
            photo_required: true,
            remark_required: true,
            created_at: '2025-02-12T08:20:00Z',
          },
          {
            id: 'cp-8',
            stage_id: s3,
            sr_no: 2,
            question: 'Any visible honeycombing or spalling observed under beam bottoms?',
            input_type: 'options',
            options: ['None - Smooth', 'Minor Surface Hairline', 'Major Honeycomb (RFI Needed)'],
            fail_rule: 'Major Honeycomb (RFI Needed)',
            drawing_required: false,
            witness_required: true,
            photo_required: true,
            remark_required: true,
            created_at: '2025-02-12T08:20:00Z',
          },
        ],
      },
    ];

    // Seed EQCs
    this.eqcs = [
      {
        id: 'eqc-101',
        project_id: p1,
        location: '14th Floor - Flat 1402 Slab',
        checklist_id: c1,
        checklist_name: 'Arch - Beam & Slab Checking',
        stage_index: 1,
        total_stages: 3,
        stage_result: 'pass',
        approver_id: u1,
        approver_name: 'Sarvesh Gupta',
        approver_log: 'Shuttering line & cover verified. Clear to pour.',
        status: 'passed',
        inspected_by: 'Mayuresh Jadhav',
        inspected_at: '2026-07-20T10:30:00Z',
        notes: 'Passed initial pre-pour inspection.',
        created_at: '2026-07-20T09:00:00Z',
      },
      {
        id: 'eqc-102',
        project_id: p1,
        location: '15th Floor - Column C12 & C14',
        checklist_id: c2,
        checklist_name: 'Arch - Column Starter & Verticality',
        stage_index: 2,
        total_stages: 2,
        stage_result: 'fail',
        approver_id: u1,
        approver_name: 'Sarvesh Gupta',
        approver_log: 'Plumb deviation of 8mm on east face. Re-alignment required.',
        status: 'failed',
        inspected_by: 'Mayuresh Jadhav',
        inspected_at: '2026-07-21T11:15:00Z',
        rfi_id: 'RFI-AUR-089',
        notes: 'RFI raised for re-plumb and starter chipping.',
        created_at: '2026-07-21T10:00:00Z',
      },
      {
        id: 'eqc-103',
        project_id: p2,
        location: 'Podium 2 - PT Beam PB-04',
        checklist_id: c1,
        checklist_name: 'Arch - Beam & Slab Checking',
        stage_index: 2,
        total_stages: 3,
        stage_result: 'pending',
        status: 'pending',
        inspected_by: 'Pankti Mehta',
        inspected_at: '2026-07-22T08:45:00Z',
        notes: 'Awaiting tendon elongation pressure log approval.',
        created_at: '2026-07-22T08:00:00Z',
      },
    ];

    // Seed Issues
    this.issues = [
      {
        id: 'iss-201',
        project_id: p1,
        title: 'Column C14 Starter Plumb Offset (>6mm)',
        description: 'Starter concrete cast with 8mm tilt toward North-East line. Needs surface grinding and tie-line adjustment before shuttering erection.',
        severity: 'high',
        status: 'in_progress',
        assignee_id: u2,
        assignee_name: 'Mayuresh Jadhav',
        reported_by: 'Sarvesh Gupta',
        due_date: '2026-07-24',
        created_at: '2026-07-21T11:30:00Z',
      },
      {
        id: 'iss-202',
        project_id: p1,
        title: 'Electrical Conduit Blockage in 12th Floor Corridor',
        description: 'Main 25mm PVC conduit choked during slab pour. Zari cutting required on beam soffit with structural consultant sign-off.',
        severity: 'critical',
        status: 'open',
        assignee_id: u4,
        assignee_name: 'Vishal Kadam',
        reported_by: 'Mayuresh Jadhav',
        due_date: '2026-07-25',
        created_at: '2026-07-22T09:00:00Z',
      },
      {
        id: 'iss-203',
        project_id: p3,
        title: 'Gypsum Plaster Dampness on East Partition Wall',
        description: 'Moisture trace observed near toilet dado back wall. Leakage test needed on CPVC pipe joints.',
        severity: 'medium',
        status: 'resolved',
        assignee_id: u3,
        assignee_name: 'Pankti Mehta',
        reported_by: 'Pankti Mehta',
        due_date: '2026-07-20',
        created_at: '2026-07-19T14:00:00Z',
      },
    ];

    // Seed Register Entries
    this.registerEntries = [
      {
        id: 'reg-301',
        project_id: p1,
        document_no: 'DWG-AUR-STR-SLB-1400-R2',
        title: '14th Floor Slab & Beam Structural Reinforcement Plan',
        revision: 'R2',
        status: 'active',
        file_url: 'https://example.com/docs/DWG-AUR-STR-SLB-1400-R2.pdf',
        created_at: '2026-07-10T10:00:00Z',
      },
      {
        id: 'reg-302',
        project_id: p1,
        document_no: 'DWG-AUR-ARCH-FLR-1400-R1',
        title: '14th Floor Architectural Layout & Masonry Lineout',
        revision: 'R1',
        status: 'active',
        file_url: 'https://example.com/docs/DWG-AUR-ARCH-FLR-1400-R1.pdf',
        created_at: '2026-07-08T09:30:00Z',
      },
      {
        id: 'reg-303',
        project_id: p2,
        document_no: 'DWG-FLC-MEP-RISER-003',
        title: 'Podium Fire & Plumbing Riser Sleeve Coordination Scheme',
        revision: 'R0',
        status: 'active',
        file_url: 'https://example.com/docs/DWG-FLC-MEP-RISER-003.pdf',
        created_at: '2026-06-25T11:00:00Z',
      },
    ];

    // Seed Project Targets
    this.projectTargets = [
      {
        id: 'tar-401',
        project_id: p1,
        metric: 'Weekly Slab Pour Target',
        target_value: 12000,
        current_value: 9800,
        unit: 'Sq. Ft',
        period: 'weekly',
        created_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'tar-402',
        project_id: p1,
        metric: 'QC First-Time Pass Rate',
        target_value: 95,
        current_value: 91.5,
        unit: '%',
        period: 'monthly',
        created_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 'tar-403',
        project_id: p1,
        metric: 'Defect Closure SLA Time',
        target_value: 48,
        current_value: 36,
        unit: 'Hours',
        period: 'monthly',
        created_at: '2026-07-01T00:00:00Z',
      },
    ];

    // Seed Project Members
    this.projectMembers = [
      { id: 'pm-1', project_id: p1, user_id: u1, user_name: 'Sarvesh Gupta', user_email: 'sarvesh.gupta@pranavconstructions.com', role: 'admin', added_at: '2025-02-10T09:00:00Z' },
      { id: 'pm-2', project_id: p1, user_id: u2, user_name: 'Mayuresh Jadhav', user_email: 'mayuresh.jadhav@pranavconstructions.com', role: 'inspector', added_at: '2025-02-11T09:00:00Z' },
      { id: 'pm-3', project_id: p1, user_id: u3, user_name: 'Pankti Mehta', user_email: 'pankti.mehta@pranavconstructions.com', role: 'approver', added_at: '2025-02-12T09:00:00Z' },
      { id: 'pm-4', project_id: p2, user_id: u3, user_name: 'Pankti Mehta', user_email: 'pankti.mehta@pranavconstructions.com', role: 'admin', added_at: '2025-03-01T10:00:00Z' },
      { id: 'pm-5', project_id: p3, user_id: u2, user_name: 'Mayuresh Jadhav', user_email: 'mayuresh.jadhav@pranavconstructions.com', role: 'admin', added_at: '2025-04-15T12:00:00Z' },
    ];
  }
}

export const db = new DatabaseStore();
