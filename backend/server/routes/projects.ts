import { Router, Request, Response } from 'express';
import { db, Project } from '../db';
import { getUserFromHeader } from './auth';
import { randomUUID as uuidv4 } from 'crypto';

const router = Router();

// GET /api/projects - list projects for active org
router.get('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  const projects = db.projects.filter(p => p.organization_id === orgId);

  // Attach members count & user roles
  const result = projects.map(p => {
    const members = db.projectMembers.filter(m => m.project_id === p.id);
    const myMember = members.find(m => m.user_id === auth.user.id);

    return {
      ...p,
      members_count: members.length,
      assigned_users: members.map(m => m.user_name),
      my_role: myMember ? myMember.role : 'admin',
    };
  });

  return res.json(result);
});

// POST /api/projects - create new project
router.post('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  const {
    name,
    unique_code,
    client_name,
    nomenclature = '',
    profile = '',
    instruction = '',
    description = '',
    project_admin_id = auth.user.id,
    radius_m = 100,
    timezone = 'Asia/Calcutta',
    latitude = 19.0760,
    longitude = 72.8777,
    address = 'Mumbai, Maharashtra',
    perm_location = true,
    perm_authentication = true,
    perm_rfi = true,
    image_url = 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg',
    status = 'active',
  } = req.body;

  if (!name || !unique_code) {
    return res.status(400).json({ error: 'Project Name and Unique Code are required' });
  }

  const newProject: Project = {
    id: `proj-${uuidv4().substring(0, 8)}`,
    organization_id: orgId,
    name,
    nomenclature: nomenclature || name.substring(0, 3).toUpperCase() + '-01',
    unique_code,
    client_name: client_name || 'Standard Client',
    profile: profile || 'General Civil Construction',
    instruction: instruction || 'Strict QC inspection mandatory prior to work progress.',
    description: description || 'Construction QC project',
    project_admin_id,
    radius_m: Number(radius_m) || 100,
    timezone: timezone || 'Asia/Calcutta',
    latitude: Number(latitude) || 19.0760,
    longitude: Number(longitude) || 72.8777,
    address,
    perm_location: Boolean(perm_location),
    perm_authentication: Boolean(perm_authentication),
    perm_rfi: Boolean(perm_rfi),
    image_url: image_url || 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg',
    status: status as 'active' | 'completed' | 'on_hold',
    updated_by: auth.user.name,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  db.projects.unshift(newProject);

  // Add project creator as project admin
  db.projectMembers.push({
    id: `pm-${uuidv4().substring(0, 8)}`,
    project_id: newProject.id,
    user_id: auth.user.id,
    user_name: auth.user.name,
    user_email: auth.user.email,
    role: 'admin',
    added_at: new Date().toISOString(),
  });

  return res.status(201).json(newProject);
});

// GET /api/projects/:id - single project detail
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = db.projects.find(p => p.id === id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  return res.json(project);
});

// PATCH /api/projects/:id - update project
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = getUserFromHeader(req);
  const projectIndex = db.projects.findIndex(p => p.id === id);

  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  db.projects[projectIndex] = {
    ...db.projects[projectIndex],
    ...req.body,
    updated_by: auth.user.name,
    updated_at: new Date().toISOString(),
  };

  return res.json(db.projects[projectIndex]);
});

// DELETE /api/projects/:id - delete project
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.projects.findIndex(p => p.id === id);

  if (idx !== -1) {
    db.projects.splice(idx, 1);
    // Delete cascading project relations
    db.eqcs = db.eqcs.filter(e => e.project_id !== id);
    db.issues = db.issues.filter(i => i.project_id !== id);
    db.registerEntries = db.registerEntries.filter(r => r.project_id !== id);
    db.projectTargets = db.projectTargets.filter(t => t.project_id !== id);
    db.projectMembers = db.projectMembers.filter(m => m.project_id !== id);
  }

  return res.json({ success: true });
});

// === SUB-RESOURCES FOR PROJECT DETAIL WORKSPACE ===

// EQCs
router.get('/:id/eqcs', (req: Request, res: Response) => {
  const { id } = req.params;
  const eqcs = db.eqcs.filter(e => e.project_id === id);
  return res.json(eqcs);
});

router.post('/:id/eqcs', (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = getUserFromHeader(req);
  const { location, checklist_id, checklist_name, stage_index = 1, total_stages = 3, status = 'passed', notes = '' } = req.body;

  if (!location || !checklist_id) {
    return res.status(400).json({ error: 'Location and Checklist selection are required' });
  }

  const newEqc = {
    id: `eqc-${uuidv4().substring(0, 8)}`,
    project_id: id,
    location,
    checklist_id,
    checklist_name: checklist_name || 'Standard Inspection Checklist',
    stage_index: Number(stage_index),
    total_stages: Number(total_stages),
    stage_result: (status === 'passed' ? 'pass' : status === 'failed' ? 'fail' : 'pending') as 'pass' | 'fail' | 'pending',
    status: status as 'passed' | 'failed' | 'pending' | 'rfi',
    approver_id: auth.user.id,
    approver_name: auth.user.name,
    approver_log: 'QC Inspection logged and evaluated by field engineer.',
    inspected_by: auth.user.name,
    inspected_at: new Date().toISOString(),
    notes,
    created_at: new Date().toISOString(),
  };

  db.eqcs.unshift(newEqc);
  return res.status(201).json(newEqc);
});

// Issues
router.get('/:id/issues', (req: Request, res: Response) => {
  const { id } = req.params;
  const issues = db.issues.filter(i => i.project_id === id);
  return res.json(issues);
});

router.post('/:id/issues', (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = getUserFromHeader(req);
  const { title, description = '', severity = 'medium', status = 'open', assignee_id, due_date } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Issue Title is required' });
  }

  const assignee = db.users.find(u => u.id === assignee_id);

  const newIssue = {
    id: `iss-${uuidv4().substring(0, 8)}`,
    project_id: id,
    title,
    description,
    severity: severity as 'low' | 'medium' | 'high' | 'critical',
    status: status as 'open' | 'in_progress' | 'resolved' | 'closed',
    assignee_id,
    assignee_name: assignee ? assignee.name : 'Unassigned',
    reported_by: auth.user.name,
    due_date: due_date || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  };

  db.issues.unshift(newIssue);
  return res.status(201).json(newIssue);
});

// Register (Documents & Drawings)
router.get('/:id/register', (req: Request, res: Response) => {
  const { id } = req.params;
  const entries = db.registerEntries.filter(r => r.project_id === id);
  return res.json(entries);
});

router.post('/:id/register', (req: Request, res: Response) => {
  const { id } = req.params;
  const { document_no, title, revision = 'R0', status = 'active', file_url = '' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Document Title is required' });
  }

  const newEntry = {
    id: `reg-${uuidv4().substring(0, 8)}`,
    project_id: id,
    document_no: document_no || `DWG-${uuidv4().substring(0, 6).toUpperCase()}`,
    title,
    revision,
    status: status as 'active' | 'superseded' | 'void',
    file_url: file_url || 'https://example.com/drawings/sample-plan.pdf',
    created_at: new Date().toISOString(),
  };

  db.registerEntries.unshift(newEntry);
  return res.status(201).json(newEntry);
});

// Members
router.get('/:id/members', (req: Request, res: Response) => {
  const { id } = req.params;
  const members = db.projectMembers.filter(m => m.project_id === id);
  return res.json(members);
});

router.post('/:id/members', (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id, role = 'member' } = req.body;

  const targetUser = db.users.find(u => u.id === user_id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const existing = db.projectMembers.find(m => m.project_id === id && m.user_id === user_id);
  if (existing) {
    existing.role = role;
    return res.json(existing);
  }

  const newMember = {
    id: `pm-${uuidv4().substring(0, 8)}`,
    project_id: id,
    user_id: targetUser.id,
    user_name: targetUser.name,
    user_email: targetUser.email,
    role: role as 'admin' | 'member' | 'inspector' | 'approver' | 'viewer',
    added_at: new Date().toISOString(),
  };

  db.projectMembers.push(newMember);
  return res.status(201).json(newMember);
});

// Targets
router.get('/:id/targets', (req: Request, res: Response) => {
  const { id } = req.params;
  const targets = db.projectTargets.filter(t => t.project_id === id);
  return res.json(targets);
});

router.post('/:id/targets', (req: Request, res: Response) => {
  const { id } = req.params;
  const { metric, target_value = 100, current_value = 0, unit = 'Units', period = 'monthly' } = req.body;

  if (!metric) {
    return res.status(400).json({ error: 'Metric title is required' });
  }

  const newTarget = {
    id: `tar-${uuidv4().substring(0, 8)}`,
    project_id: id,
    metric,
    target_value: Number(target_value),
    current_value: Number(current_value),
    unit,
    period: period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'project',
    created_at: new Date().toISOString(),
  };

  db.projectTargets.unshift(newTarget);
  return res.status(201).json(newTarget);
});

export default router;
