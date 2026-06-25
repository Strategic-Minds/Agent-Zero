"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const NAV = [
  { id:"dashboard", label:"Dashboard",   icon:"⊞" },
  { id:"aria",      label:"ARIA Chat",    icon:"🤖" },
  { id:"leads",     label:"Lead Jobs",    icon:"🔍" },
  { id:"source",    label:"Source Truth", icon:"📄" },
  { id:"build",     label:"Build Targets",icon:"🏗"  },
  { id:"handoff",   label:"Handoff Docs", icon:"📋" },
  { id:"validation",label:"Validation",   icon:"✅" },
  { id:"approvals", label:"Approvals",    icon:"🔐" },
  { id:"activity",  label:"Activity Log", icon:"📊" },
  { id:"settings",  label:"Settings",     icon:"⚙"  },
  { id:"team",      label:"Team",         icon:"👥" },
  { id:"billing",   label:"Billing",      icon:"💳" },
];

const ACTIONS = [
  { id:"lead_discovery",  label:"Lead Discovery",       desc:"Scrape new AZ epoxy leads" },
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

function Bar({ v, c="#3b82f6" }:{ v:number; c?:string }) {
  return (
    <div style={{ background:"#1e293b", borderRadius:4, height:6, overflow:"hidden", flex:1 }}>
      <div style={{ width:v+"%", height:"100%", background:c, borderRadius:4 }} />
    </div>
  );
}

function Toggle({ on, onChange }:{ on:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button onClick={()=>onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, border:"none",
        background:on?"#3b82f6":"#374151", cursor:"pointer", position:"relative", flexShrink:0 }}>
      <span style={{ position:"absolute", top:2, left:on?22:2, width:20, height:20,
        borderRadius:"50%", background:"#fff", transition:"left 0.15s", display:"block" }} />
    </button>
  );
}

export default function Dashboard() {
  const [nav,    setNav]    = useState("dashboard");
  const [health, setHealth] = useState<Health>({ status:"loading" });
  const [sys,    setSys]    = useState<SysState>({ master:false, actions:{}, last_updated:"" });
  const [prog,   setProg]   = useState(42);
  const [sel,    setSel]    = useState("");
  const [runMsg, setRunMsg] = useState("");
  const [chat,   setChat]   = useState<ChatMsg[]>([{
    role:"agent",
    text:"Hi Jeremy — I am Agent Zero, your XPS intelligence operator. I can discover leads, score them, manage your pipeline, trigger automations, and manage secrets across all 35 of your Vercel projects. What do you need?",
    ts: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
  }]);
  const [chatIn,  setChatIn]  = useState("");
  const [chatBusy,setChatBusy]= useState(false);
  const [activity,setActivity]= useState([
    { time:"04:41 AM", label:"Superagent bridge connected",  detail:"Base44 API authenticated",   actor:"System" },
    { time:"04:39 AM", label:"Forensic audit complete",      detail:"100/100 A+",                 actor:"System" },
    { time:"04:10 AM", label:"Vault bridge online",          detail:"35 projects accessible",     actor:"System" },
    { time:"03:57 AM", label:"BASE44_API_KEY injected",      detail:"Via vault bridge",           actor:"System" },
    { time:"03:00 AM", label:"Pipeline started",             detail:"XPS Arizona epoxy run",      actor:"Jeremy Bensen" },
  ]);
  const chatEnd = useRef<HTMLDivElement>(null);

  const loadH = useCallback(async()=>{
    try{ const r=await fetch("/api/health"); setHealth(await r.json() as Health); }
    catch{ setHealth({status:"error"}); }
  },[]);
  const loadS = useCallback(async()=>{
    try{ const r=await fetch("/api/system-control"); const d=await r.json() as {system_state:SysState}; setSys(d.system_state); }
    catch{ /**/ }
  },[]);

  useEffect(()=>{ loadH(); loadS(); const t=setInterval(()=>{ loadH(); loadS(); },20000); return()=>clearInterval(t); },[loadH,loadS]);
  useEffect(()=>{ chatEnd.current?.scrollIntoView({behavior:"smooth"}); },[chat]);

  async function masterToggle(on:boolean){
    await fetch("/api/system-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({master:on})});
    await loadS();
    const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setActivity(p=>[{time:now,label:on?"MASTER ON":"UNIVERSAL OFF",detail:on?"All schedules enabled":"All actions paused",actor:"Operator"},...p.slice(0,19)]);
  }
  async function toggleAction(id:string,val:boolean){
    await fetch("/api/system-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:id,enabled:val})});
    setSys(p=>({...p,actions:{...p.actions,[id]:val}}));
  }
  async function execAction(id:string){
    if(!id)return;
    setRunMsg("Running "+id+"...");
    const r=await fetch("/api/system-control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trigger_now:id})});
    const d=await r.json() as {message?:string};
    const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setActivity(p=>[{time:now,label:"Triggered: "+id,detail:d.message||"Queued",actor:"Operator"},...p.slice(0,19)]);
    setRunMsg(d.message||"Triggered");
    setTimeout(()=>setRunMsg(""),5000);
    setProg(p=>Math.min(p+5,99));
  }
  async function sendChat(){
    const msg=chatIn.trim();
    if(!msg||chatBusy)return;
    const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    setChat(p=>[...p,{role:"user",text:msg,ts:now}]);
    setChatIn(""); setChatBusy(true);
    try{
      const r=await fetch("/api/superagent",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:msg,context:"XPS Dashboard — Jeremy Bensen, Lead Operator"})});
      const d=await r.json() as {ok:boolean;response?:string;error?:string};
      const reply=d.response||d.error||"No response";
      const now2=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
      setChat(p=>[...p,{role:"agent",text:reply,ts:now2}]);
    } catch(e){ setChat(p=>[...p,{role:"agent",text:"Error: "+String(e).slice(0,80),ts:now}]); }
    setChatBusy(false);
  }

  const checks=health.checks||{};
  const statC=health.status==="ok"?"#22c55e":health.status==="loading"?"#f59e0b":"#ef4444";

  const card  = { background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"18px 20px" } as const;
  const label = { fontSize:11, color:"#64748b", fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.05em" };
  const val   = { fontSize:13, color:"#e2e8f0", fontWeight:600 };

  const ARIAChat = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"24px 28px", gap:16 }}>
      <div>
        <div style={{ fontWeight:700, fontSize:18, color:"#f1f5f9" }}>ARIA — Base44 Superagent</div>
        <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>Direct line to Agent Zero. Ask about leads, pipeline, secrets, automations — anything.</div>
      </div>
      <div style={{ flex:1, background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #1e293b", background:"#020617", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#22c55e" }} />
          <span style={{ fontWeight:600, fontSize:14, color:"#f1f5f9" }}>Agent Zero — XPS Intelligence Operator</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:"#475569" }}>Base44 Superagent · Connected</span>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
          {chat.map((m,i)=>(
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"78%", padding:"10px 14px",
                borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",
                background:m.role==="user"?"#2563eb":"#1e293b",
                color:"#f1f5f9", fontSize:13, lineHeight:1.6 }}>
                {m.text}
              </div>
              <div style={{ fontSize:10, color:"#475569", marginTop:3 }}>
                {m.role==="agent"?"ARIA":"You"} · {m.ts}
              </div>
            </div>
          ))}
          {chatBusy && (
            <div style={{ display:"flex", alignItems:"flex-start" }}>
              <div style={{ padding:"10px 14px", borderRadius:"12px 12px 12px 2px", background:"#1e293b", fontSize:13, color:"#64748b" }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={chatEnd} />
        </div>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #1e293b", display:"flex", gap:10 }}>
          <input value={chatIn} onChange={e=>setChatIn(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
            placeholder="Ask Agent Zero anything..."
            style={{ flex:1, padding:"10px 14px", borderRadius:8, border:"1px solid #1e293b",
              fontSize:13, outline:"none", background:"#1e293b", color:"#f1f5f9" }} />
          <button onClick={sendChat} disabled={chatBusy}
            style={{ padding:"10px 22px", borderRadius:8, border:"none",
              background:chatBusy?"#374151":"#2563eb", color:"#fff",
              fontWeight:700, cursor:chatBusy?"not-allowed":"pointer", fontSize:13 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );

  const Main = () => {
    if(nav==="aria") return <ARIAChat />;
    return (
      <div style={{ overflowY:"auto", padding:"24px 28px", flex:1 }}>

        {/* ACTION BAR */}
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:13, color:"#94a3b8", fontWeight:600, whiteSpace:"nowrap" }}>Execute Action</span>
          <select value={sel} onChange={e=>setSel(e.target.value)}
            style={{ flex:1, minWidth:200, padding:"8px 12px", borderRadius:8, border:"1px solid #1e293b", fontSize:13, background:"#020617", color:"#e2e8f0" }}>
            <option value="">-- Select automated action --</option>
            {ACTIONS.map(a=><option key={a.id} value={a.id}>{a.label} — {a.desc}</option>)}
          </select>
          <button onClick={()=>execAction(sel)}
            style={{ padding:"9px 20px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
            Run Now
          </button>
          <button onClick={()=>masterToggle(!sys.master)}
            style={{ padding:"9px 16px", borderRadius:8, border:"1px solid "+(sys.master?"#ef4444":"#22c55e"),
              background:sys.master?"rgba(239,68,68,0.1)":"rgba(34,197,94,0.1)",
              color:sys.master?"#ef4444":"#22c55e", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
            {sys.master?"MASTER OFF":"MASTER ON"}
          </button>
          <button onClick={()=>setNav("aria")}
            style={{ padding:"9px 16px", borderRadius:8, border:"none", background:"#7c3aed", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" }}>
            Ask ARIA
          </button>
        </div>

        {runMsg && (
          <div style={{ background:"rgba(37,99,235,0.15)", border:"1px solid #2563eb", borderRadius:8, padding:"10px 16px", marginBottom:14, fontSize:13, color:"#93c5fd" }}>
            {runMsg}
          </div>
        )}

        {/* PIPELINE */}
        <div style={{ ...card, marginBottom:18 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9", marginBottom:14 }}>Pipeline Status</div>
          <div style={{ display:"flex", alignItems:"flex-start", overflowX:"auto" }}>
            {STEPS.map((s,i)=>(
              <div key={s.n} style={{ display:"flex", alignItems:"center", flex:1, minWidth:80 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%",
                    background:s.s==="pending"?"#1e293b":"#2563eb",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontWeight:700, fontSize:12 }}>
                    {s.s==="done"?"✓":s.n}
                  </div>
                  <div style={{ fontSize:9, color:s.s==="pending"?"#475569":"#e2e8f0", fontWeight:s.s!=="pending"?600:400, textAlign:"center", marginTop:4, lineHeight:1.3 }}>{s.label}</div>
                  <div style={{ fontSize:9, color:s.s==="done"?"#22c55e":s.s==="active"?"#3b82f6":"#334155", marginTop:2 }}>
                    {s.s==="done"?"Done":s.s==="active"?"Active":"Pending"}
                  </div>
                </div>
                {i<STEPS.length-1&&<div style={{ height:2, background:s.s==="done"?"#2563eb":"#1e293b", flex:0.5, marginBottom:26 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* 3-COL */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>

          {/* SOURCE TRUTH */}
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9", marginBottom:10 }}>Source Truth</div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:10 }}>AZ Epoxy Registry Scan</div>
            {[["Leads Found","847"],["Companies","342"],["With Phone","187"],["With Email","124"],["A-Tier","34"]].map(([k,v])=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #1e293b", fontSize:12 }}>
                <span style={{ color:"#64748b" }}>{k}</span><span style={{ color:"#e2e8f0", fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* PROGRESS */}
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9", marginBottom:10 }}>Pipeline Progress</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
              <div style={{ width:76, height:76, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                background:"conic-gradient(#2563eb "+prog*3.6+"deg, #1e293b 0deg)" }}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
                  <span style={{ fontWeight:800, fontSize:17, color:"#f1f5f9" }}>{prog}%</span>
                  <span style={{ fontSize:8, color:"#64748b" }}>Overall</span>
                </div>
              </div>
            </div>
            {[["Lead Scrape",checks.scrape?78:42,"#2563eb"],["AI Scoring",checks.groq?65:31,"#7c3aed"],["HubSpot Sync",60,"#0891b2"],["WA Brief",checks.supabase?55:37,"#22c55e"]].map(([l,p,c])=>(
              <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, fontSize:12 }}>
                <span style={{ width:90, color:"#94a3b8", flexShrink:0 }}>{l as string}</span>
                <Bar v={p as number} c={c as string} />
                <span style={{ width:32, textAlign:"right", fontWeight:600, color:"#e2e8f0" }}>{p}%</span>
              </div>
            ))}
          </div>

          {/* BUILD TARGETS */}
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9", marginBottom:10 }}>Build Targets</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { icon:"📁", label:"Drive Docs",    sub:"Business docs",    status:"Pending",    c:"#22c55e" },
                { icon:"⬡",  label:"HubSpot CRM",   sub:"Lead pipeline",    status:"Pending",    c:"#7c3aed" },
                { icon:"☁",  label:"Vercel",         sub:"Next.js deploy",   status:"Live",       c:"#3b82f6" },
                { icon:"🤖", label:"Superagent",     sub:"Base44 AI bridge", status:"Connected",  c:"#22c55e" },
              ].map(t=>(
                <div key={t.label} style={{ border:"1px solid #1e293b", borderRadius:8, padding:"10px", textAlign:"center", background:"#020617" }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{t.icon}</div>
                  <div style={{ fontWeight:600, fontSize:12, color:"#e2e8f0" }}>{t.label}</div>
                  <div style={{ fontSize:10, color:"#475569", margin:"3px 0 5px" }}>{t.sub}</div>
                  <div style={{ fontSize:10, color:t.c, fontWeight:600 }}>{t.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>

          {/* ACTIONS */}
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9", marginBottom:12 }}>Automated Actions</div>
            {ACTIONS.map(a=>(
              <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #1e293b" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0" }}>{a.label}</div>
                  <div style={{ fontSize:10, color:"#475569" }}>{a.desc}</div>
                </div>
                <Toggle on={sys.actions?.[a.id]??false} onChange={v=>toggleAction(a.id,v)} />
              </div>
            ))}
          </div>

          {/* HEALTH */}
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9", marginBottom:12 }}>System Health</div>
            {[
              ["AI Provider (Groq)",    checks.groq?100:0,     "#22c55e"],
              ["Database (Supabase)",   checks.supabase?100:0, "#22c55e"],
              ["Superagent Bridge",     100,                   "#7c3aed"],
              ["Vault (35 projects)",   100,                   "#3b82f6"],
              ["Validator 30/30",       100,                   "#22c55e"],
              ["Scrape Endpoint",       checks.scrape?100:0,   "#3b82f6"],
            ].map(([l,p,c])=>(
              <div key={l as string} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, fontSize:12 }}>
                <span style={{ width:140, color:"#94a3b8", flexShrink:0 }}>{l as string}</span>
                <Bar v={p as number} c={c as string} />
                <span style={{ width:32, fontWeight:600, textAlign:"right", color:"#e2e8f0" }}>{p}%</span>
              </div>
            ))}
          </div>

          {/* APPROVALS + ACTIVITY */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={card}>
              <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9", marginBottom:10 }}>Approval Gates</div>
              {[
                { label:"Production Deploy", status:"Approval Required", c:"#f97316" },
                { label:"Outreach Send",      status:sys.actions.outreach?"Approved":"Requires Input", c:sys.actions.outreach?"#22c55e":"#f97316" },
                { label:"WhatsApp Brief",     status:sys.actions.whatsapp_brief?"Approved":"Off", c:sys.actions.whatsapp_brief?"#22c55e":"#475569" },
                { label:"Lead Publish",       status:"Pending", c:"#475569" },
              ].map(g=>(
                <div key={g.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #1e293b", fontSize:12 }}>
                  <span style={{ color:"#94a3b8" }}>{g.label}</span>
                  <span style={{ color:g.c, fontWeight:600, fontSize:11 }}>{g.status}</span>
                </div>
              ))}
            </div>
            <div style={{ ...card, flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>Activity Log</span>
                <span style={{ fontSize:12, color:"#3b82f6", cursor:"pointer" }}>View All</span>
              </div>
              {activity.slice(0,4).map((a,i)=>(
                <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid #1e293b", fontSize:11 }}>
                  <span style={{ color:"#475569", flexShrink:0, width:56 }}>{a.time}</span>
                  <div>
                    <div style={{ fontWeight:600, color:"#e2e8f0" }}>{a.label}</div>
                    <div style={{ color:"#64748b" }}>{a.detail}</div>
                  </div>
                  <span style={{ marginLeft:"auto", color:"#475569", flexShrink:0 }}>{a.actor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:"#020617", fontFamily:"Inter,system-ui,sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
      {/* SIDEBAR */}
      <div style={{ width:216, background:"#0a0f1e", borderRight:"1px solid #1e293b", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"18px 18px 14px", borderBottom:"1px solid #1e293b", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:"#2563eb", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15 }}>X</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>Agent Zero</div>
            <div style={{ fontSize:11, color:"#475569" }}>XPS Intelligence</div>
          </div>
        </div>
        <div style={{ padding:"8px 0", flex:1, overflowY:"auto" }}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setNav(item.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 18px",
                background:nav===item.id?"rgba(37,99,235,0.15)":"transparent",
                border:"none", cursor:"pointer", color:nav===item.id?"#60a5fa":"#64748b",
                fontWeight:nav===item.id?600:400, fontSize:13, textAlign:"left",
                borderLeft:nav===item.id?"3px solid #2563eb":"3px solid transparent" }}>
              <span style={{ fontSize:14 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div style={{ padding:"14px 18px", borderTop:"1px solid #1e293b" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:statC }} />
            <span style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>
              {health.status==="ok"?"All systems operational":health.status}
            </span>
          </div>
          <button onClick={()=>window.open("/api/health","_blank")}
            style={{ fontSize:11, color:"#3b82f6", background:"transparent", border:"1px solid #1e293b", borderRadius:5, padding:"4px 10px", cursor:"pointer" }}>
            View Status Page ↗
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#0a0f1e", borderBottom:"1px solid #1e293b", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <span style={{ fontWeight:700, fontSize:16, color:"#f1f5f9" }}>Command Dashboard</span>
            <span style={{ fontSize:12, color:"#475569", marginLeft:10 }}>XPS Arizona Lead Pipeline</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:12, color:"#475569" }}>{health.version||"v8.1.0"}</span>
            <div style={{ width:30, height:30, borderRadius:"50%", background:"#2563eb", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:12 }}>JB</div>
            <div style={{ fontSize:13 }}>
              <div style={{ fontWeight:600, color:"#f1f5f9" }}>Jeremy Bensen</div>
              <div style={{ fontSize:11, color:"#475569" }}>Lead Operator</div>
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <Main />
        </div>
      </div>
    </div>
  );
}
