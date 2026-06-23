/**
 * BRIDGE REGISTRY — /api/bridge/registry
 * Lists all active bridges in Agent Zero
 * Synced from AUTO_BUILDER bridge architecture docs
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    registry: "Agent Zero Bridge Registry",
    version: "1.0.0",
    bridges: [
      {
        id: "gpt_bridge",
        name: "GPT Autonomous Bridge",
        path: "/api/bridge/gpt",
        type: "write_branch",
        status: "active",
        auth: "Bearer BRIDGE_SECRET",
        actions: ["chat", "ask", "audit", "validate", "orchestrate", "health"],
      },
      {
        id: "http_bridge",
        name: "HTTP Bridge",
        path: "/api/bridge/http",
        type: "read",
        status: "active",
      },
      {
        id: "ai_gateway",
        name: "AI Gateway",
        path: "/api/ai-gateway",
        type: "ai_routing",
        status: "active",
        model_allowlist: ["gpt-4o-mini", "gpt-4o", "llama-3.1-70b-versatile"],
      },
      {
        id: "autobuilder_workflow",
        name: "AUTO_BUILDER OS Workflow",
        path: "/api/workflows/autobuilder-os",
        type: "orchestration",
        status: "active",
        stages: 10,
      },
      {
        id: "aria",
        name: "ARIA Chat",
        path: "/api/aria",
        type: "ai_chat",
        status: "active",
      },
      {
        id: "apex",
        name: "APEX Discovery",
        path: "/api/apex",
        type: "discovery",
        status: "active",
      },
    ],
    source_repos: [
      "Strategic-Minds/Agent-Zero",
      "Strategic-Minds/AUTO_BUILDER",
    ],
    supabase: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    ai_active: !!(process.env.AI_GATEWAY_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY),
  });
}

export async function POST() { return GET(); }
