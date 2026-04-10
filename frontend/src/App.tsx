import { useState, useRef, useEffect } from 'react';
import {
  FileText, Activity, Sparkles, Settings2, AlertOctagon, Trophy, History, Download, X,
  Shield, Code2, Home, TrendingUp, CheckCircle2,
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
const FIXED_SESSION_ID = "demo_session_001";

type TabType = 'monitor' | 'leaderboard' | 'replay' | 'frameworks' | 'api';
type AppView = 'landing' | 'dashboard';

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600;700&display=swap');
  
  * { box-sizing: border-box; }
  
  :root {
    --lavender-50: #FAF7FF;
    --lavender-100: #F3EEFF;
    --lavender-200: #E9DFFE;
    --lavender-300: #D4BBFD;
    --lavender-400: #B794FA;
    --lavender-500: #9561F4;
    --lavender-600: #7C3AED;
    --font-grotesque: 'Bricolage Grotesque', 'DM Sans', sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
    --font-serif: 'Instrument Serif', Georgia, serif;
  }

  body {
    font-family: var(--font-grotesque);
    background: #FAF7FF;
    color: #1a0a2e;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(196,181,253,0.4); border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.5); }

  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes float-in { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
`;

const TASK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  easy: { color: '#10B981', bg: '#D1FAE5', border: '#A7F3D0' },
  medium: { color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD' },
  hard: { color: '#F97316', bg: '#FFEDD5', border: '#FED7AA' },
  expert: { color: '#EC4899', bg: '#FCE7F3', border: '#F9A8D4' },
  blind: { color: '#6D28D9', bg: '#EDE9FE', border: '#C4B5FD' },
  custom: { color: '#0EA5E9', bg: '#E0F2FE', border: '#BAE6FD' },
};

export default function App() {
  const [appView, setAppView] = useState<AppView>('landing');
  const [activeTab, setActiveTab] = useState<TabType>('monitor');

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isDemoComplete, setIsDemoComplete] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Awaiting run initialization..."]);
  const [chartData, setChartData] = useState([{ step: 0, reward: 0, cumulative: 0 }]);
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
      socket.onopen = () => { setWsConnected(true); };
      socket.onclose = () => { setWsConnected(false); setTimeout(connectWs, 3000); };
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'step') {
          setIsDemoRunning(true);
          const obs = data.observation;
          setLogs(prev => [data.reward_reason || `Action: ${data.action?.action_type || 'unknown'}`, ...prev.slice(0, 199)]);
          setChartData(prev => [...prev, { step: data.step_number, reward: data.reward, cumulative: obs.cumulative_reward }]);
          setFindings(obs.active_findings || []);
          setCurrentPhase(obs.phase || "reading");
          setCumulativeReward(obs.cumulative_reward || 0);
          setTotalStepsRun(data.step_number);
          if (data.action?.action_type === 'request_section') setActiveSection(data.action.section_id);
          if (obs.documents && obs.documents.length > 0 && !currentDoc) setCurrentDoc(obs.documents[0]);
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
        if (data.type === 'incident_alert') setActiveIncident(data.incident);
        if (data.type === 'episode_complete') {
          setIsDemoRunning(false);
          setIsDemoComplete(true);
          setLogs(prev => ["🏁 Episode Complete. Final Grade available in Leaderboard.", ...prev]);
        }
      };
    };
    connectWs();
    return () => { wsRef.current?.close(1000, "unmount"); };
  }, []);

  const handleLaunch = async () => {
    setIsDemoRunning(true);
    setIsDemoComplete(false);
    setLogs(["Requesting environment reset..."]);
    sectionRefs.current = {};
    setFindings([]);
    try {
      const response = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': FIXED_SESSION_ID },
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
    } catch (err) { console.error(err); }
    setSteerSending(false);
  };

  if (appView === 'landing') {
    return <LandingPage onEnterDashboard={() => setAppView('dashboard')} />;
  }

  const canDownload = findings.length > 0 || isDemoComplete || replaySteps.length > 0;
  const taskCfg = TASK_COLORS[selectedTask] || TASK_COLORS.easy;

  const PHASES = [
    { id: 'reading', label: 'Read', num: '01' },
    { id: 'auditing', label: 'Audit', num: '02' },
    { id: 'remediating', label: 'Fix', num: '03' },
    { id: 'complete', label: 'Done', num: '04' },
  ];
  const phaseIdx = PHASES.findIndex(p => p.id === currentPhase);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div style={{
        minHeight: '100vh',
        background: '#FAF7FF',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Ambient orbs */}
        <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,165,253,0.2) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: '0', right: '-5%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,212,0.15) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Dot grid */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.8 }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1700, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>

          {/* ── HEADER ── */}
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: 20,
            border: '1.5px solid rgba(196,181,253,0.3)',
            padding: '14px 24px',
            boxShadow: '0 4px 24px rgba(109,40,217,0.06)',
            gap: 16,
          }}>
            {/* Logo */}
            <button onClick={() => setAppView('landing')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s', padding: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 50%, #6D28D9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(109,40,217,0.35)' }}>
                <Activity style={{ width: 18, height: 18, color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: '#3B0764', lineHeight: 1 }}>ARIA</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#9561F4', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>Compliance Intelligence</div>
              </div>
            </button>

            {/* Nav tabs */}
            <nav style={{ display: 'flex', gap: 4, background: 'rgba(243,238,255,0.6)', padding: '5px', borderRadius: 16, border: '1px solid rgba(196,181,253,0.2)' }}>
              <button onClick={() => setAppView('landing')} title="Home" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 12,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.color = '#8B5CF6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; }}
              >
                <Home style={{ width: 15, height: 15 }} />
              </button>
              {([
                { id: 'monitor', label: 'Monitor', icon: Activity },
                { id: 'replay', label: 'Replay', icon: History },
                { id: 'leaderboard', label: 'Scores', icon: Trophy },
                { id: 'frameworks', label: 'Frameworks', icon: Shield },
                { id: 'api', label: 'API', icon: Code2 },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 12,
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  background: activeTab === id ? 'white' : 'none',
                  color: activeTab === id ? '#8B5CF6' : '#9CA3AF',
                  boxShadow: activeTab === id ? '0 2px 8px rgba(109,40,217,0.1)' : 'none',
                }}>
                  <Icon style={{ width: 14, height: 14 }} />
                  <span style={{ display: 'none', ...(typeof window !== 'undefined' && window.innerWidth > 900 ? { display: 'inline' } : {}) }}>{label}</span>
                </button>
              ))}
            </nav>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* WS status */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 100,
                background: wsConnected ? '#D1FAE5' : '#F3F4F6',
                border: `1.5px solid ${wsConnected ? '#A7F3D0' : '#E5E7EB'}`,
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 11, fontWeight: 800,
                color: wsConnected ? '#065F46' : '#9CA3AF',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: wsConnected ? '#10B981' : '#9CA3AF', animation: wsConnected ? 'pulse-dot 2s infinite' : 'none' }} />
                {wsConnected ? 'LIVE' : 'OFFLINE'}
              </div>

              {/* Task badge */}
              <div style={{
                padding: '7px 14px', borderRadius: 100,
                background: taskCfg.bg, border: `1.5px solid ${taskCfg.border}`,
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 11, fontWeight: 800,
                color: taskCfg.color, textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                {selectedTask}
              </div>

              {/* Download */}
              <button onClick={() => setShowReportModal(true)} disabled={!canDownload} style={{
                width: 36, height: 36, borderRadius: 12,
                background: canDownload ? 'white' : '#F9FAFB',
                border: '1.5px solid rgba(196,181,253,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canDownload ? 'pointer' : 'not-allowed',
                color: canDownload ? '#8B5CF6' : '#D1D5DB',
                transition: 'all 0.2s', boxShadow: canDownload ? '0 2px 8px rgba(109,40,217,0.08)' : 'none',
              }}>
                <Download style={{ width: 15, height: 15 }} />
              </button>

              {/* Settings */}
              <button onClick={() => setShowTaskModal(true)} disabled={isDemoRunning} style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'white', border: '1.5px solid rgba(196,181,253,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isDemoRunning ? 'not-allowed' : 'pointer',
                color: isDemoRunning ? '#D1D5DB' : '#7C6E9C',
                transition: 'all 0.2s',
              }}>
                <Settings2 style={{ width: 15, height: 15 }} />
              </button>

              {/* Launch */}
              <button onClick={handleLaunch} disabled={isDemoRunning} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: isDemoRunning ? '#E5E7EB' : 'linear-gradient(135deg, #9561F4, #7C3AED, #6D28D9)',
                color: isDemoRunning ? '#9CA3AF' : 'white',
                border: 'none', borderRadius: 14,
                padding: '10px 22px',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 13, fontWeight: 800,
                cursor: isDemoRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isDemoRunning ? 'none' : '0 4px 16px rgba(109,40,217,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {isDemoRunning ? (
                  <><div style={{ width: 14, height: 14, border: '2px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Running</>
                ) : (
                  <><Sparkles style={{ width: 14, height: 14 }} /> Run Agent</>
                )}
              </button>
            </div>
          </header>

          {/* ── MAIN CONTENT ── */}
          <div style={{ flex: 1 }}>

            {/* MONITOR */}
            {activeTab === 'monitor' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 380px', gap: 20, minHeight: '680px' }}>

                {/* Left: Document */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F9A8D4' }}>
                        <FileText style={{ width: 14, height: 14, color: '#EC4899' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#5B4E7A', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Active Document</span>
                    </div>
                    {currentDoc && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8B5CF6', background: '#EDE9FE', padding: '3px 10px', borderRadius: 100, fontWeight: 700 }}>{currentDoc.doc_id}</span>}
                  </div>
                  <div style={{
                    background: 'white', borderRadius: 24,
                    border: '1.5px solid rgba(196,181,253,0.3)',
                    overflowY: 'auto', flex: 1,
                    boxShadow: '0 8px 40px -8px rgba(109,40,217,0.06)',
                    minHeight: '580px', maxHeight: '620px',
                    padding: '20px',
                  }}>
                    {currentDoc ? (
                      <>
                        <div style={{ borderBottom: '1px solid rgba(196,181,253,0.2)', paddingBottom: 16, marginBottom: 20 }}>
                          <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 20, color: '#1a0a2e', margin: '0 0 8px' }}>{currentDoc.title}</h3>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>ID: {currentDoc.doc_id}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#8B5CF6', background: '#EDE9FE', padding: '2px 8px', borderRadius: 100 }}>
                              {currentDoc.sections?.length} sections
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {currentDoc.sections.map((sec: any) => {
                            const secId = sec.section_id || sec.id;
                            const isFlagged = findings.some(f => f.clause_ref?.includes(secId));
                            const isActive = activeSection === secId;
                            return (
                              <div key={secId} ref={(el) => { sectionRefs.current[secId] = el; }} style={{
                                padding: '16px 18px', borderRadius: 18, transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                                background: isFlagged ? 'linear-gradient(135deg, #FFF0F3, #FFE4E8)' : isActive ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : '#FAF7FF',
                                border: `1.5px solid ${isFlagged ? '#FECDD3' : isActive ? '#FDE68A' : 'rgba(196,181,253,0.2)'}`,
                                transform: isActive && !isFlagged ? 'scale(1.01)' : 'scale(1)',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                                  <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1a0a2e', margin: 0, flex: 1 }}>{sec.title}</h4>
                                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    {isFlagged && <span style={{ fontSize: 9, fontWeight: 800, color: '#BE123C', background: '#FFE4E6', padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚠ FLAGGED</span>}
                                    {isActive && !isFlagged && <span style={{ fontSize: 9, fontWeight: 800, color: '#78350F', background: '#FEF3C7', padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase' }}>ACTIVE</span>}
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>{secId}</span>
                                  </div>
                                </div>
                                <p style={{ fontSize: 12, lineHeight: 1.65, color: isFlagged ? '#9F1239' : isActive ? '#78350F' : '#6B7280', margin: 0, fontWeight: 500 }}>
                                  {sec.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '40px', textAlign: 'center' }}>
                        <div style={{ width: 72, height: 72, borderRadius: 24, background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #C4B5FD' }}>
                          <FileText style={{ width: 32, height: 32, color: '#8B5CF6' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 18, color: '#1a0a2e', marginBottom: 8, fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontStyle: 'italic' }}>No Document Loaded</p>
                          <p style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 500 }}>Select a task and click Run Agent to begin</p>
                        </div>
                        <button onClick={() => setShowTaskModal(true)} style={{
                          padding: '12px 28px', borderRadius: 100,
                          background: 'linear-gradient(135deg, #9561F4, #7C3AED)',
                          color: 'white', border: 'none', cursor: 'pointer',
                          fontSize: 14, fontWeight: 800,
                          fontFamily: "'Bricolage Grotesque', sans-serif",
                          boxShadow: '0 4px 16px rgba(109,40,217,0.35)',
                          transition: 'all 0.2s',
                        }}>
                          Select Task
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center: Metrics + Chart + Log */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Reward', value: (cumulativeReward >= 0 ? '+' : '') + cumulativeReward.toFixed(2), color: cumulativeReward >= 0 ? '#10B981' : '#EC4899', bg: cumulativeReward >= 0 ? 'linear-gradient(135deg, #D1FAE5, #A7F3D0)' : 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', border: cumulativeReward >= 0 ? '#A7F3D0' : '#F9A8D4', emoji: '📈' },
                      { label: 'Steps', value: String(totalStepsRun), color: '#8B5CF6', bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', border: '#C4B5FD', emoji: '⚡' },
                      { label: 'Findings', value: String(findings.length), color: findings.length > 0 ? '#EC4899' : '#9CA3AF', bg: findings.length > 0 ? 'linear-gradient(135deg, #FCE7F3, #FBCFE8)' : '#F9FAFB', border: findings.length > 0 ? '#F9A8D4' : '#E5E7EB', emoji: '🔍' },
                    ].map((stat, i) => (
                      <div key={i} style={{ background: stat.bg, borderRadius: 20, border: `1.5px solid ${stat.border}`, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 40, opacity: 0.15 }}>{stat.emoji}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: stat.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, opacity: 0.8 }}>{stat.label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 30, fontWeight: 800, color: stat.color, lineHeight: 1, letterSpacing: '-1px' }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Phase indicator */}
                  <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid rgba(196,181,253,0.3)', padding: '16px 20px', boxShadow: '0 4px 16px rgba(109,40,217,0.04)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14, textAlign: 'center' }}>Audit Phase</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      {PHASES.map((phase, i) => {
                        const isActive = currentPhase === phase.id;
                        const isDone = phaseIdx > i;
                        return (
                          <div key={phase.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isActive ? 'linear-gradient(135deg, #9561F4, #7C3AED)' : isDone ? '#D1FAE5' : '#F3F4F6',
                                border: isActive ? 'none' : isDone ? '1.5px solid #A7F3D0' : '1.5px solid #E5E7EB',
                                boxShadow: isActive ? '0 4px 12px rgba(109,40,217,0.3)' : 'none',
                                transition: 'all 0.3s',
                              }}>
                                {isDone ? <CheckCircle2 style={{ width: 16, height: 16, color: '#10B981' }} /> : <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? 'white' : '#9CA3AF' }}>{phase.num}</span>}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? '#8B5CF6' : isDone ? '#10B981' : '#9CA3AF', whiteSpace: 'nowrap' }}>{phase.label}</span>
                            </div>
                            {i < PHASES.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: phaseIdx > i ? '#A7F3D0' : '#F3F4F6', margin: '0 4px', marginBottom: 20, borderRadius: 99, transition: 'background 0.3s' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart */}
                  <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid rgba(196,181,253,0.3)', padding: '16px 20px', boxShadow: '0 4px 16px rgba(109,40,217,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <TrendingUp style={{ width: 15, height: 15, color: '#8B5CF6' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#5B4E7A', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Performance Curve</span>
                    </div>
                    <div style={{ height: 160 }}>
                      <RewardChart data={chartData} />
                    </div>
                  </div>

                  {/* Log */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity style={{ width: 14, height: 14, color: '#8B5CF6' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#5B4E7A', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Agent Log</span>
                    </div>
                    <div style={{
                      background: '#0F0A1F', borderRadius: 20,
                      overflowY: 'auto', flex: 1, maxHeight: 220,
                      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    }}>
                      {logs.map((log, index) => (
                        <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: log.includes("CRITICAL") ? '#EC4899' : log.includes("[USER OVERRIDE]") ? '#F59E0B' : '#8B5CF6', flexShrink: 0, marginTop: 5, opacity: 0.8 }} />
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, color: log.includes("CRITICAL") ? '#FC8989' : log.includes("[USER OVERRIDE]") ? '#FCD34D' : '#A78BFA', margin: 0, fontWeight: 500 }}>{log}</p>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>

                    {/* Steer input */}
                    <form onSubmit={handleSteer} style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <Sparkles style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#8B5CF6' }} />
                        <input
                          type="text" value={steerText}
                          onChange={e => setSteerText(e.target.value)}
                          disabled={steerSending || !isDemoRunning}
                          placeholder={isDemoRunning ? "Steer the agent..." : "Launch agent to use Copilot"}
                          style={{
                            width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                            borderRadius: 14, border: '1.5px solid rgba(196,181,253,0.3)',
                            fontFamily: "'Bricolage Grotesque', sans-serif",
                            fontSize: 13, fontWeight: 500, color: '#1a0a2e',
                            background: 'white', outline: 'none', transition: 'border-color 0.2s',
                          }}
                          onFocus={e => { (e.target as HTMLElement).style.borderColor = '#8B5CF6'; }}
                          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'rgba(196,181,253,0.3)'; }}
                        />
                      </div>
                      <button type="submit" disabled={steerSending || !steerText.trim() || !isDemoRunning} style={{
                        padding: '10px 18px', borderRadius: 14,
                        background: (!steerText.trim() || !isDemoRunning) ? '#F3F4F6' : 'linear-gradient(135deg, #9561F4, #7C3AED)',
                        color: (!steerText.trim() || !isDemoRunning) ? '#9CA3AF' : 'white',
                        border: 'none', cursor: (!steerText.trim() || !isDemoRunning) ? 'not-allowed' : 'pointer',
                        fontFamily: "'Bricolage Grotesque', sans-serif",
                        fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                        transition: 'all 0.2s',
                      }}>
                        {steerSending ? '...' : 'Send'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right: Findings */}
                <FindingsPanel findings={findings} onViewClause={handleViewClause} />
              </div>
            )}

            {activeTab === 'replay' && <div style={{ minHeight: '680px' }}><EpisodeViewer replaySteps={replaySteps.length > 0 ? replaySteps : undefined} document={currentDoc || undefined} /></div>}
            {activeTab === 'leaderboard' && <div style={{ minHeight: '680px' }}><Leaderboard /></div>}
            {activeTab === 'frameworks' && <div style={{ minHeight: '680px' }}><FrameworkExplorer /></div>}
            {activeTab === 'api' && <div style={{ minHeight: '680px' }}><APIReference /></div>}

          </div>
        </div>
      </div>

      {/* Modals */}
      <TaskExplorer show={showTaskModal} onClose={() => setShowTaskModal(false)} onLaunch={handleLaunch} selectedTask={selectedTask} setSelectedTask={setSelectedTask} />
      <ReportModal show={showReportModal} onClose={() => setShowReportModal(false)} findings={findings} chartData={chartData} currentDoc={currentDoc} selectedTask={selectedTask} replaySteps={replaySteps} />

      {/* Incident modal */}
      {activeIncident && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(159, 18, 57, 0.15)', backdropFilter: 'blur(8px)',
          animation: 'float-in 0.3s ease forwards',
        }}>
          <div style={{
            width: 480, background: 'white', borderRadius: 32,
            border: '2px solid #FECDD3', padding: '40px',
            boxShadow: '0 40px 100px rgba(236,72,153,0.2)',
            position: 'relative',
          }}>
            <button onClick={() => setActiveIncident(null)} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 10, border: '1.5px solid #F3F4F6', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
              <X style={{ width: 14, height: 14 }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F9A8D4' }}>
                <AlertOctagon style={{ width: 24, height: 24, color: '#EC4899' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#BE123C', margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif" }}>DATA BREACH INCIDENT</h2>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600 }}>Expert Mode — Live Response Required</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Incident Type', value: activeIncident.incident_type, bg: '#FFF0F3', border: '#FECDD3', color: '#BE123C' },
                { label: 'Records Exposed', value: activeIncident.records_affected?.toLocaleString(), bg: '#FFF0F3', border: '#FECDD3', color: '#9F1239' },
              ].map((item, i) => (
                <div key={i} style={{ background: item.bg, border: `1.5px solid ${item.border}`, borderRadius: 18, padding: '16px 18px' }}>
                  <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 10, fontWeight: 800, color: '#EC4899', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 6px' }}>{item.label}</p>
                  <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, color: item.color, margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #FFF0F3, #FFE4E8)', borderRadius: 16, border: '1.5px solid #FECDD3', marginBottom: 20 }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#9F1239', margin: 0, lineHeight: 1.6 }}>⚡ Agent executing containment protocol — respond within deadline to avoid −0.25/step penalty</p>
            </div>

            <button onClick={() => setActiveIncident(null)} style={{
              width: '100%', padding: '14px', borderRadius: 16,
              border: '1.5px solid rgba(196,181,253,0.3)', background: 'white',
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 14, fontWeight: 700, color: '#7C6E9C', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}>
              <X style={{ width: 15, height: 15 }} /> Dismiss & Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );
}