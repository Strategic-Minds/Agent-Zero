import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { industry, topics, location, max_results = 5 } = body;

    if (!industry || !topics || !location) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const tKey = process.env.TAVILY_API_KEY;
    if (!tKey) {
      return NextResponse.json({ error: 'Tavily API key is not configured' }, { status: 500 });
    }

    const query = `${industry} ${topics.join(' ')} contractors ${location} epoxy flooring concrete`;
    
    // Call Tavily Search API
    const tResp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tKey,
        query: query,
        search_depth: 'advanced',
        max_results: Math.min(max_results, 10),
        include_domains: []
      })
    });

    if (!tResp.ok) {
      const errTxt = await tResp.text();
      return NextResponse.json({ error: `Tavily API failed: ${errTxt}` }, { status: 502 });
    }

    const searchData = await tResp.json();
    const results = searchData.results || [];

    // Save run record to supabase
    const { data: run, error: runErr } = await supabase
      .from('scrape_runs')
      .insert({
        industry,
        topics,
        location,
        status: 'running'
      })
      .select()
      .single();

    let newLeadsCount = 0;
    let dupCount = 0;
    const processedLeads = [];

    for (const item of results) {
      const url = item.url || '';
      let domain = '';
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch (e) {}

      if (!domain) continue;

      // Deduplication check
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('website', domain)
        .maybeSingle();

      if (existing) {
        dupCount++;
        continue;
      }

      // Standardize data from search item
      const company_name = item.title ? item.title.split('-')[0].split('|')[0].trim() : 'Unknown Contractor';
      const email = 'info@' + domain;
      const phone = 'N/A';
      const address = location;
      const category = topics[0] || 'Epoxy Flooring';

      const leadData = {
        company_name,
        phone,
        email,
        website: domain,
        address,
        city: location,
        industry,
        category,
        lead_score: 75,
        status: 'new',
        source: 'Tavily Scraper'
      };

      const { error: insertErr } = await supabase.from('leads').insert(leadData);
      if (!insertErr) {
        newLeadsCount++;
        processedLeads.push(leadData);
      }
    }

    // Complete the scrape run
    if (run) {
      await supabase
        .from('scrape_runs')
        .update({
          status: 'completed',
          total_found: results.length,
          new_leads: newLeadsCount,
          duplicates_skipped: dupCount,
          completed_at: new Date().toISOString(),
          notes: `Found ${results.length} results. Saved ${newLeadsCount} new leads.`
        })
        .eq('id', run.id);
    }

    return NextResponse.json({
      success: true,
      query,
      total_found: results.length,
      new_leads: newLeadsCount,
      duplicates_skipped: dupCount,
      leads: processedLeads
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Scraper failed' }, { status: 500 });
  }
}
