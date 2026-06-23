/**
 * /api/vault
 * Secure secret management bridge for Agent Zero
 * Allows the agent to read, write, list, and rotate secrets
 * across all Vercel projects without manual intervention.
 *
 * Auth: x-vault-token header must match VAULT_SECRET env var
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN || "";
const VAULT_SECRET = process.env.VAULT_SECRET     || "";
const TEAM_ID      = process.env.VERCEL_TEAM_ID   || "team_aFdds8lsbHMwe2ip4aQdbQ3d";

function auth(req: NextRequest): boolean {
  const h = req.headers.get("x-vault-token") || req.headers.get("authorization")?.replace("Bearer ","") || "";
  return h === VAULT_SECRET && VAULT_SECRET.length > 8;
}

async function vfetch(path: string, method = "GET", body?: object) {
  const url = "https://api.vercel.com" + path + (path.includes("?") ? "&" : "?") + "teamId=" + TEAM_ID;
  const opts: RequestInit = {
    method,
    headers: { "Authorization": "Bearer " + VERCEL_TOKEN, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) {
    const e = await r.text().catch(() => "");
    throw new Error("Vercel API " + r.status + ": " + e.slice(0, 200));
  }
  return r.json();
}

// List all projects
async function listProjects(): Promise<Array<{ id: string; name: string }>> {
  const d = await vfetch("/v9/projects?limit=50&sort=updatedAt") as { projects: Array<{id:string;name:string}> };
  return d.projects || [];
}

// List env vars for a project
async function listEnvs(projectId: string): Promise<Array<{ id: string; key: string; type: string; value?: string }>> {
  const d = await vfetch("/v9/projects/" + projectId + "/env?limit=100&decrypt=true") as { envs: Array<{id:string;key:string;type:string;value?:string}> };
  return d.envs || [];
}

// Upsert (create or replace) an env var
async function upsertEnv(projectId: string, key: string, value: string, type = "plain") {
  const existing = await listEnvs(projectId);
  const found    = existing.find(e => e.key === key);
  if (found?.id) {
    await vfetch("/v9/projects/" + projectId + "/env/" + found.id, "DELETE");
  }
  return vfetch("/v9/projects/" + projectId + "/env", "POST", {
    key, value, type,
    target: ["production", "preview", "development"],
  });
}

// Delete an env var
async function deleteEnv(projectId: string, key: string) {
  const existing = await listEnvs(projectId);
  const found    = existing.find(e => e.key === key);
  if (!found?.id) return { ok: false, error: "Key not found" };
  await vfetch("/v9/projects/" + projectId + "/env/" + found.id, "DELETE");
  return { ok: true, deleted: key };
}

// Copy keys from one project to another
async function copyKeys(fromProjectId: string, toProjectId: string, keys: string[]) {
  const envs   = await listEnvs(fromProjectId);
  const results: Record<string, string> = {};
  for (const key of keys) {
    const e = envs.find(x => x.key === key);
    if (!e || !e.value || e.value.length < 5) { results[key] = "not_found_or_empty"; continue; }
    await upsertEnv(toProjectId, key, e.value, "plain");
    results[key] = "copied";
  }
  return results;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const op        = req.nextUrl.searchParams.get("op") || "status";
  const projectId = req.nextUrl.searchParams.get("project") || "";
  const key       = req.nextUrl.searchParams.get("key") || "";

  if (op === "status") {
    const projects = await listProjects();
    return NextResponse.json({
      ok: true,
      vault: "online",
      projects: projects.map(p => ({ id: p.id, name: p.name })),
      capabilities: ["list_projects", "list_keys", "get_key", "set_key", "delete_key", "copy_keys", "sync_all"],
    });
  }

  if (op === "list_projects") {
    const projects = await listProjects();
    return NextResponse.json({ ok: true, projects });
  }

  if (op === "list_keys" && projectId) {
    const envs = await listEnvs(projectId);
    return NextResponse.json({
      ok: true,
      project: projectId,
      count: envs.length,
      keys: envs.map(e => ({ key: e.key, type: e.type, has_value: !!(e.value && e.value.length > 3) })),
    });
  }

  if (op === "get_key" && projectId && key) {
    const envs = await listEnvs(projectId);
    const found = envs.find(e => e.key === key);
    if (!found) return NextResponse.json({ ok: false, error: "Key not found" }, { status: 404 });
    return NextResponse.json({ ok: true, key: found.key, type: found.type, has_value: !!(found.value && found.value.length > 3) });
  }

  return NextResponse.json({ ok: false, error: "Unknown op or missing params" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    op?: string;
    project?: string;
    key?: string;
    value?: string;
    type?: string;
    from_project?: string;
    to_project?: string;
    keys?: string[];
    pairs?: Record<string, string>;
  };

  const { op, project, key, value, type } = body;

  // Set a single key
  if (op === "set_key" && project && key && value !== undefined) {
    const result = await upsertEnv(project, key, value, type || "plain");
    return NextResponse.json({ ok: true, op: "set_key", key, project, result });
  }

  // Set multiple keys at once
  if (op === "set_keys" && project && body.pairs) {
    const results: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.pairs)) {
      await upsertEnv(project, k, v as string, "plain");
      results[k] = "set";
    }
    return NextResponse.json({ ok: true, op: "set_keys", project, results });
  }

  // Delete a key
  if (op === "delete_key" && project && key) {
    const result = await deleteEnv(project, key);
    return NextResponse.json({ ok: true, ...result });
  }

  // Copy keys from one project to another
  if (op === "copy_keys" && body.from_project && body.to_project && body.keys) {
    const results = await copyKeys(body.from_project, body.to_project, body.keys);
    return NextResponse.json({ ok: true, op: "copy_keys", results });
  }

  // Sync all keys from sandbox env to a project
  if (op === "sync_sandbox" && project) {
    // This is called by the agent with known keys to push
    const pairs = body.pairs || {};
    const results: Record<string, string> = {};
    for (const [k, v] of Object.entries(pairs)) {
      if (v && (v as string).length > 3) {
        await upsertEnv(project, k, v as string, "plain");
        results[k] = "synced";
      } else {
        results[k] = "skipped_empty";
      }
    }
    return NextResponse.json({ ok: true, op: "sync_sandbox", project, results });
  }

  return NextResponse.json({ ok: false, error: "Unknown op or missing params" }, { status: 400 });
}
