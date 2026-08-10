import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
const apiKey = process.env.GOOGLE_APPS_SCRIPT_API_KEY;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: 'Acceso no autorizado.' }, { status: 401 });
  if (!scriptUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: 'Falta configurar la conexiÃ³n con Google Sheets.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const requestBody = {
      ...body,
      data: { ...(body.data || {}), ownerId: userId }
    };
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...requestBody, apiKey }),
      cache: 'no-store'
    });
    const data = await response.json();
    if (body.action === 'list' && data.ok) {
      data.data = (data.data || []).filter((item: { ownerId?: string }) => item.ownerId === userId);
    }
    return NextResponse.json(data, { status: data.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar con la planilla.' }, { status: 502 });
  }
}

