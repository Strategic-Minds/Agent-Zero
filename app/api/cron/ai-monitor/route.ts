import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { remember } from "@/lib/memory";

// AGENT-ZERO — /api/cron/ai-monitor
// Tracks top AI companies, research labs, and new AI enhancements
// Strict scoring: systems must score >= 90 to influence Agent-Zero evolution
// Runs daily. Feeds findings into agent_memory for evolution agent.

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// TOP AI SYSTEMS — strict monitoring list with score requirements
// These are the ceiling we benchmark against
const AI_INTELLIGENCE_TARGETS = [
  // Frontier AI Labs
  { name: "Anthropic", url: "https://anthropic.com", category: "frontier_lab", min_score: 95, monitor_for: ["model_releases","safety_research","capabilities"] },
  { name: "OpenAI", url: "https://openai.com", category: "frontier_lab", min_score: 95, monitor_for: ["gpt_updates","api_changes","pricing"] },
  { name: "Google DeepMind", url: "https://deepmind.google", category: "frontier_lab", min_score: 90, monitor_for: ["gemini","alphafold","research"] },
  { name: "Meta AI", url: "https://ai.meta.com", category: "frontier_lab", min_score: 88, monitor_for: ["llama","open_source_models"] },
  { name: "Mistral AI", url: "https://mistral.ai", category: "emerging_lab", min_score: 85, monitor_for: ["model_releases","api","pricing"] },
  // AI Tools & Platforms
  { name: "Vercel AI", url: "https://sdk.vercel.ai", category: "ai_platform", min_score: 85, monitor_for: ["sdk_updates","new_providers"] },
  { name: "LangChain", url: "https://langchain.com", category: "ai_framework", min_score: 82, monitor_for: ["langgraph","new_patterns"] },
  { name: "HuggingFace", url: "https://huggingface.co", category: "ai_hub", min_score: 80, monitor_for: ["new_models","datasets","inference"] },
  { name: "Groq", url: "https://groq.com", category: "ai_infrastructure", min_score: 85, monitor_for: ["speed","pricing","new_models"] },
  { name: "Cohere", url: "https://cohere.com", category: "ai_platform", min_score: 80, monitor_for: ["enterprise_features","embeddings"] },
  // Agentic AI
  { name: "CrewAI", url: "https://crewai.com", category: "agent_framework", min_score: 80, monitor_for: ["new_features","pricing"] },
  { name: "AutoGen", url: "https://microsoft.github.io/autogen", category: "agent_framework", min_score: 78, monitor_for: ["patterns","updates"] },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}` && auth !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const monitored: string[] = [];
  const queued: string[] = [];

  // Queue 3 systems per cron run (rotating through the list)
  const lastIndex = await db.from("agent_memory")
    .select("value").eq("agent_id","agent_zero").eq("key","ai_monitor_last_index")
    .single().then(r => (r.data?.value as {index?: number})?.index ?? 0);

  const batch = AI_INTELLIGENCE_TARGETS.slice(lastIndex, lastIndex + 3);
  const nextIndex = (lastIndex + 3) % AI_INTELLIGENCE_TARGETS.length;

  for (const target of batch) {
    // Write to discovery queue
    const { error } = await db.from("pipeline_discovery_queue").insert({
      discovery_id: `DISC-AIMON-${target.name.replace(/\s/g,"")}-${Date.now()}`,
      target_url: target.url,
      target_name: target.name,
      target_type: "ai_company",
      purpose: "monitor",
      triggered_by: "cron",
      project: "AI Intelligence Monitor",
      priority: 7,
      strict_score_threshold: target.min_score,
      notes: JSON.stringify({ category: target.category, monitor_for: target.monitor_for }),
      status: "queued",
      stage: "discovery",
      created_at: new Date().toISOString(),
    });
    if (!error) { queued.push(target.name); }
    monitored.push(target.name);
  }

  // Update rotation index
  await remember({ agent_id: "agent_zero", memory_type: "procedural",
    key: "ai_monitor_last_index", value: { index: nextIndex, last_run: new Date().toISOString() },
    importance: 4, tags: ["cron","ai_monitor"] });

  await remember({ agent_id: "agent_zero", memory_type: "episodic",
    key: `ai_monitor_run:${new Date().toISOString().slice(0,16)}`,
    value: { batch: batch.map(b => b.name), queued, total_targets: AI_INTELLIGENCE_TARGETS.length },
    importance: 5, tags: ["cron","ai_monitor","intelligence"] });

  return NextResponse.json({
    ok: true,
    total_targets: AI_INTELLIGENCE_TARGETS.length,
    this_batch: batch.map(b => b.name),
    queued,
    next_index: nextIndex,
    note: "Systems scored below their min_score threshold will trigger AUTO_BUILDER fixes",
  });
}
