import { orgQuery } from '@/lib/db';

/**
 * Bumps a project's updated_at/updated_by whenever something scoped to it
 * changes (members, teams, checklists, targets, register, issues, EQCs, ...)
 * so the "Updated On" column on the projects list reflects real activity,
 * not just direct edits to the project's own fields.
 */
export async function touchProject(orgId: string, projectId: string, userId?: string) {
  try {
    await orgQuery(
      orgId,
      `UPDATE projects SET updated_at = now(), updated_by = COALESCE($1, updated_by) WHERE id = $2`,
      [userId ?? null, projectId]
    );
  } catch (error) {
    console.error('touchProject failed:', error);
  }
}
