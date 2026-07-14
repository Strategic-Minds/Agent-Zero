import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Score newly added leads
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('lead_score', 0);

  if (error || !leads) {
    return NextResponse.json({ success: false, error });
  }

  let updated = 0;
  for (const lead of leads) {
    let score = 50;
    if (lead.email && !lead.email.includes('Unknown')) score += 15;
    if (lead.phone && lead.phone !== 'N/A') score += 15;
    if (lead.website) score += 20;

    await supabase
      .from('leads')
      .update({ lead_score: score, status: 'scored' })
      .eq('id', lead.id);
    updated++;
  }

  return NextResponse.json({
    cron: 'score-leads',
    updated_count: updated
  });
}
