import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { industry, categories, location, radius_miles = 25 } = body;

    if (!industry || !categories || !Array.isArray(categories) || !location) {
      return NextResponse.json({ error: 'Missing parameters or invalid categories format' }, { status: 400 });
    }

    const tKey = process.env.TAVILY_API_KEY;
    if (!tKey) {
      return NextResponse.json({ error: 'Tavily API key is not configured' }, { status: 500 });
    }

    const scoredLeads = [];

    // Query per category
    for (const cat of categories) {
      const q = `${industry} ${cat} contractors in ${location} within ${radius_miles} miles`;
      const tResp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tKey,
          query: q,
          max_results: 3
        })
      });

      if (tResp.ok) {
        const searchData = await tResp.json();
        const results = searchData.results || [];

        for (const item of results) {
          let domain = '';
          try {
            domain = new URL(item.url).hostname.replace('www.', '');
          } catch (e) {}

          if (!domain) continue;

          // score algorithm based on keyword density
          let score = 50;
          const text = (item.title + ' ' + item.content).toLowerCase();
          if (text.includes('flooring')) score += 15;
          if (text.includes('epoxy')) score += 15;
          if (text.includes('concrete')) score += 10;
          if (text.includes('commercial') || text.includes('industrial')) score += 10;

          scoredLeads.push({
            company_name: item.title ? item.title.split('-')[0].split('|')[0].trim() : 'Contractor',
            phone: 'N/A',
            email: 'info@' + domain,
            website: domain,
            address: location,
            category: cat,
            industry,
            score: Math.min(score, 100),
            snippet: item.content
          });
        }
      }
    }

    // Sort by relevance score
    scoredLeads.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      leads: scoredLeads
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Search failed' }, { status: 500 });
  }
}
