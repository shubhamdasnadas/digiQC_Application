import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createLibraryChecklist } from '@/lib/checklistLibrary';

export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

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
