import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Execute a standard epoxy flooring search in Phoenix
  const scraperUrl = `${req.nextUrl.origin}/api/scraper`;
  const resp = await fetch(scraperUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Construction',
      topics: ['Epoxy Flooring', 'Concrete Polishing'],
      location: 'Phoenix, AZ',
      max_results: 5
    })
  });

  const resData = await resp.json();
  return NextResponse.json({
    cron: 'scrape-leads',
    triggered: true,
    result: resData
  });
}
