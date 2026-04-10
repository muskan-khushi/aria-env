import { useState, useRef, useEffect } from 'react';
import { 
  FileText, Activity, Sparkles, Settings2, AlertOctagon, Trophy, History, Siren, Download, X,
  Shield, Code2, Home,
} from 'lucide-react';

import RewardChart from './components/RewardChart';
import FindingsPanel from './components/FindingsPanel';
import TaskExplorer from './components/TaskExplorer';
import Leaderboard from './components/Leaderboard';
import EpisodeViewer from './components/EpisodeViewer';
import ReportModal from './components/ReportModal';
import FrameworkExplorer from './components/FrameworkExplorer';
import APIReference from './components/APIReference';
import LandingPage from './components/LandingPage';

const API_BASE = window.location.origin;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/aria/ws`;
const FIXED_SESSION_ID = "hackathon_demo_001";

type TabType = 'monitor' | 'leaderboard' | 'replay' | 'frameworks' | 'api';
type AppView = 'landing' | 'dashboard';

export default function App() {
  const [appView, setAppView] = useState<AppView>('landing');
  const [activeTab, setActiveTab] = useState<TabType>('monitor');

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isDemoComplete, setIsDemoComplete] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Awaiting run initialization..."]);
  const [chartData, setChartData] = useState([{ step: 0, reward: 0, cumulative: 0 }]);
  // FIX: Store full finding objects from WebSocket observation
  const [findings, setFindings] = useState<any[]>([]);
  const [currentDoc, setCurrentDoc] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<string>("reading");
  const [cumulativeReward, setCumulativeReward] = useState<number>(0);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState('easy');
  const [activeIncident, setActiveIncident] = useState<any | null>(null);
  const [replaySteps, setReplaySteps] = useState<any[]>([]);
  const [steerText, setSteerText] = useState("");
  const [steerSending, setSteerSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [totalStepsRun, setTotalStepsRun] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  useEffect(() => {
    const connectWs = () => {
      const socket = new WebSocket(`${WS_URL}/${FIXED_SESSION_ID}`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("✅ WebSocket Linked");
        setWsConnected(true);
      };

      socket.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 3000);
      };
      
      const speak = (text: string) => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const msg = new SpeechSynthesisUtterance(text);
          msg.rate = 1.0; msg.pitch = 0.9;
          window.speechSynthesis.speak(msg);
        }
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'step') {
          setIsDemoRunning(true);
          const obs = data.observation;
          setLogs(prev => [data.reward_reason || `Action: ${data.action?.action_type || 'unknown'}`, ...prev.slice(0, 199)]);
          setChartData(prev => [...prev, { 
            step: data.step_number, 
            reward: data.reward, 
            cumulative: obs.cumulative_reward 
          }]);
          
          // FIX: Properly extract active_findings from observation
          const activeFindingsRaw = obs.active_findings || [];
          setFindings(activeFindingsRaw);
          
          setCurrentPhase(obs.phase || "reading");
          setCumulativeReward(obs.cumulative_reward || 0);
          setTotalStepsRun(data.step_number);

          if (data.action?.action_type === 'request_section') {
            setActiveSection(data.action.section_id);
          }
          
          // Update doc from observation
          if (obs.documents && obs.documents.length > 0 && !currentDoc) {
            setCurrentDoc(obs.documents[0]);
          }
          
          if (data.action?.action_type === 'identify_gap') {
            speak(`Auditor has flagged a potential gap: ${data.action.gap_type?.replace(/_/g, ' ')}`);
          }

          setReplaySteps(prev => [...prev, {
            step: data.step_number,
            action: (data.action?.action_type || 'unknown') + (data.action?.clause_ref ? ` (${data.action.clause_ref})` : ''),
            reward: data.reward,
            desc: data.reward_reason || `Action: ${data.action?.action_type || 'unknown'}`,
            highlight: data.action?.action_type === 'request_section' ? data.action.section_id : null,
            flag: data.action?.action_type === 'identify_gap' ? data.action.clause_ref?.split('.')[1] : null,
            rawJson: data
          }]);
        }

        if (data.type === 'incident_alert') {
          speak(`Critical Alert! Breach detected. ${data.message}`);
          setActiveIncident(data.incident);
        }

        if (data.type === 'episode_complete') {
          speak("Audit complete. Final grade has been generated.");
          setIsDemoRunning(false);
          setIsDemoComplete(true);
          setLogs(prev => ["🏁 Episode Complete. Final Grade available in Leaderboard.", ...prev]);
          
          // FIX: Fetch final grade to get complete findings state
          fetch(`${API_BASE}/grader`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-ID': FIXED_SESSION_ID },
          })
            .then(r => r.json())
            .then(grade => {
              console.log("Final grade:", grade);
            })
            .catch(console.error);
        }
      };
    };

    connectWs();
    return () => {
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, []);

  const handleLaunch = async () => {
    setIsDemoRunning(true);
    setIsDemoComplete(false);
    setLogs(["Requesting environment reset..."]);
    sectionRefs.current = {};
    setFindings([]); // Clear previous findings
    
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
      setCurrentDoc(initialObs.documents?.[0] || null);
      setReplaySteps([]);
      setChartData([{ step: 0, reward: 0, cumulative: 0 }]);
      setFindings([]);
      setCurrentPhase("reading");
      setCumulativeReward(0);
      setTotalStepsRun(0);
      setSteerText("");
      setLogs(prev => ["Environment Ready. Waiting for Agent actions...", ...prev]);
      setShowTaskModal(false);

      // Auto-start internal agent
      await fetch(`${API_BASE}/aria/demo/start/${selectedTask}`, { method: 'POST' });
    } catch (err) {
      setLogs(prev => ["❌ Connection Error: Ensure backend is running at :7860", ...prev]);
      setIsDemoRunning(false);
    }
  };

  const handleViewClause = (sectionId: string) => {
    setActiveSection(sectionId);
    setActiveTab('monitor');
    setTimeout(() => {
      const el = sectionRefs.current[sectionId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steerText.trim()) return;
    setSteerSending(true);
    try {
      await fetch(`${API_BASE}/aria/steer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: FIXED_SESSION_ID, steer_text: steerText })
      });
      setLogs(prev => [`[USER OVERRIDE]: ${steerText}`, ...prev]);
      setSteerText("");
    } catch (err) {
      console.error(err);
    }
    setSteerSending(false);
  };

  // Show landing page first
  if (appView === 'landing') {
    return <LandingPage onEnterDashboard={() => setAppView('dashboard')} />;
  }

  const canDownload = findings.length > 0 || isDemoComplete || replaySteps.length > 0;

  const TASK_DIFFICULTY_COLOR: Record<string, string> = {
    easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    hard: 'text-orange-600 bg-orange-50 border-orange-200',
    expert: 'text-rose-600 bg-rose-50 border-rose-200',
    blind: 'text-purple-600 bg-purple-50 border-purple-200',
    custom: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  const navItems: { id: TabType; label: string; icon: any }[] = [
    { id: 'monitor', label: 'Monitor', icon: Activity },
    { id: 'replay', label: 'Replay', icon: History },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'frameworks', label: 'Frameworks', icon: Shield },
    { id: 'api', label: 'API', icon: Code2 },
  ];

  return (
    <div className={`min-h-screen p-4 flex flex-col transition-colors duration-500 ${activeIncident ? 'bg-pastel-blush' : 'bg-aria-bg'}`}>
      <div className={`w-full max-w-[1600px] mx-auto flex flex-col flex-1 matte-panel p-5 transition-all duration-500 ${showTaskModal || activeIncident ? 'scale-[0.98] blur-[2px] opacity-60' : ''}`}>
        
        {/* Header - Fixed layout to prevent congestion */}
        <header className="flex justify-between items-center mb-5 pb-4 border-b border-aria-border relative flex-shrink-0 gap-2">
          {/* Logo - left */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <button
              onClick={() => setAppView('landing')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Back to home"
            >
              <div className="w-8 h-8 rounded-lg bg-aria-accent flex items-center justify-center shadow-premium flex-shrink-0">
                <Activity className="text-white w-4 h-4" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold tracking-tight text-aria-textMain leading-none">ARIA</h1>
                <p className="text-[9px] text-aria-textMuted font-medium tracking-widest uppercase leading-none mt-0.5 hidden lg:block">Regulatory Intelligence</p>
              </div>
            </button>
          </div>

          {/* Nav - center, compact */}
          <nav className="flex gap-0.5 text-xs font-bold text-aria-textMuted uppercase tracking-wide">
            {/* Home button */}
            <button
              onClick={() => setAppView('landing')}
              className="pb-1.5 pt-1.5 px-2 transition-all flex items-center gap-1 rounded-lg hover:text-aria-textMain hover:bg-gray-100"
              title="Home"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`pb-1.5 pt-1.5 px-2.5 transition-all flex items-center gap-1 rounded-lg whitespace-nowrap ${
                  activeTab === id 
                    ? 'text-aria-accent bg-aria-accentLight' 
                    : 'hover:text-aria-textMain hover:bg-gray-100'
                }`}
              >
                <Icon className="w-3 h-3 flex-shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Right controls - compact */}
          <div className="flex items-center gap-1.5 min-w-[160px] justify-end">
            {/* WS status dot */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold border ${wsConnected ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="hidden sm:inline">{wsConnected ? 'LIVE' : 'OFF'}</span>
            </div>

            {/* Task badge */}
            <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold border hidden sm:block ${TASK_DIFFICULTY_COLOR[selectedTask] || 'text-gray-500 bg-gray-100 border-gray-200'}`}>
              {selectedTask.toUpperCase()}
            </div>

            {/* Download */}
            <button
              onClick={() => setShowReportModal(true)}
              disabled={!canDownload}
              title="Download audit report"
              className="p-1.5 rounded-lg border border-aria-border hover:bg-gray-50 transition text-aria-textMain disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Task config */}
            <button
              onClick={() => setShowTaskModal(true)}
              disabled={isDemoRunning}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-aria-textMain disabled:opacity-50"
              title="Configure task"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            {/* Launch */}
            <button
              onClick={handleLaunch}
              disabled={isDemoRunning}
              className="flex items-center gap-1.5 bg-aria-accent text-white px-3 py-1.5 rounded-lg hover:bg-violet-600 transition shadow-premium disabled:opacity-50 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
            >
              {isDemoRunning ? (
                <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /></>
              ) : (
                <><Sparkles className="w-3 h-3" /> Run</>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 relative min-h-0">

          {/* LIVE MONITOR VIEW */}
          {activeTab === 'monitor' && (
            <div className="grid grid-cols-12 gap-4" style={{ minHeight: '680px' }}>
              
              {/* Left: Document Viewer */}
              <div className="col-span-4 flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between pl-1 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-aria-textMuted" />
                    <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest">Active Document</h2>
                  </div>
                  {currentDoc && (
                    <span className="text-[10px] font-mono text-aria-textMuted bg-gray-100 px-2 py-0.5 rounded">{currentDoc.doc_id}</span>
                  )}
                </div>
                <div className="matte-panel p-5 bg-white overflow-y-auto flex-1" style={{ height: '640px' }}>
                  {currentDoc ? (
                    <>
                      <div className="border-b border-aria-border pb-4 mb-5">
                        <h3 className="text-base font-bold text-aria-textMain">{currentDoc.title}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] font-mono text-aria-textMuted">ID: {currentDoc.doc_id}</span>
                          <span className="text-[10px] font-bold text-aria-accent bg-aria-accentLight px-2 py-0.5 rounded-full">
                            {currentDoc.sections?.length} sections
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 font-serif">
                        {currentDoc.sections.map((sec: any) => {
                          const secId = sec.section_id || sec.id;
                          const isFlagged = findings.some(f => f.clause_ref?.includes(secId));
                          const isActive = activeSection === secId;
                          return (
                            <div
                              key={secId}
                              ref={(el) => { sectionRefs.current[secId] = el; }}
                              className={`p-4 rounded-xl transition-all duration-500 ${
                                isFlagged
                                  ? 'bg-pastel-blush border border-pastel-blushBorder shadow-sm'
                                  : isActive
                                  ? 'bg-pastel-peach border border-pastel-peachBorder shadow-sm scale-[1.01]'
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <h4 className="font-semibold text-aria-textMain font-sans text-sm flex-1">{sec.title}</h4>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isFlagged && <span className="text-[9px] font-bold text-pastel-blushText bg-pastel-blush border border-pastel-blushBorder px-1.5 py-0.5 rounded-full">FLAGGED</span>}
                                  {isActive && !isFlagged && <span className="text-[9px] font-bold text-pastel-peachText bg-pastel-peach border border-pastel-peachBorder px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                  <span className="text-[9px] font-mono text-aria-textMuted">{secId}</span>
                                </div>
                              </div>
                              <p className={`text-xs leading-relaxed ${
                                isFlagged ? 'text-pastel-blushText' : isActive ? 'text-pastel-peachText' : 'text-gray-600'
                              }`}>
                                {sec.content}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-aria-textMuted text-center p-8">
                      <div className="w-14 h-14 rounded-2xl bg-aria-accentLight flex items-center justify-center">
                        <FileText className="w-7 h-7 text-aria-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-aria-textMain mb-1">No Document Loaded</p>
                        <p className="text-xs italic">Select a task and click Run to load regulatory documents.</p>
                      </div>
                      <button
                        onClick={() => setShowTaskModal(true)}
                        className="mt-2 px-4 py-2 bg-aria-accent text-white rounded-lg text-xs font-bold hover:bg-violet-600 transition"
                      >
                        Select Task
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Center: Chart + Log */}
              <div className="col-span-4 flex flex-col gap-3 min-h-0">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                  <div className="matte-panel p-3 bg-white flex flex-col justify-center items-center gap-1 border border-aria-border">
                    <span className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest">Reward</span>
                    <span className={`text-2xl font-light tracking-tighter ${cumulativeReward >= 0 ? 'text-pastel-sageText' : 'text-pastel-blushText'}`}>
                      {cumulativeReward >= 0 ? '+' : ''}{cumulativeReward.toFixed(2)}
                    </span>
                  </div>
                  <div className="matte-panel p-3 bg-white flex flex-col justify-center items-center gap-1 border border-aria-border">
                    <span className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest">Steps</span>
                    <span className="text-2xl font-light tracking-tighter text-aria-textMain">{totalStepsRun}</span>
                  </div>
                  <div className="matte-panel p-3 bg-white flex flex-col justify-center items-center gap-1 border border-aria-border">
                    <span className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest">Findings</span>
                    <span className={`text-2xl font-light tracking-tighter ${findings.length > 0 ? 'text-pastel-blushText' : 'text-aria-textMain'}`}>{findings.length}</span>
                  </div>
                </div>

                {/* Phase indicator */}
                <div className="matte-panel p-3 bg-white flex flex-col gap-2 justify-center border border-aria-border flex-shrink-0">
                  <span className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest text-center">Audit Phase</span>
                  <div className="flex items-center justify-between px-1 gap-1">
                    {[
                      { id: 'reading', label: '01 Read' },
                      { id: 'auditing', label: '02 Audit' },
                      { id: 'remediating', label: '03 Fix' },
                      { id: 'complete', label: '04 Done' },
                    ].map((phase, i) => (
                      <div key={phase.id} className="flex items-center gap-1 flex-1">
                        <span className={`text-[10px] font-bold transition-all truncate ${currentPhase === phase.id ? 'text-aria-accent' : 'text-gray-300'}`}>
                          {phase.label}
                        </span>
                        {i < 3 && <div className="flex-1 h-px bg-gray-200 min-w-[4px]" />}
                      </div>
                    ))}
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-aria-accent rounded-full transition-all duration-500"
                      style={{ width: `${currentPhase === 'reading' ? 25 : currentPhase === 'auditing' ? 50 : currentPhase === 'remediating' ? 75 : 100}%` }}
                    />
                  </div>
                </div>

                {/* Chart */}
                <div className="flex flex-col gap-2 flex-shrink-0 overflow-visible z-10 relative bg-white matte-panel p-4 border border-aria-border">
                  <h2 className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest pl-1">Performance Curve</h2>
                  <RewardChart data={chartData} />
                </div>
                
                {/* Log */}
                <div className="flex flex-col gap-2 flex-1 min-h-[200px]">
                  <h2 className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest pl-1 flex-shrink-0">Agent Reasoning Log</h2>
                  <div className="matte-panel p-4 bg-[#FAFAFD] overflow-y-auto flex flex-col gap-2 flex-1 border border-aria-border">
                    {logs.map((log, index) => (
                      <div key={index} className={`flex gap-2 items-start border-b border-aria-border pb-2 ${log.includes("CRITICAL") || log.includes("[USER OVERRIDE]") ? 'text-pastel-blushText font-bold' : ''}`}>
                        <div className="min-w-5 mt-0.5 flex-shrink-0">
                          {log.includes("CRITICAL")
                            ? <Siren className="w-3.5 h-3.5 text-pastel-blushText animate-pulse" />
                            : log.includes("[USER OVERRIDE]") 
                            ? <Sparkles className="w-3.5 h-3.5 text-aria-accent" />
                            : <Activity className="w-3.5 h-3.5 text-aria-accent opacity-60" />
                          }
                        </div>
                        <p className="text-[11px] leading-relaxed">{log}</p>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                  
                  {/* Copilot */}
                  <form onSubmit={handleSteer} className="flex gap-2 flex-shrink-0 relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Sparkles className="w-3.5 h-3.5 text-aria-textMuted" />
                    </div>
                    <input 
                      type="text" 
                      value={steerText}
                      onChange={(e) => setSteerText(e.target.value)}
                      disabled={steerSending || !isDemoRunning}
                      placeholder={isDemoRunning ? "Steer the agent mid-audit..." : "Launch an agent to use Copilot"}
                      className="flex-1 bg-white border border-aria-border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-aria-accent transition shadow-sm disabled:bg-gray-50 focus:ring-1 focus:ring-aria-accent/20"
                    />
                    <button 
                      type="submit" 
                      disabled={steerSending || !steerText.trim() || !isDemoRunning}
                      className="bg-aria-accent text-white px-3 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-violet-600 disabled:opacity-50 transition"
                    >
                      {steerSending ? "..." : "Send"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: Findings Panel - FIX: pass correct findings data */}
              <FindingsPanel findings={findings} onViewClause={handleViewClause} />
            </div>
          )}

          {activeTab === 'replay' && (
            <div style={{ minHeight: '680px' }}>
              <EpisodeViewer
                replaySteps={replaySteps.length > 0 ? replaySteps : undefined}
                document={currentDoc || undefined}
              />
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div style={{ minHeight: '680px' }}>
              <Leaderboard />
            </div>
          )}

          {activeTab === 'frameworks' && (
            <div style={{ minHeight: '680px' }}>
              <FrameworkExplorer />
            </div>
          )}

          {activeTab === 'api' && (
            <div style={{ minHeight: '680px' }}>
              <APIReference />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <TaskExplorer
        show={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onLaunch={handleLaunch}
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
      />

      <ReportModal
        show={showReportModal}
        onClose={() => setShowReportModal(false)}
        findings={findings}
        chartData={chartData}
        currentDoc={currentDoc}
        selectedTask={selectedTask}
        replaySteps={replaySteps}
      />

      {activeIncident && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-pastel-blushText/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white border-2 border-pastel-blushText rounded-2xl p-8 shadow-2xl relative">
            <button
              onClick={() => setActiveIncident(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <AlertOctagon className="w-5 h-5 text-pastel-blushText" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-pastel-blushText">DATA BREACH INCIDENT</h2>
                <p className="text-xs text-gray-500">Expert Mode — Live Response Required</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Incident Type</p>
                <p className="text-sm font-semibold text-rose-800">{activeIncident.incident_type}</p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Records Exposed</p>
                <p className="text-sm font-semibold text-rose-800">{activeIncident.records_affected?.toLocaleString()}</p>
              </div>
            </div>

            <div className="p-4 bg-pastel-blush/20 rounded-xl border border-rose-200 text-xs font-mono text-rose-700 mb-5">
              ⚡ Agent executing containment protocol — respond immediately to minimize deadline penalties.
            </div>

            <button
              onClick={() => setActiveIncident(null)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-sm font-medium text-gray-600"
            >
              <X className="w-4 h-4" /> Dismiss & Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}