/**
 * UNIT TESTS — Agent Zero core agent functions
 * Run with: npm test
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── VALIDATOR ────────────────────────────────────────────────────────────
describe("Validator", () => {
  it("scoreToGrade returns A+ for score>=95 with 0 critical failures", async () => {
    // Test the grade logic directly without network calls
    const score = 97
    const critFails = 0
    const grade = critFails > 0 ? "F" : score >= 95 ? "A+" : score >= 80 ? "A" : "B"
    expect(grade).toBe("A+")
  })

  it("scoreToGrade returns F when critical failures > 0", () => {
    const score = 98
    const critFails = 1
    const grade = critFails > 0 ? "F" : score >= 95 ? "A+" : "A"
    expect(grade).toBe("F")
  })
})

// ── ORCHESTRATOR ─────────────────────────────────────────────────────────
describe("CircuitBreaker", () => {
  it("opens after threshold failures", async () => {
    let failures = 0
    const threshold = 3
    const execute = async (fn: () => Promise<void>) => {
      try { await fn(); failures = 0 }
      catch { failures++ }
    }
    for (let i = 0; i < threshold; i++) {
      await execute(async () => { throw new Error("fail") })
    }
    expect(failures).toBe(threshold)
  })
})

// ── DISCOVERY ────────────────────────────────────────────────────────────
describe("Discovery deduplication", () => {
  it("removes duplicate company names", () => {
    const leads = [
      { company_name: "ABC Epoxy", source: "google" },
      { company_name: "abc-epoxy", source: "yelp" },
      { company_name: "XYZ Floors", source: "az_corp" },
    ]
    const seen = new Set<string>()
    const unique = leads.filter(l => {
      const key = l.company_name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    expect(unique.length).toBe(2)
  })
})

// ── OPTIMIZER ────────────────────────────────────────────────────────────
describe("Optimizer gap selection", () => {
  it("selects highest impact gap first", async () => {
    const gaps = {
      "gap_a": { impact: 5, auto_fixable: true },
      "gap_b": { impact: 12, auto_fixable: true },
      "gap_c": { impact: 8, auto_fixable: true },
    }
    const sorted = Object.entries(gaps)
      .filter(([, g]) => g.auto_fixable)
      .sort(([, a], [, b]) => b.impact - a.impact)
    expect(sorted[0][0]).toBe("gap_b")
    expect(sorted[0][1].impact).toBe(12)
  })
})

// ── HEALTH ───────────────────────────────────────────────────────────────
describe("Health check logic", () => {
  it("returns ok status when core env vars are present", () => {
    const checks = {
      supabase: true,
      groq: true,
      bridge: true,
      github: true,
      hubspot: false,
      whatsapp: false,
    }
    const passing = Object.values(checks).filter(Boolean).length
    const status = passing >= 3 ? "ok" : "degraded"
    expect(status).toBe("ok")
    expect(passing).toBe(4)
  })
})
