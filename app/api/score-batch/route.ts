/**
 * /api/score-batch — Batch lead scoring with AI
 * Scores multiple companies, returns ranked list with recommendations
 */
import { NextRequest, NextResponse } from "next/server";
import { aiJSON } from "@/lib/ai";

export const dynamic    = "force-dynamic";
export const maxDuration = 45;

interface CompanyInput {
  id?: string;
  name: string;
  city?: string;
  category?: string;
  website?: string;
  notes?: string;
}

interface ScoredCompany extends CompanyInput {
  lead_score: number;
  priority_tier: "A" | "B" | "C" | "D";
  pitch_angle: string;
  next_action: string;
  estimated_deal_size: string;
}

async function scoreCompany(company: CompanyInput): Promise<ScoredCompany> {
  const result = await aiJSON<{
    lead_score: number;
    priority_tier: string;
    pitch_angle: string;
    next_action: string;
    estimated_deal_size: string;
  }>(
    `You are an XPS sales intelligence AI. Score construction/contracting companies as potential customers for commercial epoxy flooring and concrete polishing services.
    
Return JSON with:
- lead_score (0-100): likelihood of needing commercial floor services
- priority_tier: "A" (score 80+), "B" (60-79), "C" (40-59), "D" (below 40)
- pitch_angle: specific 1-sentence pitch tailored to their business type
- next_action: "call" | "email" | "visit" | "skip"
- estimated_deal_size: "$5k-$15k" | "$15k-$50k" | "$50k+" | "unknown"`,
    `Company: ${company.name}
City: ${company.city || "Arizona"}
Category: ${company.category || "contractor"}
Notes: ${company.notes || "none"}`,
    {
      lead_score: 50,
      priority_tier: "C",
      pitch_angle: "XPS can improve your facility's floor durability and appearance.",
      next_action: "call",
      estimated_deal_size: "unknown",
    }
  );

  const tier = result.lead_score >= 80 ? "A" : result.lead_score >= 60 ? "B" : result.lead_score >= 40 ? "C" : "D";

  return {
    ...company,
    lead_score: result.lead_score,
    priority_tier: tier as "A"|"B"|"C"|"D",
    pitch_angle: result.pitch_angle,
    next_action: result.next_action,
    estimated_deal_size: result.estimated_deal_size,
  };
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/score-batch",
    description: "AI batch lead scoring — send up to 20 companies, get ranked results",
    usage: "POST { companies: [{name, city, category, notes}] }",
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const body  = await req.json().catch(() => ({})) as { companies?: CompanyInput[] };

  const companies = (body.companies || []).slice(0, 20);

  if (companies.length === 0) {
    // Demo mode — score sample companies
    const demos: CompanyInput[] = [
      { name: "Valley Warehouse Solutions", city: "Phoenix", category: "warehouse", notes: "50k sqft facility" },
      { name: "Desert Auto Dealership Group", city: "Scottsdale", category: "automotive", notes: "3 locations" },
      { name: "Maricopa County School District", city: "Mesa", category: "education", notes: "gym floors need resurfacing" },
    ];
    const scored = await Promise.all(demos.map(scoreCompany));
    return NextResponse.json({
      ok: true, mode: "demo",
      total: scored.length,
      companies: scored.sort((a,b) => b.lead_score - a.lead_score),
      tier_summary: {
        A: scored.filter(c=>c.priority_tier==="A").length,
        B: scored.filter(c=>c.priority_tier==="B").length,
        C: scored.filter(c=>c.priority_tier==="C").length,
        D: scored.filter(c=>c.priority_tier==="D").length,
      },
      latency_ms: Date.now() - start,
    });
  }

  const scored = await Promise.all(companies.map(scoreCompany));
  const sorted = scored.sort((a,b) => b.lead_score - a.lead_score);

  return NextResponse.json({
    ok: true, mode: "live",
    total: sorted.length,
    companies: sorted,
    tier_summary: {
      A: sorted.filter(c=>c.priority_tier==="A").length,
      B: sorted.filter(c=>c.priority_tier==="B").length,
      C: sorted.filter(c=>c.priority_tier==="C").length,
      D: sorted.filter(c=>c.priority_tier==="D").length,
    },
    top_pick: sorted[0]?.name || null,
    latency_ms: Date.now() - start,
  });
}
