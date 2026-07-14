import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("x-cron-secret");
    if (authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // Call self-reflection POST internally with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds total timeout

    const response = await fetch(`${appUrl}/api/self-reflect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Internal self-reflection failed: ${errText}` }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
