export default function App() {
  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      {/* Our master container - ditching the heavy borders for a clean shadow */}
      <div className="w-full max-w-7xl matte-panel p-8">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-aria-border">
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-2 text-aria-textMain">
            {/* Swapped to a sharper icon to match the matte vibe */}
            <span className="font-bold text-aria-accent">▲</span> ARIA
          </h1>
          <nav className="flex gap-6 text-sm font-semibold text-aria-textMuted uppercase tracking-wider">
            <span className="text-aria-accent border-b-2 border-aria-accent pb-1 cursor-pointer">Dashboard</span>
            <span className="cursor-pointer hover:text-aria-textMain transition pb-1">Environment</span>
            <span className="cursor-pointer hover:text-aria-textMain transition pb-1">Runs</span>
          </nav>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-12 gap-6 h-[650px]">
          
          {/* Left Column: Document Viewer */}
          <div className="col-span-3 flex flex-col gap-3">
            <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Legal Document</h2>
            <div className="flex-1 matte-panel p-5 overflow-y-auto">
              <div className="w-16 h-1 bg-aria-accentLight rounded-full mb-4"></div>
              <p className="text-sm leading-relaxed text-aria-textMuted">Document content will load here...</p>
            </div>
          </div>

          {/* Center Column: Charts & Agent Stream */}
          <div className="col-span-5 flex flex-col gap-6">
            <div className="flex-1 flex flex-col gap-3">
               <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Performance Overview</h2>
               <div className="flex-1 matte-panel p-5"></div>
            </div>
            <div className="flex-[0.7] flex flex-col gap-3">
               <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Agent Thought Process</h2>
               <div className="flex-1 matte-panel p-5 bg-[#FAFAFD]"></div>
            </div>
          </div>

           {/* Right Column: Findings Panel */}
           <div className="col-span-4 flex flex-col gap-3">
             <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Audit Findings</h2>
             <div className="flex-1 matte-panel p-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-aria-border">
                <span className="text-sm font-semibold">Active Flags</span>
                <span className="bg-aria-accentLight text-aria-accent text-xs font-bold px-2 py-1 rounded-md">0</span>
              </div>
              <p className="text-sm text-aria-textMuted">Findings will appear here...</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}