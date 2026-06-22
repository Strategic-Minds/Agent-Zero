export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#33475b] text-white">
      <div className="text-center max-w-2xl px-8">
        <div className="text-6xl mb-6">⚡</div>
        <h1 className="text-4xl font-bold mb-4">Agent-Zero</h1>
        <p className="text-xl text-gray-300 mb-2">AI Super Orchestrator</p>
        <p className="text-sm text-gray-400 mb-8">Strategic Minds Advisory</p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-[#ff7a59] font-bold text-lg">ARIA</div>
            <div className="text-gray-300">Chief Orchestrator</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-[#0091ae] font-bold text-lg">XPS</div>
            <div className="text-gray-300">Lead Engine</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-green-400 font-bold text-lg">24/7</div>
            <div className="text-gray-300">Autonomous</div>
          </div>
        </div>
        <div className="mt-8 text-xs text-gray-500">
          Status: Operational · v1.0.0
        </div>
      </div>
    </main>
  )
}
