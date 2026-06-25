
"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const NAV = [
  { id:"dashboard",  label:"Dashboard",   icon:"⊞" },
  { id:"aria",       label:"ARIA Chat",    icon:"🤖" },
  { id:"leads",      label:"Lead Jobs",    icon:"🔍" },
  { id:"source",     label:"Source Truth", icon:"📄" },
  { id:"vault",      label:"Vault",        icon:"🔐" },
  { id:"validation", label:"Validation",   icon:"✅" },
  { id:"activity",   label:"Activity Log", icon:"📊" },
  { id:"settings",   label:"Settings",     icon:"⚙" },
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
  { n:1, label:"Query\nReceived",   s:"done"    },
  { n:2, label:"Scrape\nQueued",    s:"done"    },
  { n:3, label:"Leads\nExtracted",  s:"active"  },
  { n:4, label:"AI\nScored",        s:"active"  },
  { n:5, label:"Drive\nReady",      s:"pending" },
  { n:6, label:"HubSpot\nSynced",   s:"pending" },
  { n:7, label:"WhatsApp\nBrief",   s:"pending" },
  { n:8, label:"Validation",        s:"pending" },
  { n:9, label:"Approval",          s:"pending" },
];

interface ChatMsg { role:"user"|"agent"; text:string; ts:string; }
interface Health  { status:string; version?:string; checks?:Record<string,boolean>; }
interface SysState{ master:boolean; actions:Record<string,boolean>; last_updated:string; }

/* ── tiny helpers ── */
function PBar({ v, c="#2563eb" }:{ v:number; c?:string }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:4, height:6, overflow:"hidden", flex:1 }}>
      <div style={{ width:v+"%", height:"100%", background:c, borderRadius:4, transition:"width .4s" }} />
    </div>
  );
}
function Toggle({ on, onChange }:{ on:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button onClick={()=>onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, border:"none",
        background:on?"#2563eb":"rgba(255,255,255,0.2)", cursor:"pointer", position:"relative", flexShrink:0 }}>
      <span style={{ position:"absolute", top:2, left:on?22:2, width:20, height:20,
        borderRadius:"50%", background:"#fff", transition:"left .15s", display:"block" }} />
    </button>
  );
}

export default function Dashboard() {
  const [nav,     setNav]     = useState("dashboard");
  const [health,  setHealth]  = useState<Health>({ status:"loading" });
  const [sys,     setSys]     = useState<SysState>({ master:false, actions:{}, last_updated:"" });
  const [pct,     setPct]     = useState(42);
  const [sel,     setSel]     = useState("");
  const [runMsg,  setRunMsg]  = useState("");
  const [convId,  setConvId]  = useState("69db04786e1e12f6317e2274");
  const [msgs,    setMsgs]    = useState<ChatMsg[]>([
    { role:"agent", text:"Hi Jeremy — I am Agent Zero, your XPS intelligence operator. Ask me anything: leads, pipeline, secrets, automations.", ts:"now" }
  ]);
  const [input,   setInput]   = useState("");
  const [busy,    setBusy]    = useState(false);
  const [activity,setActivity]= useState([
    { time:"04:45 AM", label:"Superagent bridge connected", detail:"Base44 API live",         actor:"System" },
    { time:"04:30 AM", label:"Vault online",                detail:"35 projects accessible",  actor:"System" },
    { time:"04:21 AM", label:"Pipeline initialized",        detail:"XPS Arizona epoxy run",   actor:"Jeremy B" },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  const loadH = useCallback(async () => {
    try { setHealth(await (await fetch("/api/health")).json() as Health); }
    catch { setHealth({ status:"error" }); }
  }, []);
  const loadS = useCallback(async () => {
    try {
      const d = await (await fetch("/api/system-control")).json() as { system_state:SysState };
      setSys(d.system_state);
    } catch { /**/ }
  }, []);

  useEffect(() => {
    loadH(); loadS();
    const t = setInterval(() => { loadH(); loadS(); }, 20000);
    return () => clearInterval(t);
  }, [loadH, loadS]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  async function masterToggle(on:boolean) {
    await fetch("/api/system-control", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ master:on }) });
    await loadS();
    const t = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setActivity(p=>[{ time:t, label:on?"MASTER ON":"UNIVERSAL OFF", detail:on?"Schedules enabled":"All paused", actor:"Operator" },...p.slice(0,19)]);
  }
  async function toggleAction(id:string, val:boolean) {
    await fetch("/api/system-control", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:id, enabled:val }) });
    setSys(p=>({ ...p, actions:{ ...p.actions, [id]:val } }));
  }
  async function execAction(id:string) {
    if (!id) return;
    setRunMsg("Running " + id + "...");
    const d = await (await fetch("/api/system-control", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ trigger_now:id }) })).json() as { message?:string };
    const t  = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setActivity(p=>[{ time:t, label:"Manual: "+id, detail:d.message||"Queued", actor:"Operator" },...p.slice(0,19)]);
    setRunMsg(d.message||"Triggered"); setTimeout(()=>setRunMsg(""),5000);
    setPct(p=>Math.min(p+5,99));
  }
  async function sendChat() {
    const m = input.trim(); if (!m||busy) return;
    const t = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setMsgs(p=>[...p,{ role:"user", text:m, ts:t }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/superagent", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ message:m, conversation_id:convId, context:"XPS Dashboard — Jeremy Bensen" }) });
      const d = await r.json() as { ok:boolean; response?:string; conversation_id?:string; error?:string };
      if (d.conversation_id) setConvId(d.conversation_id);
      const t2 = new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
      setMsgs(p=>[...p,{ role:"agent", text:d.response||d.error||"No response", ts:t2 }]);
    } catch(e) {
      setMsgs(p=>[...p,{ role:"agent", text:"Error: "+String(e).slice(0,100), ts:t }]);
    }
    setBusy(false);
  }

  const checks = health.checks||{};
  const online = health.status==="ok";
  const sc     = online?"#4ade80":health.status==="loading"?"#fbbf24":"#f87171";

  /* shared card style */
  const card = { background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:12, padding:"18px 20px" } as React.CSSProperties;
  const label14 = { fontWeight:700, fontSize:14, color:"#fff", marginBottom:12 } as React.CSSProperties;

  /* ── ARIA chat view ── */
  const AriaView = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"24px 28px", gap:16 }}>
      <div>
        <div style={{ fontWeight:700, fontSize:20, color:"#fff" }}>ARIA — Superagent Chat</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginTop:4 }}>Direct line to your Base44 XPS Agent. Fully live.</div>
      </div>
      <div style={{ flex:1, ...card, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#4ade80" }} />
          <span style={{ fontWeight:600, fontSize:14, color:"#fff" }}>Agent Zero — XPS Intelligence Operator</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:"rgba(255,255,255,0.4)" }}>conv: {convId.slice(-8)}</span>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
          {msgs.map((m,i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"78%", padding:"10px 14px",
                borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
                background:m.role==="user"?"#2563eb":"rgba(255,255,255,0.1)",
                color:"#fff", fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                {m.text}
              </div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:3 }}>
                {m.role==="agent"?"ARIA":"You"} · {m.ts}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ display:"flex" }}>
              <div style={{ padding:"10px 14px", borderRadius:"12px 12px 12px 2px",
                background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", fontSize:13 }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.1)", display:"flex", gap:10 }}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
            placeholder="Ask Agent Zero anything..."
            style={{ flex:1, padding:"10px 14px", borderRadius:8,
              border:"1px solid rgba(255,255,255,0.2)", fontSize:13,
              background:"rgba(255,255,255,0.08)", color:"#fff",
              outline:"none" }} />
          <button onClick={sendChat} disabled={busy}
            style={{ padding:"10px 22px", borderRadius:8, border:"none",
              background:busy?"rgba(255,255,255,0.15)":"#2563eb",
              color:"#fff", fontWeight:700, cursor:busy?"not-allowed":"pointer", fontSize:13 }}>
            {busy?"...":"Send"}
          </button>
        </div>
      </div>
    </div>
  );

  /* ── MAIN dashboard view ── */
  const MainView = () => (
    <div style={{ overflowY:"auto", padding:"24px 28px", flex:1 }}>

      {/* action bar */}
      <div style={{ ...card, marginBottom:20, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)", fontWeight:600, whiteSpace:"nowrap" }}>Execute</span>
        <select value={sel} onChange={e=>setSel(e.target.value)}
          style={{ flex:1, minWidth:200, padding:"9px 14px", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.2)", fontSize:13,
            background:"rgba(255,255,255,0.08)", color:"#fff" }}>
          <option value="">-- Select automated action --</option>
          {ACTIONS.map(a=><option key={a.id} value={a.id} style={{ background:"#1e293b" }}>{a.label} — {a.desc}</option>)}
        </select>
        <button onClick={()=>execAction(sel)}
          style={{ padding:"9px 22px", borderRadius:8, border:"none",
            background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
          Run Now
        </button>
        <button onClick={()=>masterToggle(!sys.master)}
          style={{ padding:"9px 18px", borderRadius:8,
            border:"1px solid "+(sys.master?"#f87171":"#4ade80"),
            background:sys.master?"rgba(248,113,113,0.15)":"rgba(74,222,128,0.15)",
            color:sys.master?"#f87171":"#4ade80", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
          {sys.master?"MASTER OFF":"MASTER ON"}
        </button>
        <button onClick={()=>setNav("aria")}
          style={{ padding:"9px 18px", borderRadius:8, border:"none",
            background:"#7c3aed", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
          💬 Ask ARIA
        </button>
      </div>

      {runMsg && <div style={{ background:"rgba(37,99,235,0.2)", border:"1px solid rgba(37,99,235,0.4)", borderRadius:8, padding:"10px 16px", marginBottom:16, fontSize:13, color:"#93c5fd" }}>{runMsg}</div>}

      {/* pipeline */}
      <div style={{ ...card, marginBottom:20 }}>
        <div style={label14}>Pipeline Status</div>
        <div style={{ display:"flex", alignItems:"flex-start", overflowX:"auto" }}>
          {STEPS.map((s,i)=>(
            <div key={s.n} style={{ display:"flex", alignItems:"center", flex:1, minWidth:80 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                <div style={{ width:32, height:32, borderRadius:"50%",
                  background:s.s==="pending"?"rgba(255,255,255,0.1)":"#2563eb",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:s.s==="pending"?"rgba(255,255,255,0.35)":"#fff",
                  fontWeight:700, fontSize:13, flexShrink:0 }}>
                  {s.s==="done"?"✓":s.n}
                </div>
                <div style={{ fontSize:9, color:s.s==="pending"?"rgba(255,255,255,0.35)":"#fff",
                  fontWeight:s.s!=="pending"?600:400, textAlign:"center", marginTop:5, whiteSpace:"pre-line", lineHeight:1.3 }}>
                  {s.label}
                </div>
                <div style={{ fontSize:9, marginTop:2,
                  color:s.s==="done"?"#4ade80":s.s==="active"?"#60a5fa":"rgba(255,255,255,0.25)" }}>
                  {s.s==="done"?"Done":s.s==="active"?"Active":"Pending"}
                </div>
              </div>
              {i<STEPS.length-1 && <div style={{ height:2, background:s.s==="done"?"#2563eb":"rgba(255,255,255,0.1)", flex:0.5, marginBottom:28 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* 3-col */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18, marginBottom:18 }}>

        {/* source truth */}
        <div style={card}>
          <div style={label14}>Source Truth</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:10 }}>AZ Epoxy Registry Scan</div>
          {[["Leads Found","847"],["Companies","342"],["With Phone","187"],["With Email","124"],["A-Tier","34"]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", fontSize:12 }}>
              <span style={{ color:"rgba(255,255,255,0.55)" }}>{k}</span>
              <span style={{ fontWeight:700, color:"#fff" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* progress */}
        <div style={card}>
          <div style={label14}>Pipeline Progress</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <div style={{ width:80, height:80, borderRadius:"50%",
              background:"conic-gradient(#2563eb "+pct*3.6+"deg, rgba(255,255,255,0.1) 0deg)",
              display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
              <div style={{ width:60, height:60, borderRadius:"50%", background:"#0f172a",
                display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
                <span style={{ fontWeight:800, fontSize:18, color:"#fff" }}>{pct}%</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.45)" }}>Overall</span>
              </div>
            </div>
          </div>
          {[["Lead Scrape",checks.scrape?78:42,"#2563eb"],["AI Scoring",checks.groq?80:31,"#7c3aed"],["HubSpot Sync",60,"#0891b2"],["WA Brief",37,"#4ade80"]].map(([l,p,c])=>(
            <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7, fontSize:12 }}>
              <span style={{ width:110, color:"rgba(255,255,255,0.55)", flexShrink:0 }}>{l as string}</span>
              <PBar v={p as number} c={c as string} />
              <span style={{ width:30, textAlign:"right", fontWeight:700, color:"#fff" }}>{p}%</span>
            </div>
          ))}
        </div>

        {/* build targets */}
        <div style={card}>
          <div style={label14}>Build Targets</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { icon:"📁", label:"Drive Docs",   sub:"Business docs",   status:"Pending",    c:"#fbbf24" },
              { icon:"⬡",  label:"HubSpot CRM",  sub:"Lead pipeline",   status:"Pending",    c:"#a78bfa" },
              { icon:"☁",  label:"Vercel",        sub:"Next.js deploy",  status:"Live",       c:"#4ade80" },
              { icon:"🤖", label:"Superagent",    sub:"Base44 AI bridge",status:"Connected",  c:"#4ade80" },
            ].map(t=>(
              <div key={t.label} style={{ border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"12px", textAlign:"center", background:"rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{t.icon}</div>
                <div style={{ fontWeight:600, fontSize:12, color:"#fff" }}>{t.label}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", margin:"3px 0 5px" }}>{t.sub}</div>
                <div style={{ fontSize:10, color:t.c, fontWeight:700 }}>{t.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bottom row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:18 }}>

        {/* action toggles */}
        <div style={card}>
          <div style={label14}>Automated Actions</div>
          {ACTIONS.map(a=>(
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#fff" }}>{a.label}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{a.desc}</div>
              </div>
              <Toggle on={sys.actions?.[a.id]??false} onChange={v=>toggleAction(a.id,v)} />
            </div>
          ))}
        </div>

        {/* system health */}
        <div style={card}>
          <div style={label14}>System Health</div>
          {[
            ["AI Provider (Groq)",       checks.groq?100:0,   "#4ade80"],
            ["Database (Supabase)",      checks.supabase?100:0,"#4ade80"],
            ["Scrape Endpoint",          100,                   "#2563eb"],
            ["Superagent Bridge",        100,                   "#7c3aed"],
            ["Validator 30/30",          100,                   "#4ade80"],
            ["Vault API",                100,                   "#fbbf24"],
          ].map(([l,p,c])=>(
            <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, fontSize:12 }}>
              <span style={{ width:140, color:"rgba(255,255,255,0.55)", flexShrink:0 }}>{l as string}</span>
              <PBar v={p as number} c={c as string} />
              <span style={{ width:32, fontWeight:700, color:"#fff", textAlign:"right" }}>{p}%</span>
            </div>
          ))}
        </div>

        {/* approvals + activity */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div style={card}>
            <div style={label14}>Approval Gates</div>
            {[
              { label:"Production Deploy", status:"Approval Required",                   c:"#f97316" },
              { label:"Outreach Send",     status:sys.actions.outreach?"Approved":"Off", c:sys.actions.outreach?"#4ade80":"#94a3b8" },
              { label:"WhatsApp Brief",    status:sys.actions.whatsapp_brief?"Approved":"Off", c:sys.actions.whatsapp_brief?"#4ade80":"#94a3b8" },
              { label:"Lead Publish",      status:"Pending",                             c:"rgba(255,255,255,0.3)" },
            ].map(g=>(
              <div key={g.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", fontSize:12 }}>
                <span style={{ color:"rgba(255,255,255,0.55)" }}>{g.label}</span>
                <span style={{ color:g.c, fontWeight:700, fontSize:11 }}>{g.status}</span>
              </div>
            ))}
          </div>
          <div style={{ ...card, flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <span style={label14}>Activity Log</span>
              <span style={{ fontSize:12, color:"#60a5fa", cursor:"pointer" }}>View All</span>
            </div>
            {activity.slice(0,4).map((a,i)=>(
              <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", fontSize:11 }}>
                <span style={{ color:"rgba(255,255,255,0.3)", flexShrink:0, width:56 }}>{a.time}</span>
                <div>
                  <div style={{ fontWeight:600, color:"#fff" }}>{a.label}</div>
                  <div style={{ color:"rgba(255,255,255,0.45)" }}>{a.detail}</div>
                </div>
                <span style={{ marginLeft:"auto", color:"rgba(255,255,255,0.3)", flexShrink:0 }}>{a.actor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100vh", background:"#0f172a", fontFamily:"Inter,system-ui,sans-serif", color:"#fff", overflow:"hidden" }}>
      {/* sidebar */}
      <div style={{ width:210, background:"rgba(255,255,255,0.05)", borderRight:"1px solid rgba(255,255,255,0.08)", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, background:"#2563eb", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16 }}>X</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff" }}>Agent Zero</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>XPS Intelligence</div>
          </div>
        </div>
        <div style={{ padding:"10px 0", flex:1, overflowY:"auto" }}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setNav(item.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 20px",
                background:nav===item.id?"rgba(37,99,235,0.2)":"transparent",
                border:"none", cursor:"pointer",
                color:nav===item.id?"#60a5fa":"rgba(255,255,255,0.55)",
                fontWeight:nav===item.id?600:400, fontSize:13, textAlign:"left",
                borderLeft:nav===item.id?"3px solid #2563eb":"3px solid transparent" }}>
              <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div style={{ padding:"14px 20px", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:sc }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:600 }}>
              {online?"All systems operational":health.status}
            </span>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{health.version||"v8.0.0"}</div>
        </div>
      </div>

      {/* main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.08)",
          padding:"12px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <span style={{ fontWeight:700, fontSize:16, color:"#fff" }}>Command Dashboard</span>
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginLeft:10 }}>XPS Arizona Lead Pipeline</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:sc }} />
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{online?"Live":"Offline"}</span>
            </div>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"#2563eb",
              display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:13 }}>JB</div>
            <div>
              <div style={{ fontWeight:600, fontSize:13, color:"#fff" }}>Jeremy Bensen</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>Lead Operator</div>
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {nav==="aria" ? <AriaView /> : <MainView />}
        </div>
      </div>
    </div>
  );
}
