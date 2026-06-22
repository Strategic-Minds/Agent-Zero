"use client"
import { useEffect, useState, useCallback } from "react"

interface SysStatus { status: string; agents: string[]; database: { companies: number; memory_entries: number; agent_actions: number }; env: Record<string, boolean> }
interface Lead { id: string; company_name: string; phone: string; city: string; state: string; lead_score: number; priority_tier: string; status: string }

export default function Dashboard() {
  const [sys, setSys] = useState<SysStatus | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [tab, setTab] = useState<"leads"|"agents"|"config">("leads")
  const [msg, setMsg] = useState(""); const [resp, setResp] = useState(""); const [loading, setLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/aria", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({message:"Use system_status tool",channel:"web"}) })
      const d = await r.json()
      const statusMatch = d.response?.match(/operational|healthy/i)
      if (statusMatch) setSys({ status: "healthy", agents: ["ARIA v2","APEX v2","GHOST","DISCOVERY","OUTREACH","INTELLIGENCE"], database: { companies: 0, memory_entries: 0, agent_actions: 0 }, env: {} })
    } catch {}
    try {
      const r2 = await fetch("/api/health"); const d2 = await r2.json()
      setSys(s => s ? {...s, status: d2.status, env: d2.checks || {}} : { status: d2.status, agents: ["ARIA v2","APEX v2","GHOST","DISCOVERY","OUTREACH","INTELLIGENCE"], database: { companies: 0, memory_entries: 0, agent_actions: 0 }, env: d2.checks || {} })
    } catch {}
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const ask = async () => {
    if (!msg.trim() || loading) return
    setLoading(true); setResp("")
    try {
      const r = await fetch("/api/aria", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({message: msg, channel:"web"}) })
      const d = await r.json(); setResp(d.response || d.error || "No response"); setMsg("")
    } catch { setResp("Error") } finally { setLoading(false) }
  }

  const tc = (t: string) => ({S:"#e53e3e",A:"#dd6b20",B:"#d69e2e",C:"#38a169",D:"#718096"}[t]||"#718096")
  const online = sys?.status === "healthy"

  return (
    <div style={{fontFamily:"Inter,sans-serif",background:"#0a0a0a",minHeight:"100vh",color:"#e0e0e0",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#111",borderBottom:"1px solid #222",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#ff6b35,#f7931e)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚡</div>
          <div><div style={{fontSize:17,fontWeight:700,color:"#fff"}}>Agent Zero</div><div style={{fontSize:11,color:"#666"}}>XPS Intelligence Command Center</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:online?"#48bb78":"#fc8181"}}/>
          <span style={{fontSize:12,color:"#888"}}>{online?"All Systems Online":"Checking..."}</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#1a1a1a"}}>
        {[{l:"Leads",v:sys?.database?.companies??0,i:"🏢"},{l:"Memory",v:sys?.database?.memory_entries??0,i:"🧠"},{l:"Actions",v:sys?.database?.agent_actions??0,i:"📋"},{l:"Agents",v:6,i:"🤖"}].map(s=>(
          <div key={s.l} style={{background:"#111",padding:"16px 20px",textAlign:"center"}}>
            <div style={{fontSize:22}}>{s.i}</div>
            <div style={{fontSize:26,fontWeight:700,color:"#fff",marginTop:4}}>{s.v}</div>
            <div style={{fontSize:11,color:"#555"}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 380px",flex:1,overflow:"hidden"}}>
        <div style={{overflow:"auto",padding:20}}>
          <div style={{display:"flex",gap:4,marginBottom:20,background:"#111",borderRadius:8,padding:4,width:"fit-content"}}>
            {(["leads","agents","config"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 18px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,textTransform:"capitalize",background:tab===t?"#ff6b35":"transparent",color:tab===t?"#fff":"#777"}}>
                {t}
              </button>
            ))}
          </div>

          {tab==="agents" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {["ARIA v2.0 — 20 tools, memory, streaming","APEX v2.0 — site clone + code gen","GHOST — competitive intel","DISCOVERY — lead generation","OUTREACH — automated sequences","INTELLIGENCE — scoring + enrichment"].map(a=>(
                <div key={a} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontWeight:700,fontSize:14}}>{a.split("—")[0].trim()}</div>
                    <div style={{background:"#0d2e0d",color:"#48bb78",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>ONLINE</div>
                  </div>
                  <div style={{fontSize:12,color:"#555"}}>{a.split("—")[1]?.trim()}</div>
                </div>
              ))}
            </div>
          )}

          {tab==="leads" && (
            <div>
              {leads.length === 0 ? (
                <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:48,textAlign:"center"}}>
                  <div style={{fontSize:44,marginBottom:12}}>🏢</div>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:"#fff"}}>No leads in pipeline</div>
                  <div style={{color:"#555",marginBottom:20,fontSize:13}}>Ask ARIA to discover leads or import from CSV</div>
                  <button onClick={()=>{setMsg("Use db_query tool to get all companies from the companies table, ordered by lead_score");setTab("leads")}} style={{padding:"10px 20px",background:"#ff6b35",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600}}>
                    Load Leads →
                  </button>
                </div>
              ) : leads.map(l=>(
                <div key={l.id} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:"14px 18px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontWeight:600}}>{l.company_name}</div><div style={{fontSize:12,color:"#555"}}>{l.city}, {l.state} · {l.phone}</div></div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{background:tc(l.priority_tier),color:"#fff",padding:"2px 10px",borderRadius:4,fontSize:12,fontWeight:700}}>T{l.priority_tier}</div>
                    <div style={{fontWeight:600}}>{l.lead_score}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==="config" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {Object.entries(sys?.env||{}).map(([k,v])=>(
                <div key={k} style={{background:"#111",border:`1px solid ${v?"#1a2e1a":"#2e1a1a"}`,borderRadius:8,padding:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"#888"}}>{k.replace(/_/g," ")}</span>
                  <span style={{color:v?"#48bb78":"#fc8181",fontWeight:700,fontSize:13}}>{v?"✅":"❌"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{borderLeft:"1px solid #1a1a1a",display:"flex",flexDirection:"column",background:"#080808"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #151515",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,background:"linear-gradient(135deg,#ff6b35,#f7931e)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🤖</div>
            <div><div style={{fontSize:14,fontWeight:700}}>ARIA</div><div style={{fontSize:10,color:"#48bb78"}}>● Online · 20 tools active</div></div>
          </div>
          <div style={{flex:1,overflow:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{background:"#111",borderRadius:8,padding:12,fontSize:13,color:"#888",lineHeight:1.6}}>Hey Jeremy 👋 I'm ARIA v2.0. I have 20 real tools — ask me anything about your leads, pipeline, competitors, or system.</div>
            {resp && <div style={{background:"#111",borderRadius:8,padding:12,fontSize:13,color:"#e0e0e0",whiteSpace:"pre-wrap",lineHeight:1.6}}>{resp}</div>}
            {loading && <div style={{background:"#111",borderRadius:8,padding:12,fontSize:13,color:"#555"}}>ARIA thinking...</div>}
          </div>
          <div style={{padding:14,borderTop:"1px solid #151515"}}>
            <div style={{display:"flex",gap:8}}>
              <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask ARIA anything..." style={{flex:1,background:"#111",border:"1px solid #2a2a2a",borderRadius:8,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none"}}/>
              <button onClick={ask} disabled={loading||!msg.trim()} style={{padding:"10px 14px",background:loading?"#222":"#ff6b35",color:"#fff",border:"none",borderRadius:8,cursor:loading?"not-allowed":"pointer",fontSize:15}}>→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
void leads
void fetchStatus
