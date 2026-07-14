import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("x-cron-secret");
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 seconds total limit

    const response = await fetch(`${appUrl}/api/scraper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        industry: "Construction",
        topics: ["Epoxy Flooring", "Concrete Polishing", "Garage Floors"],
        location: "Arizona",
        max_results: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Internal scraping failed: ${errText}` }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
