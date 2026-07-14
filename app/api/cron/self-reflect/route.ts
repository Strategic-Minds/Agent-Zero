import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reflectUrl = `${req.nextUrl.origin}/api/self-reflect`;
  const resp = await fetch(reflectUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const resData = await resp.json();
  return NextResponse.json({
    cron: 'self-reflect',
    triggered: true,
    result: resData
  });
}
