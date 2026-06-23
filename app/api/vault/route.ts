/**
 * /api/vault
 * Secure secret management bridge — lets the agent read/write/copy
 * secrets across all Vercel projects autonomously.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN || "";
const VAULT_SECRET = process.env.VAULT_SECRET     || "";
const TEAM_ID      = process.env.VERCEL_TEAM_ID   || "team_aFdds8lsbHMwe2ip4aQdbQ3d";

function isAuthed(req: NextRequest): boolean {
  const h = req.headers.get("x-vault-token") || req.headers.get("authorization")?.replace("Bearer ","") || "";
  return h === VAULT_SECRET && VAULT_SECRET.length > 8;
}

async function vfetch(path: string, method = "GET", body?: object) {
  const sep = path.includes("?") ? "&" : "?";
  const url = "https://api.vercel.com" + path + sep + "teamId=" + TEAM_ID;
  const opts: RequestInit = {
    method,
    headers: { "Authorization": "Bearer " + VERCEL_TOKEN, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) {
    const e = await r.text().catch(() => "");
    throw new Error("Vercel " + r.status + ": " + e.slice(0,200));
  }
  return r.json() as Promise<Record<string, unknown>>;
}

async function listProjects() {
  const d = await vfetch("/v9/projects?limit=50&sort=updatedAt");
  return (d.projects as Array<{id:string;name:string}>) || [];
}

async function listEnvs(projectId: string) {
  const d = await vfetch("/v9/projects/" + projectId + "/env?limit=100&decrypt=true");
  return (d.envs as Array<{id:string;key:string;type:string;value?:string}>) || [];
}

async function upsertEnv(projectId: string, key: string, value: string, type = "plain") {
  const existing = await listEnvs(projectId);
  const found    = existing.find(e => e.key === key);
  if (found?.id) {
    await vfetch("/v9/projects/" + projectId + "/env/" + found.id, "DELETE");
  }
  return vfetch("/v9/projects/" + projectId + "/env", "POST", {
    key, value, type,
    target: ["production","preview","development"],
  });
}

async function deleteEnv(projectId: string, key: string) {
  const existing = await listEnvs(projectId);
  const found    = existing.find(e => e.key === key);
  if (!found?.id) return { deleted: false, error: "Key not found" };
  await vfetch("/v9/projects/" + projectId + "/env/" + found.id, "DELETE");
  return { deleted: true, key };
}

async function copyKeys(fromId: string, toId: string, keys: string[]) {
  const envs   = await listEnvs(fromId);
  const results: Record<string, string> = {};
  for (const key of keys) {
    const e = envs.find(x => x.key === key);
    if (!e?.value || e.value.length < 5) { results[key] = "empty_or_missing"; continue; }
    await upsertEnv(toId, key, e.value, "plain");
    results[key] = "copied";
  }
  return results;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const op        = req.nextUrl.searchParams.get("op") || "status";
  const projectId = req.nextUrl.searchParams.get("project") || "";
  const key       = req.nextUrl.searchParams.get("key") || "";

  if (op === "status") {
    const projects = await listProjects();
    return NextResponse.json({
      vault: "online",
      projects: projects.map(p => ({ id: p.id, name: p.name })),
      capabilities: ["list_projects","list_keys","get_key","set_key","set_keys","delete_key","copy_keys","sync_sandbox"],
    });
  }
  if (op === "list_projects") {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  }
  if (op === "list_keys" && projectId) {
    const envs = await listEnvs(projectId);
    return NextResponse.json({
      project: projectId,
      count: envs.length,
      keys: envs.map(e => ({ key: e.key, type: e.type, has_value: !!(e.value && e.value.length > 3) })),
    });
  }
  if (op === "get_key" && projectId && key) {
    const envs  = await listEnvs(projectId);
    const found = envs.find(e => e.key === key);
    if (!found) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    return NextResponse.json({ key: found.key, type: found.type, has_value: !!(found.value && found.value.length > 3) });
  }
  return NextResponse.json({ error: "Unknown op or missing params" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    op?: string;
    project?: string;
    key?: string;
    value?: string;
    type?: string;
    from_project?: string;
    to_project?: string;
    keys?: string[];
    pairs?: Record<string,string>;
  };

  const { op, project, key, value } = body;

  if (op === "set_key" && project && key && value !== undefined) {
    const result = await upsertEnv(project, key, value, body.type || "plain");
    return NextResponse.json({ set: true, key, project, result });
  }
  if (op === "set_keys" && project && body.pairs) {
    const results: Record<string,string> = {};
    for (const [k, v] of Object.entries(body.pairs)) {
      await upsertEnv(project, k, v, "plain");
      results[k] = "set";
    }
    return NextResponse.json({ set: true, project, results });
  }
  if (op === "delete_key" && project && key) {
    const result = await deleteEnv(project, key);
    return NextResponse.json(result);
  }
  if (op === "copy_keys" && body.from_project && body.to_project && body.keys) {
    const results = await copyKeys(body.from_project, body.to_project, body.keys);
    return NextResponse.json({ copied: true, results });
  }
  if (op === "sync_sandbox" && project && body.pairs) {
    const results: Record<string,string> = {};
    for (const [k, v] of Object.entries(body.pairs)) {
      if (v && v.length > 3) {
        await upsertEnv(project, k, v, "plain");
        results[k] = "synced";
      } else {
        results[k] = "skipped_empty";
      }
    }
    return NextResponse.json({ synced: true, project, results });
  }
  return NextResponse.json({ error: "Unknown op or missing params" }, { status: 400 });
}
