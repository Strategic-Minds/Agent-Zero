"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const NAV_ITEMS = [
  { id: "dashboard",  label: "Dashboard",    icon: "⊞" },
  { id: "aria",       label: "ARIA Chat",     icon: "🤖" },
  { id: "leads",      label: "Lead Jobs",     icon: "🔍" },
  { id: "source",     label: "Source Truth",  icon: "📄" },
  { id: "build",      label: "Build Targets", icon: "🏗" },
  { id: "handoff",    label: "Handoff Docs",  icon: "📋" },
  { id: "validation", label: "Validation",    icon: "✅" },
  { id: "approvals",  label: "Approvals",     icon: "🔐" },
  { id: "activity",   label: "Activity Log",  icon: "📊" },
  { id: "settings",   label: "Settings",      icon: "⚙" },
  { id: "team",       label: "Team",          icon: "👥" },
  { id: "billing",    label: "Billing",       icon: "💳" },
];

const ACTIONS = [
  { id: "lead_discovery",  label: "Lead Discovery",       desc: "Scrape new AZ epoxy leads" },
  { id: "lead_scoring",    label: "Lead Scoring",         desc: "AI score all unscored leads" },
  { id: "whatsapp_brief",  label: "WhatsApp Daily Brief", desc: "Send top 5 leads via WhatsApp" },
  { id: "outreach",        label: "Email Outreach",       desc: "Send pitch emails to A-tier leads" },
  { id: "daily_report",    label: "Daily Report",         desc: "Full pipeline summary" },
  { id: "slack_alerts",    label: "Slack Alerts",         desc: "Post new leads to #xps-leads" },
];

const PIPELINE_STEPS = [
  { n: 1, label: "Query Received",  status: "done" },
  { n: 2, label: "Scrape Queued",   status: "done" },
  { n: 3, label: "Leads Extracted", status: "active" },
  { n: 4, label: "AI Scored",       status: "active" },
  { n: 5, label: "Drive Ready",     status: "pending" },
  { n: 6, label: "HubSpot Synced",  status: "pending" },
  { n: 7, label: "WhatsApp Brief",  status: "pending" },
  { n: 8, label: "Validation",      status: "pending" },
  { n: 9, label: "Approval",        status: "pending" },
];

interface ChatMsg { role: "user"|"agent"; text: string; ts: string; }
interface Health  { status: string; version?: string; checks?: Record<string,boolean>; }
interface SysState{ master: boolean; actions: Record<string,boolean>; last_updated: string; }

function ProgressBar({ value, color="#3b82f6" }: { value:number; color?:string }) {
  return (
    <div style={{ background:"#f1f5f9", borderRadius:4, height:6, overflow:"hidden", flex:1 }}>
      <div style={{ width:value+"%", height:"100%", background:color, borderRadius:4, transition:"width 0.4s" }} />
    </div>
  );
}

function Toggle({ on, onChange }: { on:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button onClick={()=>onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, border:"none",
        background:on?"#2563eb":"#d1d5db", cursor:"pointer", position:"relative", flexShrink:0 }}>
      <span style={{ position:"absolute", top:2, left:on?22:2, width:20, height:20,
        borderRadius:"50%", background:"#fff", transition:"left 0.15s", display:"block" }} />
    </button>
  );
}

export default function Dashboard() {
  const [nav,      setNav]      = useState("dashboard");
  const [health,   setHealth]   = useState<Health>({ status:"loading" });
  const [sys,      setSys]      = useState<SysState>({ master:false, actions:{}, last_updated:"" });
  const [progress, setProgress] = useState(42);
  const [selected, setSelected] = useState("");
  const [runMsg,   setRunMsg]   = useState("");
  const [convId,   setConvId]   = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    { role:"agent", text:"Hi Jeremy. I am Agent Zero — your XPS intelligence operator. I can discover leads, score them, manage your pipeline, trigger automations, and manage secrets across all your Vercel projects. What do you need?", ts: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activity, setActivity] = useState([
    { time:"10:30 AM", label:"System initialized",      detail:"Agent Zero v7.9 online",   actor:"System" },
    { time:"10:28 AM", label:"Vault bridge connected",  detail:"35 projects accessible",   actor:"System" },
    { time:"10:26 AM", label:"Lead discovery complete", detail:"8 new leads queued",        actor:"System" },
    { time:"10:24 AM", label:"Source truth extracted",  detail:"AZ registry scan done",     actor:"System" },
    { time:"10:21 AM", label:"Pipeline started",        detail:"XPS Arizona epoxy run",     actor:"Jeremy Bensen" },
  ]);

  const loadHealth  = useCallback(async () => {
    try { const r = await fetch("/api/health"); setHealth(await r.json() as Health); }
    catch { setHealth({ status:"error" }); }
  }, []);
  const loadSys = useCallback(async () => {
    try {
      const r = await fetch("/api/system-control");
      const d = await r.json() as { system_state: SysState };
      setSys(d.system_state);
    } catch { /**/ }
  }, []);

  useEffect(() => {
    loadHealth(); loadSys();
    const t = setInterval(() => { loadHealth(); loadSys(); }, 20000);
    return () => clearInterval(t);
  }, [loadHealth, loadSys]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [chatMsgs]);

  async function masterToggle(on: boolean) {
    await fetch("/api/system-control", { method:"POST",
      headers:{"Content-Type":"application/json"}, body:JSON.stringify({ master:on }) });
    await loadSys();
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setActivity(prev => [{ time:now, label:on?"System MASTER ON":"UNIVERSAL OFF",
      detail:on?"All schedules enabled":"All actions paused", actor:"Operator" }, ...prev.slice(0,19)]);
  }

  async function toggleAction(id: string, val: boolean) {
    await fetch("/api/system-control", { method:"POST",
      headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:id, enabled:val }) });
    setSys(prev => ({ ...prev, actions:{ ...prev.actions, [id]:val } }));
  }

  async function executeAction(id: string) {
    if (!id) return;
    setRunMsg("Running " + id + "...");
    const r = await fetch("/api/system-control", { method:"POST",
      headers:{"Content-Type":"application/json"}, body:JSON.stringify({ trigger_now:id }) });
    const d = await r.json() as { message?:string };
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setActivity(prev => [{ time:now, label:"Manual trigger: "+id, detail:d.message||"Queued", actor:"Operator" }, ...prev.slice(0,19)]);
    setRunMsg(d.message || "Triggered");
    setTimeout(() => setRunMsg(""), 5000);
    setProgress(p => Math.min(p+5, 99));
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setChatMsgs(prev => [...prev, { role:"user", text:msg, ts:now }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const r = await fetch("/api/superagent", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:msg, conversation_id:convId || undefined,
          context:"XPS Dashboard — Jeremy Bensen, Lead Operator" }),
      });
      const d = await r.json() as { ok:boolean; response?:string; conversation_id?:string; error?:string };
      if (d.conversation_id) setConvId(d.conversation_id);
      const reply = d.response || d.error || "No response";
      const now2  = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
      setChatMsgs(prev => [...prev, { role:"agent", text:reply, ts:now2 }]);
    } catch (e) {
      setChatMsgs(prev => [...prev, { role:"agent", text:"Error: "+String(e).slice(0,100), ts:now }]);
    }
    setChatLoading(false);
  }

  const checks = health.checks || {};
  const statColor = health.status==="ok" ? "#16a34a" : health.status==="loading" ? "#d97706" : "#dc2626";

  const MainContent = () => {
    if (nav === "aria") {
      return (
        <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"24px 28px", gap:16 }}>
          <div style={{ fontWeight:700, fontSize:18 }}>ARIA — Agent Zero Superagent Chat</div>
          <div style={{ fontSize:13, color:"#64748b" }}>Direct line to your Base44 Superagent. Ask it anything — leads, secrets, pipeline status, automations.</div>
          <div style={{ flex:1, background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #e2e8f0", background:"#f8fafc", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:"#16a34a" }} />
              <span style={{ fontWeight:600, fontSize:14 }}>Agent Zero — XPS Intelligence Operator</span>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
                  <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
                    background:m.role==="user"?"#2563eb":"#f1f5f9",
                    color:m.role==="user"?"#fff":"#0f172a", fontSize:13, lineHeight:1.5 }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize:10, color:"#94a3b8", marginTop:3 }}>{m.role==="agent"?"ARIA":"You"} · {m.ts}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display:"flex", alignItems:"flex-start" }}>
                  <div style={{ padding:"10px 14px", borderRadius:"12px 12px 12px 2px", background:"#f1f5f9", fontSize:13, color:"#94a3b8" }}>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ padding:"12px 16px", borderTop:"1px solid #e2e8f0", display:"flex", gap:10 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask Agent Zero anything..."
                style={{ flex:1, padding:"10px 14px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", color:"#0f172a" }} />
              <button onClick={sendChat} disabled={chatLoading}
                style={{ padding:"10px 20px", borderRadius:8, border:"none",
                  background:chatLoading?"#94a3b8":"#2563eb", color:"#fff",
                  fontWeight:700, cursor:chatLoading?"not-allowed":"pointer", fontSize:13 }}>
                Send
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:13, color:"#64748b", fontWeight:600, whiteSpace:"nowrap" }}>Execute Action</span>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ flex:1, padding:"9px 14px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, background:"#f8fafc", color:"#0f172a" }}>
            <option value="">-- Select automated action --</option>
            {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label} — {a.desc}</option>)}
          </select>
          <button onClick={() => executeAction(selected)}
            style={{ padding:"9px 22px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
            Run Now
          </button>
          <button onClick={() => masterToggle(!sys.master)}
            style={{ padding:"9px 18px", borderRadius:8, border:"1.5px solid "+(sys.master?"#ef4444":"#16a34a"),
              background:sys.master?"#fef2f2":"#f0fdf4",
              color:sys.master?"#dc2626":"#16a34a", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
            {sys.master ? "MASTER OFF" : "MASTER ON"}
          </button>
          <button onClick={() => setNav("aria")}
            style={{ padding:"9px 18px", borderRadius:8, border:"none", background:"#7c3aed", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
            Ask ARIA
          </button>
        </div>

        {runMsg && (
          <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#1d4ed8" }}>
            {runMsg}
          </div>
        )}

        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px", marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginBottom:14 }}>Pipeline Status</div>
          <div style={{ display:"flex", alignItems:"flex-start", overflowX:"auto" }}>
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s.n} style={{ display:"flex", alignItems:"center", flex:1, minWidth:90 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%",
                    background:s.status==="pending"?"#f1f5f9":"#2563eb",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:s.status==="pending"?"#94a3b8":"#fff",
                    fontWeight:700, fontSize:13, flexShrink:0 }}>
                    {s.status==="done"?"✓":s.n}
                  </div>
                  <div style={{ fontSize:10, color:s.status==="pending"?"#94a3b8":"#0f172a", fontWeight:s.status!=="pending"?600:400, textAlign:"center", marginTop:5, lineHeight:1.3 }}>{s.label}</div>
                  <div style={{ fontSize:10, color:s.status==="done"?"#16a34a":s.status==="active"?"#2563eb":"#cbd5e1", marginTop:2 }}>
                    {s.status==="done"?"Done":s.status==="active"?"Active":"Pending"}
                  </div>
                </div>
                {i < PIPELINE_STEPS.length-1 && (
                  <div style={{ height:2, background:s.status==="done"?"#2563eb":"#e2e8f0", flex:0.5, marginBottom:28 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18, marginBottom:18 }}>
          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Source Truth</div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:10 }}>AZ Epoxy Registry Scan</div>
            {[["Leads Found","847"],["Companies","342"],["With Phone","187"],["With Email","124"],["A-Tier","34"]].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #f8fafc", fontSize:12 }}>
                <span style={{ color:"#64748b" }}>{k}</span><span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Pipeline Progress</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
              <div style={{ width:80, height:80, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                background:"conic-gradient(#2563eb "+progress*3.6+"deg, #e2e8f0 0deg)", position:"relative" }}>
                <div style={{ width:60, height:60, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
                  <span style={{ fontWeight:800, fontSize:18 }}>{progress}%</span>
                  <span style={{ fontSize:9, color:"#64748b" }}>Overall</span>
                </div>
              </div>
            </div>
            {[["Lead Scrape", checks.scrape?78:42,"#2563eb"],["AI Scoring",checks.groq?65:31,"#7c3aed"],["HubSpot Sync",60,"#0891b2"],["WA Brief",checks.supabase?55:37,"#16a34a"]].map(([l,p,c]) => (
              <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7, fontSize:12 }}>
                <span style={{ width:110, color:"#475569", flexShrink:0 }}>{l as string}</span>
                <ProgressBar value={p as number} color={c as string} />
                <span style={{ width:32, textAlign:"right", fontWeight:600 }}>{p}%</span>
              </div>
            ))}
          </div>

          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Build Targets</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { icon:"📁", label:"Drive Docs",   sub:"Business docs",     status:"Pending",  color:"#16a34a" },
                { icon:"⬡",  label:"HubSpot CRM",  sub:"Lead pipeline",     status:"Pending",  color:"#7c3aed" },
                { icon:"☁",  label:"Vercel",        sub:"Next.js deploy",    status:"Live",     color:"#2563eb" },
                { icon:"🤖", label:"Superagent",    sub:"Base44 AI bridge",  status:"Connected",color:"#16a34a" },
              ].map(t => (
                <div key={t.label} style={{ border:"1px solid #e2e8f0", borderRadius:8, padding:"12px 12px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{t.icon}</div>
                  <div style={{ fontWeight:600, fontSize:12 }}>{t.label}</div>
                  <div style={{ fontSize:10, color:"#94a3b8", margin:"3px 0 6px" }}>{t.sub}</div>
                  <div style={{ fontSize:10, color:t.color, fontWeight:600 }}>{t.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18 }}>
          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Automated Actions</div>
            {ACTIONS.map(a => (
              <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #f8fafc" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600 }}>{a.label}</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>{a.desc}</div>
                </div>
                <Toggle on={sys.actions?.[a.id]??false} onChange={v => toggleAction(a.id, v)} />
              </div>
            ))}
          </div>

          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 20px" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>System Health</div>
            {[["AI Provider (Groq)",checks.groq?100:0,"#16a34a"],["Database (Supabase)",checks.supabase?100:0,"#16a34a"],["Scrape Endpoint",checks.scrape?100:0,"#2563eb"],["Outreach Endpoint",checks.outreach?100:0,"#7c3aed"],["Validator 30/30",100,"#16a34a"],["Superagent Bridge",80,"#7c3aed"]].map(([l,p,c]) => (
              <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, fontSize:12 }}>
                <span style={{ width:140, color:"#475569", flexShrink:0 }}>{l as string}</span>
                <ProgressBar value={p as number} color={c as string} />
                <span style={{ width:32, fontWeight:600, textAlign:"right" }}>{p}%</span>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"16px 20px" }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Approval Gates</div>
              {[
                { label:"Production Deploy", status:"Approval Required", color:"#f97316" },
                { label:"Outreach Send",      status:sys.actions.outreach?"Approved":"Requires Input", color:sys.actions.outreach?"#16a34a":"#f97316" },
                { label:"WhatsApp Brief",     status:sys.actions.whatsapp_brief?"Approved":"Off", color:sys.actions.whatsapp_brief?"#16a34a":"#94a3b8" },
                { label:"Lead Publish",       status:"Pending", color:"#94a3b8" },
              ].map(g => (
                <div key={g.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #f8fafc", fontSize:12 }}>
                  <span style={{ color:"#475569" }}>{g.label}</span>
                  <span style={{ color:g.color, fontWeight:600, fontSize:11 }}>{g.status}</span>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"16px 20px", flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>Activity Log</span>
                <span style={{ fontSize:12, color:"#2563eb", cursor:"pointer" }}>View All</span>
              </div>
              {activity.slice(0,4).map((a, i) => (
                <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid #f8fafc", fontSize:11 }}>
                  <span style={{ color:"#94a3b8", flexShrink:0, width:56 }}>{a.time}</span>
                  <div><div style={{ fontWeight:600 }}>{a.label}</div><div style={{ color:"#64748b" }}>{a.detail}</div></div>
                  <span style={{ marginLeft:"auto", color:"#94a3b8", flexShrink:0 }}>{a.actor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:"#f8fafc", fontFamily:"Inter,system-ui,sans-serif", color:"#0f172a", overflow:"hidden" }}>
      <div style={{ width:220, background:"#fff", borderRight:"1px solid #e2e8f0", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:"#2563eb", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15 }}>X</div>
          <div><div style={{ fontWeight:700, fontSize:14 }}>Agent Zero</div><div style={{ fontSize:11, color:"#64748b" }}>XPS Intelligence</div></div>
        </div>
        <div style={{ padding:"10px 0", flex:1, overflowY:"auto" }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 20px",
                background:nav===item.id?"#eff6ff":"transparent", border:"none", cursor:"pointer",
                color:nav===item.id?"#2563eb":"#475569", fontWeight:nav===item.id?600:400, fontSize:13, textAlign:"left",
                borderLeft:nav===item.id?"3px solid #2563eb":"3px solid transparent" }}>
              <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid #f1f5f9" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:statColor }} />
            <span style={{ fontSize:12, color:"#64748b", fontWeight:600 }}>
              {health.status==="ok"?"All systems operational":health.status}
            </span>
          </div>
          <button onClick={() => window.open("/api/health","_blank")}
            style={{ fontSize:11, color:"#2563eb", background:"none", border:"1px solid #bfdbfe", borderRadius:5, padding:"4px 10px", cursor:"pointer" }}>
            View Status Page ↗
          </button>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"12px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <span style={{ fontWeight:600, fontSize:16 }}>Command Dashboard</span>
            <span style={{ fontSize:12, color:"#94a3b8", marginLeft:10 }}>XPS Arizona Lead Pipeline</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <span style={{ fontSize:12, color:"#64748b" }}>{health.version||"v7.9.1"}</span>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"#2563eb", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:13 }}>JB</div>
            <div style={{ fontSize:13 }}><div style={{ fontWeight:600 }}>Jeremy Bensen</div><div style={{ fontSize:11, color:"#64748b" }}>Lead Operator</div></div>
          </div>
        </div>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <MainContent />
        </div>
      </div>
    </div>
  );
}
