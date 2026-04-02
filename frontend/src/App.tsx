import { useState, useRef, useEffect } from 'react';
import { 
  FileText, Activity, Sparkles, Settings2, AlertOctagon, Clock, Trophy, History, Siren
} from 'lucide-react';

// Import our newly extracted components!
import RewardChart from './components/RewardChart';
import FindingsPanel from './components/FindingsPanel';
import TaskExplorer from './components/TaskExplorer';
import Leaderboard from './components/Leaderboard';
import EpisodeViewer from './components/EpisodeViewer';

// --- MOCK DATA FOR LIVE MONITOR ---
const mockDocument = {
  title: "Data Protection Addendum (DPA)",
  version: "v2.1.4",
  sections: [
    { id: "s1", title: "1. Definitions", content: "For the purposes of this Addendum, 'Personal Data' shall have the meaning assigned to it in Article 4 of the GDPR..." },
    { id: "s2", title: "2. Data Retention", content: "The Processor shall retain customer data for 5 years. Upon completion, data may be archived indefinitely." },
    { id: "s3", title: "3. Sub-processors", content: "The Processor shall not engage another processor without prior authorization..." },
    { id: "s4", title: "4. Security", content: "All data must be encrypted at rest using AES-256. Access logs must be maintained." },
    { id: "s5", title: "5. Incident Response", content: "In the event of a breach, the Processor will notify the Controller without undue delay." }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'leaderboard' | 'replay'>('monitor');

  // Monitor State
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Awaiting run initialization..."]);
  const [chartData, setChartData] = useState([{ step: 0, reward: 0, cumulative: 0 }]);
  const [findings, setFindings] = useState<any[]>([]);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState('easy');
  const [activeIncident, setActiveIncident] = useState<any | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const runGhostDemo = () => {
    setIsDemoRunning(true);
    setShowTaskModal(false);
    setActiveIncident(null);
    setLogs(["Initializing ARIA Agent..."]);
    setChartData([{ step: 1, reward: 0.05, cumulative: 0.05 }]);
    setFindings([]);
    setActiveSection("s1");

    let step = 1;
    const interval = setInterval(() => {
      step++;
      if (step === 2) {
        setLogs(prev => [...prev, "Scanning Section 1. No gaps detected."]);
        setActiveSection("s2");
      }
      if (step === 3) {
        setLogs(prev => [...prev, "Flagging 'indefinitely' in Data Retention (Section 2).", "Citing Evidence: GDPR Article 5(1)(e)."]);
        setChartData(prev => [...prev, { step, reward: 0.20, cumulative: 0.25 }]);
        setFindings([{ id: 1, type: "data_retention", severity: "high", framework: "GDPR", text: "Data retention clause implies indefinite storage.", location: "s2" }]);
        setActiveSection("s4");
      }
      if (step === 4 && selectedTask === 'expert') {
        setActiveIncident({ type: "Unauthorized DB Access", records: "50,000+ exposed", deadline: "72 Hours (GDPR)" });
        setLogs(prev => [...prev, "CRITICAL ALERT: Live data breach detected in telemetry.", "Agent suspending audit to execute Incident Response protocols."]);
        clearInterval(interval);
        setTimeout(() => {
          setActiveIncident(null);
          setLogs(prev => [...prev, "Agent executed: contain_breach.", "Agent executed: notify_supervisory_authority (+0.20 Reward).", "Resuming document audit..."]);
          setChartData(prev => [...prev, { step: 5, reward: 0.20, cumulative: 0.45 }]);
          setTimeout(() => setIsDemoRunning(false), 2000);
        }, 4000);
        return;
      }
      if (step === 4 && selectedTask !== 'expert') {
        setActiveSection("s5");
        setLogs(prev => [...prev, "Scanning Section 5: Incident Response."]);
      }
      if (step === 5 && selectedTask !== 'expert') {
        setChartData(prev => [...prev, { step, reward: 0.15, cumulative: 0.40 }]);
        setFindings(prev => [...prev, { id: 2, type: "breach_notification", severity: "medium", framework: "GDPR", text: "Lacks 72-hour maximum escalation protocol.", location: "s5" }]);
        clearInterval(interval);
        setIsDemoRunning(false);
      }
    }, 2000);
  };

  return (
    <div className={`min-h-screen p-8 flex items-center justify-center relative transition-colors duration-500 ${activeIncident ? 'bg-pastel-blush' : 'bg-aria-bg'}`}>
      <div className={`w-full max-w-7xl matte-panel p-8 transition-all duration-500 ${showTaskModal || activeIncident ? 'scale-[0.98] blur-[2px] opacity-60' : ''}`}>
        
        {/* --- HEADER NAVIGATION --- */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-aria-border relative">
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-3 text-aria-textMain">
            <div className="w-8 h-8 rounded-lg bg-aria-accent flex items-center justify-center shadow-premium">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight">ARIA</span>
          </h1>

          <nav className="flex gap-8 text-sm font-bold text-aria-textMuted uppercase tracking-widest absolute left-1/2 -translate-x-1/2">
            <button onClick={() => setActiveTab('monitor')} className={`pb-2 transition-all flex items-center gap-2 ${activeTab === 'monitor' ? 'text-aria-accent border-b-2 border-aria-accent' : 'hover:text-aria-textMain'}`}>
              <Activity className="w-4 h-4" /> Live Monitor
            </button>
            <button onClick={() => setActiveTab('replay')} className={`pb-2 transition-all flex items-center gap-2 ${activeTab === 'replay' ? 'text-aria-accent border-b-2 border-aria-accent' : 'hover:text-aria-textMain'}`}>
              <History className="w-4 h-4" /> Replay
            </button>
            <button onClick={() => setActiveTab('leaderboard')} className={`pb-2 transition-all flex items-center gap-2 ${activeTab === 'leaderboard' ? 'text-aria-accent border-b-2 border-aria-accent' : 'hover:text-aria-textMain'}`}>
              <Trophy className="w-4 h-4" /> Leaderboard
            </button>
          </nav>

          <div className="flex items-center gap-4 text-sm font-bold text-aria-textMuted uppercase tracking-widest min-w-[250px] justify-end">
            {activeTab === 'monitor' && (
              <>
                <button onClick={() => setShowTaskModal(true)} disabled={isDemoRunning} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition text-aria-textMain disabled:opacity-50">
                  <Settings2 className="w-4 h-4" /> Config
                </button>
                <button onClick={runGhostDemo} disabled={isDemoRunning} className="flex items-center gap-2 bg-aria-accent text-white px-5 py-2.5 rounded-lg hover:bg-violet-600 transition shadow-premium disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> {isDemoRunning ? 'Running...' : 'Launch'}
                </button>
              </>
            )}
            {activeTab === 'replay' && <span className="text-xs bg-gray-100 px-3 py-1.5 rounded-md text-gray-500">Session: #GEN_42</span>}
            {activeTab === 'leaderboard' && (
              <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-aria-accentLight text-aria-accent rounded-lg border border-aria-accent/20 hover:bg-aria-accent hover:text-white transition">
                Export CSV
              </button>
            )}
          </div>
        </header>

        <div className="h-[650px] relative overflow-hidden">
          
          {/* --- VIEW 1: LIVE MONITOR --- */}
          <div className={`absolute inset-0 transition-all duration-500 ${activeTab === 'monitor' ? 'opacity-100 pointer-events-auto translate-x-0' : 'opacity-0 pointer-events-none -translate-x-8'}`}>
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left: Document Viewer */}
              <div className="col-span-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 pl-1">
                  <FileText className="w-4 h-4 text-aria-textMuted" />
                  <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest">Active Document</h2>
                </div>
                <div className="flex-1 matte-panel p-6 overflow-y-auto bg-white pr-2">
                  <div className="border-b border-aria-border pb-4 mb-6">
                    <h3 className="text-lg font-bold text-aria-textMain">{mockDocument.title}</h3>
                    <p className="text-xs font-mono text-aria-textMuted mt-1">Version {mockDocument.version}</p>
                  </div>
                  <div className="flex flex-col gap-4 font-serif">
                    {mockDocument.sections.map((sec) => {
                      const isFlagged = findings.some(f => f.location === sec.id);
                      const isActive = activeSection === sec.id;
                      return (
                        <div key={sec.id} className={`p-4 rounded-xl transition-all duration-500 ${isFlagged ? 'bg-pastel-blush border border-pastel-blushBorder shadow-sm' : isActive ? 'bg-pastel-peach border border-pastel-peachBorder shadow-sm scale-[1.02]' : 'hover:bg-gray-50 border border-transparent'}`}>
                          <h4 className="font-semibold text-aria-textMain mb-2 font-sans text-sm">{sec.title}</h4>
                          <p className={`text-sm leading-relaxed ${isFlagged ? 'text-pastel-blushText' : isActive ? 'text-pastel-peachText' : 'text-gray-600'}`}>{sec.content}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Center: Metrics & Stream */}
              <div className="col-span-4 flex flex-col gap-6">
                <div className="flex-1 flex flex-col gap-3">
                  <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Performance Curve</h2>
                  <RewardChart data={chartData} />
                </div>
                <div className="flex-[0.8] flex flex-col gap-3">
                  <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Agent Reasoning Log</h2>
                  <div className="flex-1 matte-panel p-5 bg-[#FAFAFD] flex flex-col gap-4 overflow-y-auto pr-2">
                    {logs.map((log, index) => (
                      <div key={index} className={`flex gap-3 items-start border-b border-aria-border pb-3 animate-in fade-in slide-in-from-bottom-2 duration-500 ${log.includes("CRITICAL") ? 'text-pastel-blushText font-bold' : ''}`}>
                          <div className="min-w-6 mt-0.5">
                            {log.includes("CRITICAL") ? <Siren className="w-4 h-4 text-pastel-blushText animate-pulse" /> : <Activity className="w-4 h-4 text-aria-accent" />}
                          </div>
                          <p className="text-xs leading-relaxed">{log}</p>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>

              {/* Right: Findings Panel */}
              <FindingsPanel findings={findings} />
            </div>
          </div>

          {/* --- VIEW 2: EPISODE REPLAY --- */}
          <div className={`absolute inset-0 transition-all duration-500 ${activeTab === 'replay' ? 'opacity-100 pointer-events-auto translate-x-0' : 'opacity-0 pointer-events-none translate-x-8'}`}>
            <EpisodeViewer />
          </div>

          {/* --- VIEW 3: LEADERBOARD --- */}
          <div className={`absolute inset-0 transition-all duration-500 ${activeTab === 'leaderboard' ? 'opacity-100 pointer-events-auto translate-x-0' : 'opacity-0 pointer-events-none translate-x-8'}`}>
             <Leaderboard />
          </div>

        </div>
      </div>

      <TaskExplorer 
        show={showTaskModal} 
        onClose={() => setShowTaskModal(false)} 
        onLaunch={runGhostDemo} 
        selectedTask={selectedTask} 
        setSelectedTask={setSelectedTask} 
      />

      {/* --- EXPERT MODE INCIDENT MODAL --- */}
      {activeIncident && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-8 bg-pastel-blushText/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white border-2 border-pastel-blushText shadow-[0_0_50px_rgba(136,19,55,0.3)] rounded-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="bg-pastel-blushText text-white p-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <AlertOctagon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-widest uppercase">Live Breach Detected</h2>
                <p className="text-pastel-blush opacity-90 text-sm mt-1">Audit suspended. Agent diverting to incident response.</p>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-5 bg-[#FAFAFD]">
              <div className="flex justify-between items-center pb-4 border-b border-aria-border">
                <span className="text-sm font-semibold text-aria-textMuted">Incident Vector</span>
                <span className="font-bold text-aria-textMain">{activeIncident.type}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-aria-border">
                <span className="text-sm font-semibold text-aria-textMuted">Impact Radius</span>
                <span className="font-bold text-aria-textMain">{activeIncident.records}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-aria-textMuted">Regulatory Deadline</span>
                <div className="flex items-center gap-2 text-pastel-blushText font-bold bg-pastel-blush px-3 py-1.5 rounded-lg border border-pastel-blushBorder">
                  <Clock className="w-4 h-4 animate-pulse" /> {activeIncident.deadline}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-aria-border flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-bold text-aria-textMuted">
                <Activity className="w-4 h-4 animate-spin text-aria-accent" />
                Agent formulating containment protocol...
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}