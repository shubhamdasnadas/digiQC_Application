import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { touchProject } from '@/lib/projects';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext { params: Promise<{ id: string }>; }

async function ensureIssuesTable(orgId: string) {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS public.issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid,
      description text DEFAULT '',
      location text DEFAULT '',
      tag text DEFAULT 'Quality',
      status text NOT NULL DEFAULT 'open',
      assignee_id uuid,
      assignee_name text DEFAULT '',
      reported_by uuid,
      reported_by_name text DEFAULT '',
      image_url text DEFAULT '',
      tags text DEFAULT '',
      responded_by text DEFAULT '',
      due_date timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS project_id uuid`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS title text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS description text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS location text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS tag text DEFAULT 'Quality'`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS issue_type text DEFAULT 'Quality'`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium'`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assignee_id uuid`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assignee_name text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assigned_team text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assigned_team_phone text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by uuid`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by_name text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by_team text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS image_url text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}'`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS tags text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_by text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_by_name text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_by_team text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_at timestamptz`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS response_description text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS response_photos jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responses jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_by uuid`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_by_name text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_by_team text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_at timestamptz`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_description text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_photos jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS geo_tag text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS rejections text DEFAULT 'R0'`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS last_action_by text DEFAULT ''`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS last_action_date timestamptz DEFAULT now()`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS due_date timestamptz`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()`,
    `ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,
    `ALTER TABLE public.issues ALTER COLUMN title DROP NOT NULL`,
    `ALTER TABLE public.issues ALTER COLUMN title SET DEFAULT ''`,
    `ALTER TABLE public.issues ALTER COLUMN project DROP NOT NULL`,
    `ALTER TABLE public.issues ALTER COLUMN project SET DEFAULT NULL`,
    `ALTER TABLE public.issues ALTER COLUMN project_id DROP NOT NULL`,
  ];

  for (const sql of ddlStatements) {
    try {
      await orgQuery(orgId, sql);
    } catch {
      // Individual catch ensures remaining columns are still added
    }
  }

  // Cross-fill project_id and legacy project column if both exist
  try {
    await orgQuery(
      orgId,
      `UPDATE public.issues SET project_id = project::uuid WHERE project_id IS NULL AND project IS NOT NULL`
    );
  } catch {}
  try {
    await orgQuery(
      orgId,
      `UPDATE public.issues SET project = project_id WHERE project IS NULL AND project_id IS NOT NULL`
    );
  } catch {}
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    await ensureIssuesTable(payload.orgId!);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const q = searchParams.get('q')?.toLowerCase().trim();

    // Inspect actual existing columns on public.issues
    const { rows: colRows } = await orgQuery(
      payload.orgId!,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'issues'`
    );
    const existingCols = new Set(colRows.map((c: any) => c.column_name.toLowerCase()));

    const c = (colName: string, fallback: string = "''") => {
      if (existingCols.has(colName.toLowerCase())) {
        return `COALESCE(i.${colName}, ${fallback})`;
      }
      return `${fallback}`;
    };

    // Project matching: check project_id and legacy project column
    const projectFilters: string[] = [];
    if (existingCols.has('project_id')) {
      projectFilters.push(`i.project_id::text = $1`);
    }
    if (existingCols.has('project')) {
      projectFilters.push(`i.project::text = $1`);
    }
    const where: string[] = [
      projectFilters.length > 0 ? `(${projectFilters.join(' OR ')})` : `1=1`
    ];
    const params: any[] = [id];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`${c('status', "'open'")} = $${params.length}`);
    }
    if (severity && severity !== 'all') {
      params.push(severity);
      where.push(`${c('severity', "'medium'")} = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const pIdx = params.length;
      where.push(`(
        LOWER(${c('title')}) LIKE $${pIdx} OR
        LOWER(${c('description')}) LIKE $${pIdx} OR
        LOWER(${c('location')}) LIKE $${pIdx} OR
        LOWER(${c('issue_type')}) LIKE $${pIdx} OR
        LOWER(${c('assignee_name')}) LIKE $${pIdx} OR
        LOWER(COALESCE(m_assignee.name, '')) LIKE $${pIdx} OR
        LOWER(${c('reported_by_name')}) LIKE $${pIdx} OR
        LOWER(COALESCE(m_reporter.name, '')) LIKE $${pIdx} OR
        LOWER(COALESCE(u_reporter.name, '')) LIKE $${pIdx}
      )`);
    }

    const assigneeNameExpr = existingCols.has('assignee_name') ? `NULLIF(i.assignee_name, '')` : 'NULL';
    const assignedTeamExpr = existingCols.has('assigned_team') ? `NULLIF(i.assigned_team, '')` : 'NULL';
    const reportedByNameExpr = existingCols.has('reported_by_name') ? `NULLIF(i.reported_by_name, '')` : 'NULL';
    const reportedByTeamExpr = existingCols.has('reported_by_team') ? `NULLIF(i.reported_by_team, '')` : 'NULL';

    const projectSelectExpr = existingCols.has('project_id') && existingCols.has('project')
      ? `COALESCE(i.project_id::text, i.project::text, $1::text)`
      : existingCols.has('project_id')
      ? `COALESCE(i.project_id::text, $1::text)`
      : existingCols.has('project')
      ? `COALESCE(i.project::text, $1::text)`
      : `$1::text`;

    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT
         i.id,
         ${projectSelectExpr} AS project_id,
         ${c('title')} AS title,
         ${c('description')} AS description,
         ${c('location')} AS location,
         ${c('issue_type', "'Quality'")} AS issue_type,
         ${c('severity', "'medium'")} AS severity,
         ${c('status', "'open'")} AS status,
         ${existingCols.has('assignee_id') ? 'i.assignee_id' : 'NULL::uuid AS assignee_id'},
         COALESCE(${assigneeNameExpr}, m_assignee.name, '') AS assignee_name,
         COALESCE(${assignedTeamExpr}, m_assignee.teams, '') AS assigned_team,
         ${c('assigned_team_phone')} AS assigned_team_phone,
         ${existingCols.has('reported_by') ? 'i.reported_by' : 'NULL::uuid AS reported_by'},
         COALESCE(${reportedByNameExpr}, m_reporter.name, u_reporter.name, '') AS reported_by_name,
         COALESCE(${reportedByTeamExpr}, m_reporter.teams, '') AS reported_by_team,
         ${c('image_url')} AS image_url,
         ${existingCols.has('image_urls') ? 'i.image_urls' : "'{}'::text[] AS image_urls"},
         ${existingCols.has('photos') ? 'i.photos' : "'[]'::jsonb AS photos"},
         ${c('tags')} AS tags,
         ${existingCols.has('tag') ? c('tag', "'Quality'") : c('issue_type', "'Quality'")} AS tag,
         ${c('responded_by')} AS responded_by,
         ${c('responded_by_name')} AS responded_by_name,
         ${c('responded_by_team')} AS responded_by_team,
         ${existingCols.has('responded_at') ? 'i.responded_at' : 'NULL::timestamptz AS responded_at'},
         ${c('response_description')} AS response_description,
         ${existingCols.has('response_photos') ? 'i.response_photos' : "'[]'::jsonb AS response_photos"},
         ${existingCols.has('responses') ? 'i.responses' : "'[]'::jsonb AS responses"},
         ${existingCols.has('closed_by') ? 'i.closed_by' : 'NULL::uuid AS closed_by'},
         ${c('closed_by_name')} AS closed_by_name,
         ${c('closed_by_team')} AS closed_by_team,
         ${existingCols.has('closed_at') ? 'i.closed_at' : 'NULL::timestamptz AS closed_at'},
         ${c('closed_description')} AS closed_description,
         ${existingCols.has('closed_photos') ? 'i.closed_photos' : "'[]'::jsonb AS closed_photos"},
         ${c('geo_tag')} AS geo_tag,
         ${c('rejections', "'R0'")} AS rejections,
         COALESCE(NULLIF(${c('last_action_by')}, ''), COALESCE(${reportedByNameExpr}, m_reporter.name, u_reporter.name, '')) AS last_action_by,
         COALESCE(${existingCols.has('last_action_date') ? 'i.last_action_date' : 'NULL::timestamptz'}, i.created_at, NOW()) AS last_action_date,
         ${existingCols.has('due_date') ? 'i.due_date' : 'NULL::timestamptz AS due_date'},
         ${existingCols.has('created_at') ? 'i.created_at' : 'NOW() AS created_at'},
         ${existingCols.has('updated_at') ? 'i.updated_at' : 'NOW() AS updated_at'}
       FROM issues i
       LEFT JOIN members m_assignee ON m_assignee.id::text = i.assignee_id::text
       LEFT JOIN members m_reporter ON m_reporter.id::text = i.reported_by::text
       LEFT JOIN users u_reporter ON u_reporter.id::text = i.reported_by::text
       WHERE ${where.join(' AND ')}
       ORDER BY ${existingCols.has('created_at') ? 'i.created_at DESC' : 'i.id DESC'}`,
      params
    );

    const safeParse = (val: any) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
          } catch {}
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const items = trimmed.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
          if (items.length > 0) return items;
        }
        if (trimmed) return [trimmed];
      }
      return [];
    };

    const sanitizedRows = rows.map((r: any) => {
      const parsedPhotos = safeParse(r.photos);
      const parsedImageUrls = safeParse(r.image_urls);
      const rawImageUrl = typeof r.image_url === 'string' ? r.image_url.trim() : '';

      const allPhotos = Array.from(new Set([
        ...parsedPhotos,
        ...parsedImageUrls,
        ...(rawImageUrl ? (rawImageUrl.startsWith('[') || rawImageUrl.startsWith('{') ? safeParse(rawImageUrl) : [rawImageUrl]) : [])
      ])).filter((url): url is string => Boolean(url && typeof url === 'string'));

      const primaryImageUrl = allPhotos[0] || rawImageUrl || '';
      const finalTag = r.tag || r.issue_type || 'Quality';

      return {
        ...r,
        tag: finalTag,
        issue_type: r.issue_type || finalTag,
        photos: allPhotos,
        image_urls: allPhotos,
        image_url: primaryImageUrl,
        response_photos: safeParse(r.response_photos),
        closed_photos: safeParse(r.closed_photos),
        responses: safeParse(r.responses),
      };
    });

    return NextResponse.json(sanitizedRows);
  } catch (error) {
    console.error('Error in GET issues:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    await ensureIssuesTable(payload.orgId!);

    // Inspect columns of issues table
    const { rows: colRows } = await orgQuery(
      payload.orgId!,
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'issues'`
    );
    const existingCols = new Set(colRows.map((c: any) => c.column_name.toLowerCase()));

    const body = await request.json();
    const rows = body.rows ?? [body];
    const createdIssues: any[] = [];

    for (const r of rows) {
      // 1. Resolve assignee details if assignee_id provided
      let assigneeName = r.assignee_name ? String(r.assignee_name).trim() : '';
      let assignedTeam = r.assigned_team ? String(r.assigned_team).trim() : '';
      const cleanAssigneeId = (r.assignee_id && typeof r.assignee_id === 'string' && r.assignee_id.trim())
        ? r.assignee_id.trim()
        : null;

      if (cleanAssigneeId && (!assigneeName || !assignedTeam)) {
        try {
          const { rows: memRows } = await orgQuery(
            payload.orgId!,
            `SELECT name, teams FROM members WHERE id::text = $1 LIMIT 1`,
            [cleanAssigneeId]
          );
          if (memRows.length > 0) {
            if (!assigneeName) assigneeName = memRows[0].name || '';
            if (!assignedTeam) assignedTeam = memRows[0].teams || '';
          }
        } catch {
          // ignore lookup errors
        }
      }

      // 2. Resolve reporter details
      const rawReportedBy = r.reported_by || payload.userId;
      const cleanReportedBy = (rawReportedBy && typeof rawReportedBy === 'string' && rawReportedBy.trim())
        ? rawReportedBy.trim()
        : null;

      let reportedByName = r.reported_by_name ? String(r.reported_by_name).trim() : '';
      let reportedByTeam = r.reported_by_team ? String(r.reported_by_team).trim() : '';
      if (cleanReportedBy && (!reportedByName || !reportedByTeam)) {
        try {
          const { rows: repMem } = await orgQuery(
            payload.orgId!,
            `SELECT name, teams FROM members WHERE id::text = $1 LIMIT 1`,
            [cleanReportedBy]
          );
          if (repMem.length > 0) {
            if (!reportedByName) reportedByName = repMem[0].name || '';
            if (!reportedByTeam) reportedByTeam = repMem[0].teams || '';
          } else {
            const { rows: userRow } = await orgQuery(
              payload.orgId!,
              `SELECT name FROM users WHERE id::text = $1 LIMIT 1`,
              [cleanReportedBy]
            );
            if (userRow.length > 0 && !reportedByName) {
              reportedByName = userRow[0].name || '';
            }
          }
        } catch {
          // ignore lookup errors
        }
      }

      // Fallback title if none provided
      const finalTitle = (r.title && String(r.title).trim())
        ? String(r.title).trim()
        : `${r.issue_type || 'General'} - ${r.location || 'Issue'}`;

      let parsedDueDate: Date | null = null;
      if (r.due_date) {
        const d = new Date(r.due_date);
        if (!isNaN(d.getTime())) {
          parsedDueDate = d;
        }
      }

      const rawPhotosList: string[] = [];
      if (Array.isArray(r.photos)) {
        rawPhotosList.push(...r.photos);
      } else if (typeof r.photos === 'string' && r.photos.trim()) {
        try {
          const parsed = JSON.parse(r.photos);
          if (Array.isArray(parsed)) rawPhotosList.push(...parsed);
          else rawPhotosList.push(r.photos);
        } catch {
          rawPhotosList.push(r.photos);
        }
      }
      if (Array.isArray(r.image_urls)) {
        rawPhotosList.push(...r.image_urls);
      } else if (typeof r.image_urls === 'string' && r.image_urls.trim()) {
        rawPhotosList.push(r.image_urls);
      }
      if (typeof r.image_url === 'string' && r.image_url.trim()) {
        if (!rawPhotosList.includes(r.image_url.trim())) {
          rawPhotosList.push(r.image_url.trim());
        }
      }

      const photosArray = Array.from(new Set(rawPhotosList.filter(Boolean)));

      // Dynamically map existing columns in the issues table
      const colNames: string[] = [];
      const colValues: any[] = [];
      const colPlaceholders: string[] = [];

      const setVal = (col: string, val: any) => {
        if (existingCols.has(col.toLowerCase())) {
          colNames.push(`"${col}"`);
          colValues.push(val);
          colPlaceholders.push(`$${colValues.length}`);
        }
      };

      // Set both project_id and legacy project column
      setVal('project_id', id);
      setVal('project', id);
      setVal('title', finalTitle);
      setVal('description', r.description ?? '');
      setVal('location', r.location ?? '');
      setVal('tag', r.tag || r.issue_type || 'Quality');
      setVal('issue_type', r.issue_type || r.tag || 'Quality');
      setVal('severity', r.severity ?? 'medium');
      setVal('status', r.status ?? 'open');
      setVal('assignee_id', cleanAssigneeId);
      setVal('assignee_name', assigneeName);
      setVal('assigned_team', assignedTeam);
      setVal('assigned_team_phone', r.assigned_team_phone ?? '');
      setVal('reported_by', cleanReportedBy);
      setVal('reported_by_name', reportedByName);
      setVal('reported_by_team', reportedByTeam);
      setVal('image_url', photosArray[0] || r.image_url || '');
      setVal('image_urls', photosArray);
      setVal('photos', JSON.stringify(photosArray));
      setVal('tags', r.tags ?? '');
      setVal('responded_by', r.responded_by ?? '');
      setVal('responded_by_name', r.responded_by_name ?? '');
      setVal('responded_by_team', r.responded_by_team ?? '');
      setVal('responded_at', r.responded_at ? new Date(r.responded_at) : null);
      setVal('response_description', r.response_description ?? '');
      setVal('response_photos', JSON.stringify(r.response_photos ?? []));
      setVal('responses', JSON.stringify(r.responses ?? []));
      setVal('closed_by', r.closed_by || null);
      setVal('closed_by_name', r.closed_by_name ?? '');
      setVal('closed_by_team', r.closed_by_team ?? '');
      setVal('closed_at', r.closed_at ? new Date(r.closed_at) : null);
      setVal('closed_description', r.closed_description ?? '');
      setVal('closed_photos', JSON.stringify(r.closed_photos ?? []));
      setVal('geo_tag', r.geo_tag ?? '');
      setVal('rejections', r.rejections ?? 'R0');
      setVal('last_action_by', r.last_action_by || reportedByName || 'Admin');
      setVal('last_action_date', new Date());
      setVal('due_date', parsedDueDate);

      if (colNames.length > 0) {
        const { rows: inserted } = await orgQuery(
          payload.orgId!,
          `INSERT INTO issues (${colNames.join(', ')})
           VALUES (${colPlaceholders.join(', ')})
           RETURNING *`,
          colValues
        );
        if (inserted && inserted[0]) {
          createdIssues.push({
            ...inserted[0],
            project_id: id,
            title: finalTitle,
            description: r.description ?? '',
            location: r.location ?? '',
            tag: r.tag || r.issue_type || 'Quality',
            issue_type: r.issue_type || r.tag || 'Quality',
            severity: r.severity ?? 'medium',
            status: r.status ?? 'open',
            assignee_id: cleanAssigneeId,
            assignee_name: assigneeName,
            assigned_team: assignedTeam,
            assigned_team_phone: r.assigned_team_phone ?? '',
            reported_by: cleanReportedBy,
            reported_by_name: reportedByName,
            reported_by_team: reportedByTeam,
            image_url: photosArray[0] || r.image_url || '',
            image_urls: photosArray,
            photos: photosArray,
            tags: r.tags ?? '',
            rejections: r.rejections ?? 'R0',
            geo_tag: r.geo_tag ?? '',
            last_action_by: r.last_action_by || reportedByName || 'Admin',
            last_action_date: new Date().toISOString(),
            due_date: parsedDueDate ? parsedDueDate.toISOString() : null,
            created_at: inserted[0].created_at || new Date().toISOString(),
          });
        }
      }
    }

    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({
      success: true,
      issues: createdIssues,
      issue: createdIssues[0] || null,
    });
  } catch (error) {
    console.error('Error inserting issue:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    await ensureIssuesTable(payload.orgId!);

    const body = await request.json();
    const issueId = body.id || body.issue_id;
    if (!issueId) {
      return NextResponse.json({ error: 'Missing issue id' }, { status: 400 });
    }

    const { rows: colRows } = await orgQuery(
      payload.orgId!,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'issues'`
    );
    const existingCols = new Set(colRows.map((c: any) => c.column_name.toLowerCase()));

    const updates: string[] = [];
    const params: any[] = [issueId, id];

    const addUpdate = (col: string, val: any) => {
      if (existingCols.has(col.toLowerCase())) {
        params.push(val);
        updates.push(`"${col}" = $${params.length}`);
      }
    };

    if (body.status !== undefined) addUpdate('status', body.status);
    if (body.severity !== undefined) addUpdate('severity', body.severity);
    if (body.location !== undefined) addUpdate('location', body.location);
    if (body.tag !== undefined) addUpdate('tag', body.tag);
    if (body.issue_type !== undefined) addUpdate('issue_type', body.issue_type);
    if (body.tag !== undefined && body.issue_type === undefined && existingCols.has('issue_type')) {
      addUpdate('issue_type', body.tag);
    }
    if (body.issue_type !== undefined && body.tag === undefined && existingCols.has('tag')) {
      addUpdate('tag', body.issue_type);
    }
    if (body.title !== undefined) addUpdate('title', body.title);
    if (body.description !== undefined) addUpdate('description', body.description);
    if (body.tags !== undefined) addUpdate('tags', body.tags);
    if (body.geo_tag !== undefined) addUpdate('geo_tag', body.geo_tag);
    if (body.rejections !== undefined) addUpdate('rejections', body.rejections);
    if (body.assignee_id !== undefined) addUpdate('assignee_id', body.assignee_id || null);
    if (body.assignee_name !== undefined) addUpdate('assignee_name', body.assignee_name);
    if (body.assigned_team !== undefined) addUpdate('assigned_team', body.assigned_team);
    if (body.assigned_team_phone !== undefined) addUpdate('assigned_team_phone', body.assigned_team_phone);
    if (body.reported_by !== undefined) addUpdate('reported_by', body.reported_by || null);
    if (body.reported_by_name !== undefined) addUpdate('reported_by_name', body.reported_by_name);
    if (body.reported_by_team !== undefined) addUpdate('reported_by_team', body.reported_by_team);

    if (body.due_date !== undefined) {
      const parsed = body.due_date ? new Date(body.due_date) : null;
      addUpdate('due_date', parsed && !isNaN(parsed.getTime()) ? parsed : null);
    }
    if (body.image_url !== undefined || body.photos !== undefined || body.image_urls !== undefined) {
      const pList: string[] = [];
      if (Array.isArray(body.photos)) pList.push(...body.photos);
      else if (typeof body.photos === 'string' && body.photos.trim()) {
        try {
          const p = JSON.parse(body.photos);
          if (Array.isArray(p)) pList.push(...p);
          else pList.push(body.photos);
        } catch { pList.push(body.photos); }
      }
      if (Array.isArray(body.image_urls)) pList.push(...body.image_urls);
      if (typeof body.image_url === 'string' && body.image_url.trim()) {
        if (!pList.includes(body.image_url.trim())) pList.push(body.image_url.trim());
      }
      const uniquePhotos = Array.from(new Set(pList.filter(Boolean)));
      if (existingCols.has('photos')) addUpdate('photos', JSON.stringify(uniquePhotos));
      if (existingCols.has('image_urls')) addUpdate('image_urls', uniquePhotos);
      if (existingCols.has('image_url')) addUpdate('image_url', uniquePhotos[0] || (typeof body.image_url === 'string' ? body.image_url : ''));
    }

    // Response updates
    if (body.responded_by_name !== undefined) addUpdate('responded_by_name', body.responded_by_name);
    if (body.responded_by_team !== undefined) addUpdate('responded_by_team', body.responded_by_team);
    if (body.response_description !== undefined) addUpdate('response_description', body.response_description);
    if (body.response_photos !== undefined) addUpdate('response_photos', JSON.stringify(body.response_photos));
    if (body.responded_at !== undefined) {
      const parsed = body.responded_at ? new Date(body.responded_at) : new Date();
      addUpdate('responded_at', parsed);
    }
    if (body.responses !== undefined) addUpdate('responses', JSON.stringify(body.responses));

    // Closing updates
    if (body.closed_by_name !== undefined) addUpdate('closed_by_name', body.closed_by_name);
    if (body.closed_by_team !== undefined) addUpdate('closed_by_team', body.closed_by_team);
    if (body.closed_description !== undefined) addUpdate('closed_description', body.closed_description);
    if (body.closed_photos !== undefined) addUpdate('closed_photos', JSON.stringify(body.closed_photos));
    if (body.closed_at !== undefined) {
      const parsed = body.closed_at ? new Date(body.closed_at) : new Date();
      addUpdate('closed_at', parsed);
    }

    // Last action tracking
    if (body.last_action_by !== undefined) {
      addUpdate('last_action_by', body.last_action_by);
    }
    if (body.last_action_date !== undefined) {
      const parsed = body.last_action_date ? new Date(body.last_action_date) : new Date();
      addUpdate('last_action_date', parsed);
    } else {
      addUpdate('last_action_date', new Date());
    }

    addUpdate('updated_at', new Date());

    const hasProjectCol = existingCols.has('project');
    const projectMatch = hasProjectCol
      ? `(project_id::text = $2 OR ("project"::text = $2))`
      : `project_id::text = $2`;

    if (updates.length > 0) {
      await orgQuery(
        payload.orgId!,
        `UPDATE issues SET ${updates.join(', ')} WHERE id::text = $1 AND ${projectMatch}`,
        params
      );
    }

    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    await ensureIssuesTable(payload.orgId!);

    const { searchParams } = new URL(request.url);
    const issueId = searchParams.get('issue_id') || searchParams.get('id');
    if (!issueId) {
      return NextResponse.json({ error: 'Missing issue_id' }, { status: 400 });
    }

    const { rows: colRows } = await orgQuery(
      payload.orgId!,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'issues'`
    );
    const existingCols = new Set(colRows.map((c: any) => c.column_name.toLowerCase()));
    const hasProjectCol = existingCols.has('project');
    const projectMatch = hasProjectCol
      ? `(project_id::text = $2 OR ("project"::text = $2))`
      : `project_id::text = $2`;

    await orgQuery(
      payload.orgId!,
      `DELETE FROM issues WHERE id::text = $1 AND ${projectMatch}`,
      [issueId, id]
    );
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
