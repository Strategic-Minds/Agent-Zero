/**
 * AGENT ZERO — TOP 30 CAPABILITIES REGISTRY
 * Based on: GAIA, SWE-bench, WebArena, OSWorld, BrowseComp, τ-bench
 * Derived from top agents: Claude Opus 4.8 (93.9% SWE), OPS-GAIA (#1 92.36%)
 * Devin, AutoGPT, Copilot Workspace, GPT-5.4, Browser-Use #1 97%
 * 
 * Each capability has: id, category, benchmark, score target, status
 */
export interface Capability {
  id: number
  name: string
  category: CapCategory
  benchmark: string
  targetScore: number
  currentScore: number
  status: CapStatus
  description: string
  dependencies: string[]
  autoInstalled: boolean
}

export type CapCategory =
  | "reasoning"
  | "coding"
  | "browser"
  | "memory"
  | "planning"
  | "multimodal"
  | "tools"
  | "communication"
  | "self_improvement"
  | "orchestration"

export type CapStatus = "active" | "partial" | "pending" | "degraded"

export const TOP_30_CAPABILITIES: Capability[] = [
  // ── REASONING (GAIA #1 = 92.36%) ──────────────────────────────────────
  { id: 1, name: "Multi-Step Reasoning", category: "reasoning", benchmark: "GAIA Level 3", targetScore: 92, currentScore: 78, status: "active", description: "Chain-of-thought decomposition of complex real-world tasks across multiple steps", dependencies: [], autoInstalled: true },
  { id: 2, name: "Tool-Use Orchestration", category: "tools", benchmark: "GAIA", targetScore: 90, currentScore: 82, status: "active", description: "Route tasks to the correct tool (search, code, browser, file, API) dynamically", dependencies: ["Multi-Step Reasoning"], autoInstalled: true },
  { id: 3, name: "Self-Critique & Reflection", category: "reasoning", benchmark: "AgentBench", targetScore: 85, currentScore: 70, status: "partial", description: "Evaluate own outputs, detect errors, retry with improved approach", dependencies: [], autoInstalled: true },
  { id: 4, name: "Hypothesis Testing", category: "reasoning", benchmark: "GAIA", targetScore: 88, currentScore: 72, status: "partial", description: "Form hypotheses, design tests, validate against ground truth", dependencies: ["Multi-Step Reasoning"], autoInstalled: true },

  // ── CODING (SWE-bench #1 = 93.9%) ─────────────────────────────────────
  { id: 5, name: "Autonomous Code Generation", category: "coding", benchmark: "SWE-bench Verified", targetScore: 93, currentScore: 85, status: "active", description: "Write production-ready code with tests, TypeScript/Python/Go from specs", dependencies: [], autoInstalled: true },
  { id: 6, name: "Bug Detection & Auto-Fix", category: "coding", benchmark: "SWE-bench", targetScore: 88, currentScore: 80, status: "active", description: "Parse error logs, pinpoint root cause, generate targeted patch", dependencies: ["Autonomous Code Generation"], autoInstalled: true },
  { id: 7, name: "Code Review & Refactoring", category: "coding", benchmark: "SWE-bench", targetScore: 85, currentScore: 75, status: "partial", description: "Review PRs, suggest improvements, auto-refactor for performance and clarity", dependencies: [], autoInstalled: true },
  { id: 8, name: "Full-Stack App Generation", category: "coding", benchmark: "WebArena", targetScore: 80, currentScore: 72, status: "active", description: "Generate complete Next.js/React apps from a single prompt with DB + API + UI", dependencies: ["Autonomous Code Generation"], autoInstalled: true },

  // ── BROWSER / WEB (Online-Mind2Web #1 = 97%) ─────────────────────────
  { id: 9, name: "Autonomous Web Navigation", category: "browser", benchmark: "Online-Mind2Web", targetScore: 97, currentScore: 65, status: "partial", description: "Navigate any website, click elements, fill forms, extract data without supervision", dependencies: [], autoInstalled: true },
  { id: 10, name: "Web Research & Synthesis", category: "browser", benchmark: "BrowseComp", targetScore: 90, currentScore: 75, status: "active", description: "Multi-source research, cross-validate facts, produce sourced summaries", dependencies: ["Autonomous Web Navigation"], autoInstalled: true },
  { id: 11, name: "Competitive Intelligence", category: "browser", benchmark: "BrowseComp", targetScore: 85, currentScore: 78, status: "active", description: "Discover competitors, scrape pricing/features, generate battlecards", dependencies: ["Web Research & Synthesis"], autoInstalled: true },
  { id: 12, name: "Lead Discovery & Scraping", category: "browser", benchmark: "WebArena", targetScore: 80, currentScore: 70, status: "active", description: "Find leads via search + registry APIs, enrich with contact data", dependencies: ["Autonomous Web Navigation"], autoInstalled: true },

  // ── MEMORY (Persistent cross-session) ─────────────────────────────────
  { id: 13, name: "Long-Term Memory (Vector)", category: "memory", benchmark: "τ-bench", targetScore: 88, currentScore: 60, status: "partial", description: "Supabase pgvector semantic memory — store + retrieve facts across sessions", dependencies: [], autoInstalled: true },
  { id: 14, name: "Working Memory & Context", category: "memory", benchmark: "τ-bench", targetScore: 85, currentScore: 72, status: "active", description: "Maintain rich context window across multi-turn long conversations", dependencies: [], autoInstalled: true },
  { id: 15, name: "Entity & Knowledge Graph", category: "memory", benchmark: "GAIA", targetScore: 82, currentScore: 55, status: "pending", description: "Build structured knowledge graphs of people, companies, relationships", dependencies: ["Long-Term Memory (Vector)"], autoInstalled: false },

  // ── PLANNING (Devin-class) ─────────────────────────────────────────────
  { id: 16, name: "Autonomous Task Planning", category: "planning", benchmark: "WebArena #1", targetScore: 74, currentScore: 68, status: "active", description: "Decompose goals into subtasks, assign tools, execute in dependency order", dependencies: ["Multi-Step Reasoning"], autoInstalled: true },
  { id: 17, name: "Parallel Swarm Execution", category: "orchestration", benchmark: "AgentBench", targetScore: 80, currentScore: 65, status: "active", description: "Spawn N parallel sub-agents for independent tasks, merge results", dependencies: ["Autonomous Task Planning"], autoInstalled: true },
  { id: 18, name: "Self-Healing Pipelines", category: "self_improvement", benchmark: "SWE-bench", targetScore: 85, currentScore: 60, status: "partial", description: "Detect pipeline failures, auto-retry with fallback strategies", dependencies: ["Bug Detection & Auto-Fix"], autoInstalled: true },
  { id: 19, name: "Cron-Driven Autonomy", category: "planning", benchmark: "AgentBench", targetScore: 90, currentScore: 85, status: "active", description: "24/7 scheduled execution: discovery, scoring, outreach, reporting", dependencies: [], autoInstalled: true },

  // ── MULTIMODAL ──────────────────────────────────────────────────────────
  { id: 20, name: "Image Generation & Edit", category: "multimodal", benchmark: "OSWorld", targetScore: 83, currentScore: 55, status: "partial", description: "Generate logos, diagrams, mockups via DALL-E 3 / Stable Diffusion", dependencies: [], autoInstalled: true },
  { id: 21, name: "Document Intelligence (PDF)", category: "multimodal", benchmark: "GAIA", targetScore: 85, currentScore: 65, status: "partial", description: "Extract text/tables from PDFs, analyze documents, answer questions", dependencies: [], autoInstalled: true },
  { id: 22, name: "Screen Understanding (OCR)", category: "multimodal", benchmark: "OSWorld #1 83%", targetScore: 83, currentScore: 50, status: "pending", description: "Understand screenshots, detect UI elements, interact via vision", dependencies: [], autoInstalled: false },

  // ── COMMUNICATION ─────────────────────────────────────────────────────
  { id: 23, name: "WhatsApp Parallel Broadcast", category: "communication", benchmark: "τ-bench", targetScore: 90, currentScore: 80, status: "active", description: "Send parallel WhatsApp messages, handle inbound, route to ARIA", dependencies: [], autoInstalled: true },
  { id: 24, name: "Email Intelligence (Gmail)", category: "communication", benchmark: "τ-bench", targetScore: 85, currentScore: 70, status: "partial", description: "Draft/send/classify emails, follow-up sequences, inbox zero automation", dependencies: [], autoInstalled: true },
  { id: 25, name: "Calendar & Meeting Automation", category: "communication", benchmark: "AgentBench", targetScore: 80, currentScore: 65, status: "partial", description: "Auto-schedule meetings, send invites, create follow-up summaries", dependencies: [], autoInstalled: true },

  // ── SELF-IMPROVEMENT ─────────────────────────────────────────────────
  { id: 26, name: "Benchmark Self-Testing", category: "self_improvement", benchmark: "GAIA/SWE/WebArena", targetScore: 100, currentScore: 78, status: "active", description: "Run GAIA, SWE-bench, WebArena tasks nightly, track score deltas", dependencies: [], autoInstalled: true },
  { id: 27, name: "Prompt Self-Optimization", category: "self_improvement", benchmark: "AgentBench", targetScore: 85, currentScore: 55, status: "partial", description: "Analyze failed tasks, rewrite system prompts, measure improvement", dependencies: ["Self-Critique & Reflection"], autoInstalled: true },
  { id: 28, name: "Tool Auto-Discovery", category: "self_improvement", benchmark: "GAIA", targetScore: 82, currentScore: 50, status: "partial", description: "Discover and install new tools from npm/pip, validate, add to registry", dependencies: ["Tool-Use Orchestration"], autoInstalled: false },

  // ── ORCHESTRATION ─────────────────────────────────────────────────────
  { id: 29, name: "Multi-Agent Coordination", category: "orchestration", benchmark: "AgentBench", targetScore: 85, currentScore: 72, status: "active", description: "ARIA + Discovery + Intelligence + Outreach + GHOST + APEX coordinated", dependencies: ["Autonomous Task Planning"], autoInstalled: true },
  { id: 30, name: "External API Integration", category: "tools", benchmark: "τ-bench #1 88%", targetScore: 88, currentScore: 75, status: "active", description: "Connect any REST API: Supabase, HubSpot, GitHub, Google, Twilio, Stripe", dependencies: ["Tool-Use Orchestration"], autoInstalled: true },
]

export function getCapabilityStats() {
  const total = TOP_30_CAPABILITIES.length
  const active = TOP_30_CAPABILITIES.filter(c => c.status === "active").length
  const autoInstalled = TOP_30_CAPABILITIES.filter(c => c.autoInstalled).length
  const avgCurrent = Math.round(TOP_30_CAPABILITIES.reduce((a, c) => a + c.currentScore, 0) / total)
  const avgTarget = Math.round(TOP_30_CAPABILITIES.reduce((a, c) => a + c.targetScore, 0) / total)
  const gpa = ((avgCurrent / avgTarget) * 4.0).toFixed(2)

  return { total, active, autoInstalled, avgCurrent, avgTarget, gpa }
}

export function getCapabilityByCategory(cat: CapCategory) {
  return TOP_30_CAPABILITIES.filter(c => c.category === cat)
}

export function getGapAnalysis() {
  return TOP_30_CAPABILITIES
    .map(c => ({ ...c, gap: c.targetScore - c.currentScore }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10)
}
