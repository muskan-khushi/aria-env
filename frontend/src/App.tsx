export default function App() {
  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      {/* Our master container */}
      <div className="w-full max-w-7xl glass-panel p-6 shadow-glass-inset border-2 border-white/40">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-white/30">
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2">
            <span className="font-bold text-aria-accent">❖</span> ARIA
          </h1>
          <nav className="flex gap-6 text-sm font-medium text-aria-textMuted">
            <span className="text-aria-textMain cursor-pointer">Dashboard</span>
            <span className="cursor-pointer hover:text-aria-textMain transition">Environment</span>
            <span className="cursor-pointer hover:text-aria-textMain transition">Runs</span>
          </nav>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-12 gap-6 h-[650px]">
          
          {/* Left Column: Document Viewer */}
          <div className="col-span-3 glass-panel p-4 flex flex-col shadow-sm">
            <h2 className="text-sm font-semibold text-aria-textMuted uppercase tracking-wider mb-4">Legal Document</h2>
            <div className="flex-1 bg-white/30 rounded-xl p-4 border border-white/50 overflow-y-auto">
              <p className="text-xs opacity-70">Document content will load here...</p>
            </div>
          </div>

          {/* Center Column: Charts & Agent Stream */}
          <div className="col-span-5 flex flex-col gap-6">
            <div className="glass-panel p-4 flex-1 shadow-sm">
               <h2 className="text-sm font-semibold text-aria-textMuted uppercase tracking-wider mb-4">Performance Overview</h2>
            </div>
            <div className="glass-panel p-4 flex-[0.7] shadow-sm">
               <h2 className="text-sm font-semibold text-aria-textMuted uppercase tracking-wider mb-4">Agent Thought Process</h2>
            </div>
          </div>

           {/* Right Column: Findings Panel */}
           <div className="col-span-4 glass-panel p-4 shadow-sm flex flex-col">
             <h2 className="text-sm font-semibold text-aria-textMuted uppercase tracking-wider mb-4">Audit Findings</h2>
             <div className="flex-1 bg-white/20 rounded-xl p-4 border border-white/40 overflow-y-auto">
              <p className="text-xs opacity-70">Findings will appear here...</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
