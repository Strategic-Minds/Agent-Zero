import { NextResponse } from "next/server";

export const maxDuration = 60;

const INDUSTRIES = [
  "Construction", "Flooring", "Commercial Real Estate", "Property Management",
  "Warehousing", "Manufacturing", "Retail", "Healthcare", "Hospitality", "Education"
];

const CATEGORIES = [
  "Epoxy Flooring", "Concrete Polishing", "Garage Floors", "Commercial Flooring",
  "Industrial Coatings", "Decorative Concrete", "Floor Repair", "Warehouse Flooring"
];

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function querySupabase(path: string, options: RequestInit = {}): Promise<any> {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  
  const headers = {
    "Content-Type": "application/json",
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    ...options.headers,
  };

  const response = await fetchWithTimeout(
    `${supabaseUrl}${path}`,
    { ...options, headers },
    10000 // 10 seconds timeout
  );

  if (!response.ok) {
    throw new Error(`Supabase query failed: ${response.statusText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { industry, categories, location, radius_miles } = body;

    if (!industry || !categories || !location) {
      return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
    }

    if (!INDUSTRIES.includes(industry)) {
      return NextResponse.json({ error: `Unsupported industry: ${industry}` }, { status: 400 });
    }

    // Filter categories to ensure they match permitted set
    const validCategories = categories.filter((cat: string) => CATEGORIES.includes(cat));
    if (validCategories.length === 0) {
      return NextResponse.json({ error: "No valid categories selected" }, { status: 400 });
    }

    // Query scored leads matched to industry and valid categories from database
    const queryStr = `/rest/v1/leads?industry=eq.${encodeURIComponent(industry)}&order=lead_score.desc.nullslast&limit=50`;
    const results = await querySupabase(queryStr, { method: "GET" });

    // Filter locally by category and location keyword matches if provided
    let filteredResults = results || [];
    if (validCategories.length > 0) {
      filteredResults = filteredResults.filter((lead: any) => 
        validCategories.some((cat: string) => 
          (lead.category && lead.category.toLowerCase().includes(cat.toLowerCase())) ||
          (lead.company_name && lead.company_name.toLowerCase().includes(cat.toLowerCase()))
        )
      );
    }

    if (location) {
      filteredResults = filteredResults.filter((lead: any) => 
        (lead.location && lead.location.toLowerCase().includes(location.toLowerCase())) ||
        (lead.address && lead.address.toLowerCase().includes(location.toLowerCase()))
      );
    }

    return NextResponse.json({
      success: true,
      query: { industry, categories: validCategories, location, radius_miles },
      results: filteredResults,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
