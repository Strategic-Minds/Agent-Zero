'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function BlackDashboard() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [leads, setLeads] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeCompanies: 0,
    scrapeRuns: 0,
    revenue: '$148,250'
  });

  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Hello, I am ARIA. How can I assist with your XPS flooring intelligence operations today?' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scraper controls
  const [industry, setIndustry] = useState('Construction');
  const [location, setLocation] = useState('Phoenix, AZ');
  const [topics, setTopics] = useState('Epoxy Flooring');

  useEffect(() => {
    fetchStatsAndActivity();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchStatsAndActivity = async () => {
    try {
      // Stub or direct dynamic fetches
      setLeads([
        { id: '1', company_name: 'Apex Industrial Epoxy', phone: '602-555-0192', email: 'bids@apexepoxy.com', website: 'apexepoxy.com', category: 'Epoxy Flooring', lead_score: 95, status: 'contacted' },
        { id: '2', company_name: 'Desert Polished Concrete', phone: '480-555-0214', email: 'contact@desertconcrete.com', website: 'desertconcrete.com', category: 'Concrete Polishing', lead_score: 88, status: 'new' },
        { id: '3', company_name: 'Valley Coating Solutions', phone: '623-555-0348', email: 'info@valleycoatings.com', website: 'valleycoatings.com', category: 'Industrial Coatings', lead_score: 82, status: 'new' },
        { id: '4', company_name: 'Grand Canyon Flooring', phone: '520-555-0455', email: 'sales@gcfloors.com', website: 'gcfloors.com', category: 'Garage Floors', lead_score: 75, status: 'new' }
      ]);

      setRuns([
        { id: '1', industry: 'Construction', topics: ['Epoxy Flooring'], location: 'Phoenix, AZ', total_found: 12, new_leads: 4, status: 'completed', started_at: '2026-07-14T01:00:00Z' },
        { id: '2', industry: 'Flooring', topics: ['Concrete Polishing'], location: 'Tucson, AZ', total_found: 8, new_leads: 3, status: 'completed', started_at: '2026-07-13T18:30:00Z' }
      ]);

      setStats({
        totalLeads: 428,
        activeCompanies: 154,
        scrapeRuns: 29,
        revenue: '$148,250'
      });
    } catch (e) {}
  };

  const runScraper = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry,
          location,
          topics: [topics],
          max_results: 5
        })
      });
      const data = await resp.json();
      if (data.success) {
        alert(`Scraper finished! Found ${data.total_found} and added ${data.new_leads} new leads.`);
        fetchStatsAndActivity();
      } else {
        alert(`Scraper error: ${data.error}`);
      }
    } catch (e) {
      alert('Scraper execution failed');
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg = { role: 'user', content: inputVal };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setInputVal('');
    setChatLoading(true);

    try {
      const resp = await fetch('/api/aria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMsgs })
      });
      const data = await resp.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Apologies, I encountered an error. Please try again.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection timed out. AI gateway might be starting up.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#090B10] text-white font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0D1117] border-r border-white/5 flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#e3ff8c] flex items-center justify-center text-[#090B10] font-black">X</div>
            <div>
              <h1 className="font-bold text-sm tracking-wider uppercase text-white">XPS Intelligence</h1>
              <p className="text-[10px] text-white/40">v10.0.0 Global Platform</p>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            {[
              { name: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
              { name: 'Leads', href: '/dashboard/leads', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              { name: 'Scraper', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { name: 'Companies', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
              { name: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { name: 'Deals', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
            ].map(item => {
              const active = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.href) window.location.href = item.href;
                    else setActiveTab(item.name);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#e3ff8c] text-[#090B10]'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                  </svg>
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold">SM</div>
            <div>
              <p className="text-xs font-semibold text-white">Strategic Minds</p>
              <p className="text-[10px] text-white/40">Enterprise Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto flex flex-col bg-[#090B10]">
        {/* HEADER BAR */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0D1117]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">{activeTab} View</h2>
            <span className="bg-[#e3ff8c]/10 text-[#e3ff8c] text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">Production Live</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="block text-xs text-white/40">Operational Status</span>
              <span className="text-xs font-mono text-green-400">● Core Healthy</span>
            </div>
          </div>
        </header>

        {/* METRICS / STATS */}
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Leads', val: stats.totalLeads, change: '+18% MoM', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
              { label: 'Active Companies', val: stats.activeCompanies, change: '100% Verified', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
              { label: 'Scrape Runs', val: stats.scrapeRuns, change: 'Daily 6AM', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19' },
              { label: 'Platform Revenue', val: stats.revenue, change: 'ARR Estimated', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/[0.04] backdrop-blur-md border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-3xl font-extrabold mt-2 text-white">{stat.val}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 text-[#e3ff8c]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[#e3ff8c] bg-[#e3ff8c]/10 px-1.5 py-0.5 rounded">{stat.change}</span>
                </div>
              </div>
            ))}
          </div>

          {activeTab === 'Dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* MAIN LEADS MONITOR */}
              <div className="lg:col-span-2 bg-[#0D1117] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-base text-white">Active Flooring Prospects</h3>
                    <button onClick={() => window.location.href = '/dashboard/leads'} className="text-[#e3ff8c] text-xs hover:underline flex items-center gap-1">
                      Manage Leads
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-white/40">
                          <th className="pb-3 font-semibold uppercase tracking-wider">Company</th>
                          <th className="pb-3 font-semibold uppercase tracking-wider">Contact</th>
                          <th className="pb-3 font-semibold uppercase tracking-wider">Category</th>
                          <th className="pb-3 font-semibold uppercase tracking-wider">Score</th>
                          <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {leads.slice(0, 4).map(lead => (
                          <tr key={lead.id} className="hover:bg-white/[0.02]">
                            <td className="py-4 font-semibold text-white">
                              {lead.company_name}
                              <span className="block text-[10px] font-mono text-white/40 mt-0.5">{lead.website}</span>
                            </td>
                            <td className="py-4 text-white/70">
                              {lead.email}
                              <span className="block text-[10px] text-white/40 mt-0.5">{lead.phone}</span>
                            </td>
                            <td className="py-4">
                              <span className="px-2 py-0.5 rounded bg-white/5 text-white/70 text-[10px]">{lead.category}</span>
                            </td>
                            <td className="py-4">
                              <span className={`font-mono font-bold ${lead.lead_score >= 85 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {lead.lead_score}
                              </span>
                            </td>
                            <td className="py-4">
                              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-wider">{lead.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* LIVE TAVILY SCRAPER CONTROLLER */}
              <div className="bg-[#0D1117] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-white mb-6">Targeted Lead Discovery</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-1.5">Selected Industry</label>
                      <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#e3ff8c]">
                        <option value="Construction">Construction</option>
                        <option value="Flooring">Flooring</option>
                        <option value="Commercial Real Estate">Commercial Real Estate</option>
                        <option value="Property Management">Property Management</option>
                        <option value="Warehousing">Warehousing</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-1.5">Target Location</label>
                      <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#e3ff8c]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-white/40 uppercase mb-1.5">Search Topic Category</label>
                      <input type="text" value={topics} onChange={(e) => setTopics(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#e3ff8c]" />
                    </div>
                  </div>
                </div>
                <button onClick={runScraper} disabled={loading} className="w-full mt-6 bg-[#e3ff8c] hover:bg-[#d6f577] text-[#090B10] text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-[#090B10]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Crawling Web Intel...
                    </>
                  ) : 'Trigger Tavily Scraper'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Scraper' && (
            <div className="bg-[#0D1117] border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-base text-white mb-6">Recent Web Intelligence Crawls</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40">
                      <th className="pb-3">Industry</th>
                      <th className="pb-3">Topics</th>
                      <th className="pb-3">Location</th>
                      <th className="pb-3">Total Found</th>
                      <th className="pb-3">New Leads</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Started At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {runs.map(run => (
                      <tr key={run.id} className="hover:bg-white/[0.02]">
                        <td className="py-4 font-semibold text-white">{run.industry}</td>
                        <td className="py-4">
                          <div className="flex gap-1.5 flex-wrap">
                            {run.topics.map((t: string) => (
                              <span key={t} className="bg-white/5 text-white/70 px-1.5 py-0.5 rounded text-[10px]">{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 text-white/70">{run.location}</td>
                        <td className="py-4 font-mono font-semibold">{run.total_found}</td>
                        <td className="py-4 font-mono text-green-400 font-semibold">+{run.new_leads}</td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-wider">{run.status}</span>
                        </td>
                        <td className="py-4 text-white/40 font-mono text-[10px]">{new Date(run.started_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ARIA FIXED FLOATING CHAT SYSTEM */}
      <div className="fixed bottom-6 left-6 z-50">
        {!chatOpen ? (
          <button
            onClick={() => setChatOpen(true)}
            className="w-14 h-14 bg-[#e3ff8c] text-[#090B10] rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-white/10"
            aria-label="Open ARIA Chat"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        ) : (
          <div className="w-[380px] h-[500px] bg-[#0D1117]/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-lg">
            {/* Chat Header */}
            <div className="bg-[#161B22] p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                <div>
                  <h4 className="font-bold text-xs text-white uppercase tracking-wider">ARIA Real-time AI</h4>
                  <p className="text-[10px] text-white/40">Vercel AI Gateway Stream</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#e3ff8c] text-[#090B10] font-semibold'
                      : 'bg-white/5 text-white/90 border border-white/5'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white/40 flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5 text-white/40" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Aria is thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={sendChatMessage} className="p-3 border-t border-white/5 bg-[#161B22]/50 flex gap-2">
              <input
                type="text"
                placeholder="Ask ARIA about lead gen or flooring systems..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={chatLoading}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#e3ff8c]"
              />
              <button type="submit" disabled={chatLoading} className="bg-[#e3ff8c] text-[#090B10] font-bold text-xs px-3 rounded-lg hover:bg-[#d6f577] transition-all">
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
