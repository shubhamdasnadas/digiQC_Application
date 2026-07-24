import { Project, Team, Checklist, EQC, Issue, RegisterEntry, ProjectTarget, ProjectMember, Organization, TeamMember } from '../types';

class ApiService {
  private getHeaders() {
    const userId = localStorage.getItem('digiqc_user_id') || 'usr-sarvesh';
    const orgId = localStorage.getItem('digiqc_org_id') || 'org-city-hospital';

    return {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    };
  }

  // Auth
  async login(email: string, password_hash: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password_hash }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  }

  async register(name: string, email: string, password_hash: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: password_hash }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  }

  async getMe() {
    try {
      const res = await fetch('/api/auth/me', { headers: this.getHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('Network error in getMe:', err);
      return null;
    }
  }

  async switchOrg(orgId: string) {
    const res = await fetch('/api/auth/switch-org', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) throw new Error('Failed to switch organization');
    return res.json();
  }

  async joinOrg(organizationId: string, role = 'admin') {
    const res = await fetch('/api/auth/join-org', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ organizationId, role }),
    });
    if (!res.ok) throw new Error('Failed to join organization');
    return res.json();
  }

  // Dashboard
  async getDashboard() {
    const res = await fetch('/api/dashboard', { headers: this.getHeaders() });
    return res.json();
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await fetch('/api/projects', { headers: this.getHeaders() });
    return res.json();
  }

  async getProject(id: string): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, { headers: this.getHeaders() });
    return res.json();
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create project');
    }
    return res.json();
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // Project Sub-resources
  async getProjectEqcs(projectId: string): Promise<EQC[]> {
    const res = await fetch(`/api/projects/${projectId}/eqcs`, { headers: this.getHeaders() });
    return res.json();
  }

  async createProjectEqc(projectId: string, data: Partial<EQC>): Promise<EQC> {
    const res = await fetch(`/api/projects/${projectId}/eqcs`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async getProjectIssues(projectId: string): Promise<Issue[]> {
    const res = await fetch(`/api/projects/${projectId}/issues`, { headers: this.getHeaders() });
    return res.json();
  }

  async createProjectIssue(projectId: string, data: Partial<Issue>): Promise<Issue> {
    const res = await fetch(`/api/projects/${projectId}/issues`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async getProjectRegister(projectId: string): Promise<RegisterEntry[]> {
    const res = await fetch(`/api/projects/${projectId}/register`, { headers: this.getHeaders() });
    return res.json();
  }

  async createProjectRegisterEntry(projectId: string, data: Partial<RegisterEntry>): Promise<RegisterEntry> {
    const res = await fetch(`/api/projects/${projectId}/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const res = await fetch(`/api/projects/${projectId}/members`, { headers: this.getHeaders() });
    return res.json();
  }

  async addProjectMember(projectId: string, userId: string, role: string): Promise<ProjectMember> {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ user_id: userId, role }),
    });
    return res.json();
  }

  async getProjectTargets(projectId: string): Promise<ProjectTarget[]> {
    const res = await fetch(`/api/projects/${projectId}/targets`, { headers: this.getHeaders() });
    return res.json();
  }

  async createProjectTarget(projectId: string, data: Partial<ProjectTarget>): Promise<ProjectTarget> {
    const res = await fetch(`/api/projects/${projectId}/targets`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    const res = await fetch('/api/teams', { headers: this.getHeaders() });
    return res.json();
  }

  async createTeam(data: Partial<Team>): Promise<Team> {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const res = await fetch(`/api/teams/${teamId}/members`, { headers: this.getHeaders() });
    return res.json();
  }

  // Checklists
  async getChecklists(): Promise<Checklist[]> {
    const res = await fetch('/api/checklists', { headers: this.getHeaders() });
    return res.json();
  }

  async getChecklistDetail(id: string) {
    const res = await fetch(`/api/checklists/${id}`, { headers: this.getHeaders() });
    return res.json();
  }

  async createChecklist(data: Partial<Checklist> | Partial<Checklist>[]): Promise<any> {
    const res = await fetch('/api/checklists', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async patchChecklist(id: string, payload: any) {
    const res = await fetch(`/api/checklists/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    const res = await fetch('/api/organizations', { headers: this.getHeaders() });
    return res.json();
  }

  async createOrganization(data: Partial<Organization>): Promise<Organization> {
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }
}

export const api = new ApiService();
