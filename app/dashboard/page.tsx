"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const NAV = [
  { id:"dashboard",  label:"Dashboard",   icon:"⊞" },
  { id:"aria",       label:"ARIA Chat",    icon:"🤖" },
  { id:"leads",      label:"Lead Jobs",    icon:"🔍" },
  { id:"source",     label:"Source Truth", icon:"📄" },
  { id:"build",      label:"Build Targets",icon:"🏗"  },
  { id:"handoff",    label:"Handoff Docs", icon:"📋" },
  { id:"validation", label:"Validation",   icon:"✅" },
  { id:"approvals",  label:"Approvals",    icon:"🔐" },
  { id:"activity",   label:"Activity Log", icon:"📊" },
  { id:"settings",   label:"Settings",     icon:"⚙"  },
  { id:"team",       label:"Team",         icon:"👥" },
  { id:"billing",    label:"Billing",      icon:"💳" },
];

const ACTIONS = [
  { id:"lead_discovery",  label:"Lead Discovery",      desc:"Scrape new AZ epoxy leads" },
  { id:"lead_scoring",    label:"Lead Scoring",         desc:"AI score all unscored leads" },
  { id:"whatsapp_brief",  label:"WhatsApp Daily Brief", desc:"Send top 5 leads via WhatsApp" },
  { id:"outreach",        label:"Email Outreach",       desc:"Send pitch emails to A-tier leads" },
  { id:"daily_report",    label:"Daily Report",         desc:"Full pipeline summary" },
  { id:"slack_alerts",    label:"Slack Alerts",         desc:"Post new leads to #xps-leads" },
];

const STEPS = [
  { n:1, label:"Query Received",  s:"done"    },
  { n:2, label:"Scrape Queued",   s:"done"    },
  { n:3, label:"Leads Extracted", s:"active"  },
  { n:4, label:"AI Scored",       s:"active"  },
  { n:5, label:"Drive Ready",     s:"pending" },
  { n:6, label:"HubSpot Synced",  s:"pending" },
  { n:7, label:"WhatsApp Brief",  s:"pending" },
  { n:8, label:"Validation",      s:"pending" },
  { n:9, label:"Approval",        s:"pending" },
];

interface ChatMsg  { role:"user"|"agent"; text:string; ts:string; }
interface Health   { status:string; version?:string; checks?:Record<string,boolean>; }
interface SysState { master:boolean; actions:Record<string,boolean>; last_updated:string; }

const W = "#ffffff";
const G = "#94a3b8";
const B = "#3b82f6";
const D = "#0f172a";
const S = "#1e293b";

function Bar({ v, c=B }: { v:number; c?:string }) {
  return (
    <div style={{ background:"#334155", borderRadius:4, height:6, flex:1, overflow:"hidden" }}>
      <div style={{ width:v+"%", height:"100%", background:c, borderRadius:4 }} />
    </div>
  );
}

function Toggle({ on, onChange }: { on:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button onClick={()=>onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, border:"none",
        background:on?B:"#334155", cursor:"pointer", position:"relative", flexShrink:0 }}>
      <span style={{ position:"absolute", top:2, left:on?22:2, width:20, height:20,
        borderRadius:"50%", background:W, transition:"left 0.15s", display:"block" }} />
    </button>
  );
}

function Card({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ background:S, border:"1px solid #334155", borderRadius:10, padding:"18px 20px", ...style }}>{children}</div>;
}

export default function Dashboard() {
  const [nav,    setNav]    = useState("dashboard");
  const [health, setHealth] = useState<Health>({ status:"loading" });
  const [sys,    setSys]    = useState<SysState>({ master:false, actions:{}, last_updated:"" });
  const [sel,    setSel]    = useState("");
  const [runMsg, setRunMsg] = useState("");
  const [convId, setConvId] = useState("69db04786e1e12f6317e2274");
  const [msgs,   setMsgs]   = useState<ChatMsg[]>([
    { role:"agent", text:"Hi Jeremy. I am Agent Zero — XPS Intelligence Operator. I can discover leads, score them, manage your pipeline, trigger automations, and manage secrets across your Vercel projects. What do you need?", ts:"" },
  ]);
  const [input,    setInput]    = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [progress, setProgress] = useState(42);
  const chatEnd = useRef<HTMLDivElement>(null);

  const [log, setLog] = useState([
    { time:"10:30", label:"System initialized",      detail:"Agent Zero v8.1 online",    actor:"System" },
    { time:"10:28", label:"Vault bridge connected",  detail:"35 projects accessible",    actor:"System" },
    { time:"10:26", label:"ARIA bridge live",         detail:"Groq 454ms response",       actor:"System" },
    { time:"10:24", label:"Lead discovery complete", detail:"8 new leads queued",        actor:"System" },
    { time:"10:21", label:"Pipeline started",        detail:"XPS Arizona epoxy run",     actor:"Jeremy Bensen" },
  ]);

  const loadH = useCallback(async () => {
    try { const r = await fetch("/api/health"); setHealth(await r.json() as Health); } catch { setHealth({ status:"error" }); }
  }, []);
  const loadS = useCallback(async () => {
    try { const r = await fetch("/api/system-control"); const d = await r.json() as { system_state:SysState }; setSys(d.system_state); } catch { /**/ }
  }, []);

  useEffect(() => { loadH(); loadS(); const t = setInterval(() => { loadH(); loadS(); }, 20000); return () => clearInterval(t); }, [loadH, loadS]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  async function masterToggle(on:boolean) {
    await fetch("/api/system-control", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ master:on }) });
    await loadS();
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setLog(p => [{ time:now, label:on?"MASTER ON":"UNIVERSAL OFF", detail:on?"Schedules active":"All paused", actor:"Operator" }, ...p.slice(0,19)]);
  }

  async function toggleAction(id:string, val:boolean) {
    await fetch("/api/system-control", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:id, enabled:val }) });
    setSys(p => ({ ...p, actions:{ ...p.actions, [id]:val } }));
  }

  async function runAction(id:string) {
    if (!id) return;
    setRunMsg("Running " + id + "...");
    const r = await fetch("/api/system-control", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ trigger_now:id }) });
    const d = await r.json() as { message?:string };
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setLog(p => [{ time:now, label:"Manual: "+id, detail:d.message||"Queued", actor:"Operator" }, ...p.slice(0,19)]);
    setRunMsg(d.message || "Triggered ✓");
    setTimeout(() => setRunMsg(""), 5000);
    setProgress(p => Math.min(p+5,99));
  }

  async function sendMsg() {
    const m = input.trim(); if (!m || chatBusy) return;
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setMsgs(p => [...p, { role:"user", text:m, ts:now }]);
    setInput(""); setChatBusy(true);
    try {
      const r = await fetch("/api/superagent", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:m, conversation_id:convId, context:"XPS Dashboard — Jeremy Bensen" }) });
      const d = await r.json() as { ok:boolean; response?:string; conversation_id?:string; error?:string };
      if (d.conversation_id) setConvId(d.conversation_id);
      const reply = d.response || d.error || "No response";
      setMsgs(p => [...p, { role:"agent", text:reply, ts:new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) }]);
    } catch(e) { setMsgs(p => [...p, { role:"agent", text:"Connection error: "+String(e).slice(0,80), ts:now }]); }
    setChatBusy(false);
  }

  const checks  = health.checks || {};
  const statClr = health.status==="ok"?"#22c55e":health.status==="loading"?"#f59e0b":"#ef4444";
  const ver     = health.version || "v8.1.0";

  const ARIAPanel = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"24px 28px", gap:14 }}>
      <div>
        <div style={{ fontWeight:700, fontSize:18, color:W }}>ARIA — Superagent Chat</div>
        <div style={{ fontSize:13, color:G, marginTop:4 }}>Direct line to Agent Zero. Ask anything — leads, pipeline, secrets, automations.</div>
      </div>
      <div style={{ flex:1, background:"#0f172a", border:"1px solid #334155", borderRadius:12, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        <div style={{ padding:"12px 18px", borderBottom:"1px solid #334155", background:"#1e293b", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:"#22c55e" }} />
          <span style={{ fontWeight:600, fontSize:13, color:W }}>Agent Zero — XPS Intelligence Operator</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:G }}>Base44 Superagent Bridge</span>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}>
          {msgs.map((m,i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"78%", padding:"10px 14px",
                borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
                background:m.role==="user"?B:"#334155",
                color:W, fontSize:13, lineHeight:1.55, whiteSpace:"pre-wrap" }}>
                {m.text}
              </div>
              <div style={{ fontSize:10, color:"#64748b", marginTop:3 }}>{m.role==="agent"?"ARIA":"You"}{m.ts?" · "+m.ts:""}</div>
            </div>
          ))}
          {chatBusy && (
            <div style={{ alignSelf:"flex-start", padding:"10px 14px", borderRadius:"12px 12px 12px 2px", background:"#334155", color:G, fontSize:13 }}>
              Thinking...
            </div>
          )}
          <div ref={chatEnd} />
        </div>
        <div style={{ padding:"12px 18px", borderTop:"1px solid #334155", display:"flex", gap:10 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMsg()}
            placeholder="Ask Agent Zero anything..."
            style={{ flex:1, padding:"10px 14px", borderRadius:8, border:"1px solid #334155", fontSize:13, background:"#0f172a", color:W, outline:"none" }} />
          <button onClick={sendMsg} disabled={chatBusy}
            style={{ padding:"10px 22px", borderRadius:8, border:"none", background:chatBusy?"#334155":B, color:W, fontWeight:700, cursor:chatBusy?"not-allowed":"pointer", fontSize:13 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );

  const MainPanel = () => (
    <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
      {/* ACTION BAR */}
      <Card style={{ padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ flex:1, minWidth:220, padding:"9px 14px", borderRadius:8, border:"1px solid #334155", fontSize:13, background:"#0f172a", color:W }}>
          <option value="">-- Select automated action --</option>
          {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label} — {a.desc}</option>)}
        </select>
        <button onClick={() => runAction(sel)} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:B, color:W, fontWeight:700, cursor:"pointer", fontSize:13 }}>Run Now</button>
        <button onClick={() => masterToggle(!sys.master)}
          style={{ padding:"9px 18px", borderRadius:8, border:"1.5px solid "+(sys.master?"#ef4444":"#22c55e"),
            background:sys.master?"rgba(239,68,68,0.1)":"rgba(34,197,94,0.1)",
            color:sys.master?"#ef4444":"#22c55e", fontWeight:700, cursor:"pointer", fontSize:13 }}>
          {sys.master?"MASTER OFF":"MASTER ON"}
        </button>
        <button onClick={() => setNav("aria")}
          style={{ padding:"9px 18px", borderRadius:8, border:"none", background:"#7c3aed", color:W, fontWeight:700, cursor:"pointer", fontSize:13 }}>
          Ask ARIA
        </button>
      </Card>

      {runMsg && <div style={{ background:"rgba(59,130,246,0.15)", border:"1px solid #3b82f6", borderRadius:8, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#93c5fd" }}>{runMsg}</div>}

      {/* PIPELINE */}
      <Card style={{ marginBottom:18 }}>
        <div style={{ fontWeight:600, fontSize:13, color:W, marginBottom:14 }}>Pipeline Status</div>
        <div style={{ display:"flex", alignItems:"flex-start", overflowX:"auto" }}>
          {STEPS.map((s,i) => (
            <div key={s.n} style={{ display:"flex", alignItems:"center", flex:1, minWidth:90 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                <div style={{ width:32, height:32, borderRadius:"50%",
                  background:s.s==="pending"?"#334155":B,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:s.s==="pending"?G:W, fontWeight:700, fontSize:13 }}>
                  {s.s==="done"?"✓":s.n}
                </div>
                <div style={{ fontSize:10, color:s.s==="pending"?G:W, fontWeight:s.s!=="pending"?600:400, textAlign:"center", marginTop:5, lineHeight:1.3 }}>{s.label}</div>
                <div style={{ fontSize:10, color:s.s==="done"?"#22c55e":s.s==="active"?B:G, marginTop:2 }}>
                  {s.s==="done"?"Done":s.s==="active"?"Active":"Pending"}
                </div>
              </div>
              {i<STEPS.length-1 && <div style={{ height:2, background:s.s==="done"?B:"#334155", flex:0.5, marginBottom:28 }} />}
            </div>
          ))}
        </div>
      </Card>

      {/* 3 COLS */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18, marginBottom:18 }}>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:W, marginBottom:10 }}>Source Truth</div>
          <div style={{ fontSize:12, color:G, marginBottom:10 }}>AZ Epoxy Registry Scan</div>
          {[["Leads Found","847"],["Companies","342"],["With Phone","187"],["With Email","124"],["A-Tier","34"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #334155", fontSize:12 }}>
              <span style={{ color:G }}>{k}</span><span style={{ fontWeight:600, color:W }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:W, marginBottom:12 }}>Pipeline Progress</div>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <div style={{ width:80, height:80, borderRadius:"50%", position:"relative",
              background:"conic-gradient("+B+" "+progress*3.6+"deg, #334155 0deg)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:60, height:60, borderRadius:"50%", background:S, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontWeight:800, fontSize:18, color:W }}>{progress}%</span>
                <span style={{ fontSize:9, color:G }}>Overall</span>
              </div>
            </div>
          </div>
          {[["Lead Scrape",checks.scrape?78:42,B],["AI Scoring",checks.groq?65:31,"#a855f7"],["HubSpot Sync",60,"#06b6d4"],["WA Brief",checks.supabase?55:37,"#22c55e"]].map(([l,p,c]) => (
            <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7, fontSize:12 }}>
              <span style={{ width:100, color:G, flexShrink:0 }}>{l as string}</span>
              <Bar v={p as number} c={c as string} />
              <span style={{ width:32, textAlign:"right", fontWeight:600, color:W }}>{p}%</span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:W, marginBottom:12 }}>Build Targets</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { icon:"📁", label:"Drive Docs",   sub:"Business docs",    status:"Pending",    color:G },
              { icon:"⬡",  label:"HubSpot CRM",  sub:"Lead pipeline",    status:"Pending",    color:G },
              { icon:"☁",  label:"Vercel",        sub:"Next.js deploy",   status:"Live",       color:"#22c55e" },
              { icon:"🤖", label:"Superagent",    sub:"Base44 AI bridge", status:"Connected",  color:"#22c55e" },
            ].map(t => (
              <div key={t.label} style={{ border:"1px solid #334155", borderRadius:8, padding:"12px 10px", textAlign:"center", background:"#0f172a" }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{t.icon}</div>
                <div style={{ fontWeight:600, fontSize:12, color:W }}>{t.label}</div>
                <div style={{ fontSize:10, color:G, margin:"3px 0 5px" }}>{t.sub}</div>
                <div style={{ fontSize:10, color:t.color, fontWeight:600 }}>{t.status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* BOTTOM ROW */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18 }}>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:W, marginBottom:12 }}>Automated Actions</div>
          {ACTIONS.map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #334155" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:W }}>{a.label}</div>
                <div style={{ fontSize:10, color:G }}>{a.desc}</div>
              </div>
              <Toggle on={sys.actions?.[a.id]??false} onChange={v => toggleAction(a.id, v)} />
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:W, marginBottom:12 }}>System Health</div>
          {[["Groq AI",checks.groq?100:0,"#22c55e"],["Supabase DB",checks.supabase?100:0,"#22c55e"],["Scrape",checks.scrape?100:0,B],["Outreach",checks.outreach?100:0,"#a855f7"],["Validator",100,"#22c55e"],["Superagent",80,"#a855f7"]].map(([l,p,c]) => (
            <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, fontSize:12 }}>
              <span style={{ width:100, color:G, flexShrink:0 }}>{l as string}</span>
              <Bar v={p as number} c={c as string} />
              <span style={{ width:30, fontWeight:600, textAlign:"right", color:W }}>{p}%</span>
            </div>
          ))}
        </Card>

        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <Card style={{ padding:"16px 18px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:W, marginBottom:10 }}>Approval Gates</div>
            {[
              { label:"Production Deploy", status:"Approval Required", color:"#f97316" },
              { label:"Outreach Send",     status:sys.actions.outreach?"Approved":"Needs Input", color:sys.actions.outreach?"#22c55e":"#f97316" },
              { label:"WhatsApp Brief",    status:sys.actions.whatsapp_brief?"Approved":"Off", color:sys.actions.whatsapp_brief?"#22c55e":G },
              { label:"Lead Publish",      status:"Pending", color:G },
            ].map(g => (
              <div key={g.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #334155", fontSize:12 }}>
                <span style={{ color:G }}>{g.label}</span>
                <span style={{ color:g.color, fontWeight:600, fontSize:11 }}>{g.status}</span>
              </div>
            ))}
          </Card>
          <Card style={{ padding:"16px 18px", flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontWeight:700, fontSize:14, color:W }}>Activity Log</span>
              <span style={{ fontSize:12, color:B, cursor:"pointer" }}>View All</span>
            </div>
            {log.slice(0,4).map((a,i) => (
              <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid #334155", fontSize:11 }}>
                <span style={{ color:G, flexShrink:0, width:44 }}>{a.time}</span>
                <div><div style={{ fontWeight:600, color:W }}>{a.label}</div><div style={{ color:G }}>{a.detail}</div></div>
                <span style={{ marginLeft:"auto", color:"#475569", flexShrink:0 }}>{a.actor}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100vh", background:D, fontFamily:"Inter,system-ui,sans-serif", color:W, overflow:"hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width:220, background:"#0b1221", borderRight:"1px solid #1e293b", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #1e293b", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:B, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:W, fontWeight:800, fontSize:15 }}>X</div>
          <div><div style={{ fontWeight:700, fontSize:14, color:W }}>Agent Zero</div><div style={{ fontSize:11, color:G }}>XPS Intelligence</div></div>
        </div>
        <div style={{ padding:"10px 0", flex:1, overflowY:"auto" }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 20px",
                background:nav===item.id?"rgba(59,130,246,0.15)":"transparent",
                border:"none", cursor:"pointer", color:nav===item.id?B:G,
                fontWeight:nav===item.id?600:400, fontSize:13, textAlign:"left",
                borderLeft:nav===item.id?"3px solid "+B:"3px solid transparent" }}>
              <span style={{ fontSize:14 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid #1e293b" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:statClr }} />
            <span style={{ fontSize:11, color:G, fontWeight:600 }}>
              {health.status==="ok"?"All systems operational":health.status}
            </span>
          </div>
          <div style={{ fontSize:11, color:"#475569" }}>{ver}</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#0b1221", borderBottom:"1px solid #1e293b", padding:"12px 28px",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <span style={{ fontWeight:600, fontSize:16, color:W }}>Command Dashboard</span>
            <span style={{ fontSize:12, color:G, marginLeft:10 }}>XPS Arizona Lead Pipeline</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:statClr }} />
            <div style={{ width:32, height:32, borderRadius:"50%", background:B, display:"flex", alignItems:"center", justifyContent:"center", color:W, fontWeight:700, fontSize:13 }}>JB</div>
            <div style={{ fontSize:13 }}>
              <div style={{ fontWeight:600, color:W }}>Jeremy Bensen</div>
              <div style={{ fontSize:11, color:G }}>Lead Operator</div>
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {nav==="aria" ? <ARIAPanel /> : <MainPanel />}
        </div>
      </div>
    </div>
  );
}
