import { useState, useRef, useEffect } from 'react';
import { 
  FileText, Activity, Sparkles, Settings2, AlertOctagon, Trophy, History, Siren
} from 'lucide-react';

import RewardChart from './components/RewardChart';
import FindingsPanel from './components/FindingsPanel';
import TaskExplorer from './components/TaskExplorer';
import Leaderboard from './components/Leaderboard';
import EpisodeViewer from './components/EpisodeViewer';

// --- WIRING: CONFIGURATION ---
const API_BASE = window.location.origin;  // Works in dev (proxied) and production (same origin)
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/aria/ws`; // /aria prefix matches backend router mount
const FIXED_SESSION_ID = "hackathon_demo_001"; // Must match your Python script!

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'leaderboard' | 'replay'>('monitor');

  // Monitor State
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Awaiting run initialization..."]);
  const [chartData, setChartData] = useState([{ step: 0, reward: 0, cumulative: 0 }]);
  const [findings, setFindings] = useState<any[]>([]);
  const [currentDoc, setCurrentDoc] = useState<any>(null); // Real doc from backend
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState('easy');
  const [activeIncident, setActiveIncident] = useState<any | null>(null);
  const [replaySteps, setReplaySteps] = useState<any[]>([]);

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // --- WIRING: WEBSOCKET LISTENER ---
  useEffect(() => {
    const socket = new WebSocket(`${WS_URL}/${FIXED_SESSION_ID}`);

    socket.onopen = () => console.log("✅ WebSocket Linked");
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'step') {
        setIsDemoRunning(true);
        const obs = data.observation;
        
        // 1. Update Logs
        setLogs(prev => [data.reward_reason || `Action: ${data.action.action_type}`, ...prev]);
        
        // 2. Update Charts
        setChartData(prev => [...prev, { 
          step: data.step_number, 
          reward: data.reward, 
          cumulative: obs.cumulative_reward 
        }]);

        // 3. Update Findings
        setFindings(obs.active_findings);

        // 4. Update UI Highlighting
        if (data.action.action_type === 'request_section') {
           setActiveSection(data.action.section_id);
        }

        // 5. Build Replay Context
        setReplaySteps(prev => [...prev, {
          step: data.step_number,
          action: data.action.action_type + (data.action.clause_ref ? ` (${data.action.clause_ref})` : ''),
          reward: data.reward,
          desc: data.reward_reason || `Action: ${data.action.action_type}`,
          highlight: data.action.action_type === 'request_section' ? data.action.section_id : null,
          flag: data.action.action_type === 'identify_gap' ? data.action.clause_ref?.split('.')[1] : null,
          rawJson: data
        }]);
      }

      if (data.type === 'incident_alert') {
        setActiveIncident(data.incident);
      }

      if (data.type === 'episode_complete') {
        setIsDemoRunning(false);
        setLogs(prev => ["🏁 Episode Complete. Final Grade available in Leaderboard.", ...prev]);
      }
    };

    return () => socket.close();
  }, []);

  // --- WIRING: API LAUNCHER ---
  const handleLaunch = async () => {
    setIsDemoRunning(true);
    setLogs(["Requesting environment reset..."]);
    
    try {
      const response = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-ID': FIXED_SESSION_ID 
        },
        body: JSON.stringify({ task_name: selectedTask, seed: 42 })
      });
      
      const initialObs = await response.json();
      setCurrentDoc(initialObs.documents[0]); // Load the real first document
      setReplaySteps([]); // Reset replay on new run
      setLogs(prev => ["Environment Ready. Waiting for Agent actions...", ...prev]);
      setShowTaskModal(false);
    } catch (err) {
      setLogs(prev => ["❌ Connection Error: Ensure backend is running at :7860", ...prev]);
      setIsDemoRunning(false);
    }
  };

  return (
    <div className={`min-h-screen p-8 flex items-center justify-center relative transition-colors duration-500 ${activeIncident ? 'bg-pastel-blush' : 'bg-aria-bg'}`}>
      <div className={`w-full max-w-7xl matte-panel p-8 transition-all duration-500 ${showTaskModal || activeIncident ? 'scale-[0.98] blur-[2px] opacity-60' : ''}`}>
        
        {/* Header - Stays mostly the same */}
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
            <button onClick={() => setShowTaskModal(true)} disabled={isDemoRunning} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition text-aria-textMain disabled:opacity-50">
              <Settings2 className="w-4 h-4" /> Config
            </button>
            <button onClick={handleLaunch} disabled={isDemoRunning} className="flex items-center gap-2 bg-aria-accent text-white px-5 py-2.5 rounded-lg hover:bg-violet-600 transition shadow-premium disabled:opacity-50">
              <Sparkles className="w-4 h-4" /> {isDemoRunning ? 'Running...' : 'Launch'}
            </button>
          </div>
        </header>

        <div className="h-[650px] relative overflow-hidden">
          {/* LIVE MONITOR VIEW */}
          <div className={`absolute inset-0 transition-all duration-500 ${activeTab === 'monitor' ? 'opacity-100 pointer-events-auto translate-x-0' : 'opacity-0 pointer-events-none -translate-x-8'}`}>
            <div className="grid grid-cols-12 gap-6 h-full">
              
              {/* Left: Real Document Viewer */}
              <div className="col-span-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 pl-1">
                  <FileText className="w-4 h-4 text-aria-textMuted" />
                  <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest">Active Document</h2>
                </div>
                <div className="flex-1 matte-panel p-6 overflow-y-auto bg-white pr-2">
                  {currentDoc ? (
                    <>
                      <div className="border-b border-aria-border pb-4 mb-6">
                        <h3 className="text-lg font-bold text-aria-textMain">{currentDoc.title}</h3>
                        <p className="text-xs font-mono text-aria-textMuted mt-1">ID: {currentDoc.doc_id}</p>
                      </div>
                      <div className="flex flex-col gap-4 font-serif">
                        {currentDoc.sections.map((sec: any) => {
                          const isFlagged = findings.some(f => f.clause_ref.includes(sec.section_id));
                          const isActive = activeSection === sec.section_id;
                          return (
                            <div key={sec.section_id} className={`p-4 rounded-xl transition-all duration-500 ${isFlagged ? 'bg-pastel-blush border border-pastel-blushBorder shadow-sm' : isActive ? 'bg-pastel-peach border border-pastel-peachBorder shadow-sm scale-[1.02]' : 'hover:bg-gray-50 border border-transparent'}`}>
                              <h4 className="font-semibold text-aria-textMain mb-2 font-sans text-sm">{sec.title}</h4>
                              <p className={`text-sm leading-relaxed ${isFlagged ? 'text-pastel-blushText' : isActive ? 'text-pastel-peachText' : 'text-gray-600'}`}>{sec.content}</p>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-aria-textMuted italic text-sm text-center p-8">
                      Select a task and click Launch to load regulatory documents into context.
                    </div>
                  )}
                </div>
              </div>

              {/* Center: Real Metrics & Stream */}
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

          {/* Leaderboard and Replay stay the same... */}
          <div className={`absolute inset-0 transition-all duration-500 ${activeTab === 'replay' ? 'opacity-100 pointer-events-auto translate-x-0' : 'opacity-0 pointer-events-none translate-x-8'}`}>
            <EpisodeViewer 
               replaySteps={replaySteps.length > 0 ? replaySteps : undefined} 
               document={currentDoc || undefined} 
            />
          </div>
          <div className={`absolute inset-0 transition-all duration-500 ${activeTab === 'leaderboard' ? 'opacity-100 pointer-events-auto translate-x-0' : 'opacity-0 pointer-events-none translate-x-8'}`}>
             <Leaderboard />
          </div>
        </div>
      </div>

      <TaskExplorer 
        show={showTaskModal} 
        onClose={() => setShowTaskModal(false)} 
        onLaunch={handleLaunch} // Use the new launcher
        selectedTask={selectedTask} 
        setSelectedTask={setSelectedTask} 
      />

      {/* Incident Modal Logic stays the same... */}
      {activeIncident && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-8 bg-pastel-blushText/20 backdrop-blur-sm animate-in fade-in duration-300">
           {/* (Content remains same as your previous App.tsx) */}
           <div className="w-full max-w-lg bg-white border-2 border-pastel-blushText rounded-2xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-pastel-blushText flex items-center gap-2">
                 <AlertOctagon className="w-6 h-6" /> DATA BREACH INCIDENT
              </h2>
              <p className="mt-4 text-sm text-gray-600">Incident Type: {activeIncident.incident_type}</p>
              <p className="mt-2 text-sm text-gray-600">Records Impacted: {activeIncident.records_affected}</p>
              <div className="mt-6 p-4 bg-pastel-blush/20 rounded-lg text-xs font-mono">
                 Agent executing containment protocol...
              </div>
           </div>
        </div>
      )}
    </div>
  )
}