import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createLibraryChecklist, listLibraryChecklists } from '@/lib/checklistLibrary';
import { ensureChecklistSchema } from '@/lib/checklistSchema';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const libraryChecklists = await listLibraryChecklists();
    return NextResponse.json(libraryChecklists);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const { name, reference_number } = await request.json();
    if (!name || !reference_number) {
      return NextResponse.json({ error: 'name and reference_number are required' }, { status: 400 });
    }
    const checklist = await createLibraryChecklist(name, reference_number);
    return NextResponse.json(checklist);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
