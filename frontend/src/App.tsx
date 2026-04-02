import { useState, useRef, useEffect } from 'react';
import { 
  ShieldAlert, FileText, CheckCircle2, AlertTriangle, Activity, 
  ChevronRight, Play, Sparkles, Settings2, Zap, Layers, Swords, Siren, Wand2, X, AlertOctagon, Clock
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line } from 'recharts';

// --- MOCK DATA ---
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

const taskTiers = [
  { id: 'easy', name: 'Single-Doc GDPR', icon: Zap, desc: 'Direct pattern matching on a single document.', frameworks: 'GDPR', steps: 15 },
  { id: 'medium', name: 'Cross-Doc Review', icon: Layers, desc: 'Multi-document relational reasoning with contradictions.', frameworks: 'GDPR, CCPA', steps: 25 },
  { id: 'hard', name: 'Multi-Framework Conflict', icon: Swords, desc: 'Adversarial clauses and cross-framework conflicts.', frameworks: 'GDPR, HIPAA, CCPA', steps: 40 },
  { id: 'expert', name: 'Incident Response Suite', icon: Siren, desc: 'Dual-task: Live data breach mid-audit.', frameworks: 'All Frameworks', steps: 60 },
  { id: 'procedural', name: 'Procedural Generation', icon: Wand2, desc: 'Zero-shot novel company profiles via GPT-4o-mini.', frameworks: 'Variable', steps: '∞' },
];

export default function App() {
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>(["Awaiting run initialization..."]);
  const [chartData, setChartData] = useState([{ step: 0, reward: 0, cumulative: 0 }]);
  const [findings, setFindings] = useState<any[]>([]);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState('easy');
  
  // Incident State
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
      
      // EXPERT MODE TRIGGER
      if (step === 4 && selectedTask === 'expert') {
        setActiveIncident({
          type: "Unauthorized DB Access",
          records: "50,000+ exposed",
          deadline: "72 Hours (GDPR)",
          status: "ACTION REQUIRED"
        });
        setLogs(prev => [...prev, "CRITICAL ALERT: Live data breach detected in telemetry.", "Agent suspending audit to execute Incident Response protocols."]);
        clearInterval(interval);
        
        // Auto-resolve incident after 4 seconds to show agent taking action
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
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-aria-border">
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-3 text-aria-textMain">
            <div className="w-8 h-8 rounded-lg bg-aria-accent flex items-center justify-center shadow-premium">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight">ARIA</span>
            <span className="ml-4 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-widest border border-gray-200">
              {taskTiers.find(t => t.id === selectedTask)?.name}
            </span>
          </h1>

          <nav className="flex items-center gap-4 text-sm font-bold text-aria-textMuted uppercase tracking-widest">
            <button onClick={() => setShowTaskModal(true)} disabled={isDemoRunning} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition text-aria-textMain disabled:opacity-50">
              <Settings2 className="w-4 h-4" /> Configure Task
            </button>
            <button onClick={runGhostDemo} disabled={isDemoRunning} className="flex items-center gap-2 bg-aria-accent text-white px-5 py-2.5 rounded-lg hover:bg-violet-600 transition shadow-premium disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              {isDemoRunning ? 'Simulating...' : 'Launch Agent'}
            </button>
          </nav>
        </header>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-12 gap-6 h-[650px]">
          {/* LEFT: DOCUMENT VIEWER */}
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

          {/* CENTER: METRICS & STREAM */}
          <div className="col-span-4 flex flex-col gap-6">
            <div className="flex-1 flex flex-col gap-3">
               <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest pl-1">Performance Curve</h2>
               <div className="flex-1 matte-panel p-4 bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DDF4" />
                      <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5B81' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5B81' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(109, 40, 217, 0.1)' }} />
                      <Bar dataKey="reward" fill="#EDE9FE" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="cumulative" stroke="#6D28D9" strokeWidth={3} dot={{ r: 4, fill: '#6D28D9', strokeWidth: 0 }} isAnimationActive={true} />
                    </ComposedChart>
                  </ResponsiveContainer>
               </div>
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

           {/* RIGHT: FINDINGS PANEL */}
           <div className="col-span-4 flex flex-col gap-3">
             <div className="flex items-center justify-between pl-1">
                <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest">Audit Findings</h2>
                <span className="bg-pastel-blush text-pastel-blushText border border-pastel-blushBorder text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {findings.length} ACTIVE
                </span>
             </div>
             <div className="flex-1 matte-panel p-5 overflow-y-auto bg-gray-50/30 flex flex-col gap-4 pr-2">
                {findings.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-aria-textMuted italic">Awaiting findings...</div>
                ) : (
                  findings.map((finding) => (
                    <div key={finding.id} className="bg-white border border-aria-border p-4 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-500">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {finding.severity === 'high' ? <ShieldAlert className="w-4 h-4 text-pastel-blushText" /> : <AlertTriangle className="w-4 h-4 text-pastel-peachText" />}
                          <span className="text-xs font-bold uppercase tracking-wider text-aria-textMain">{finding.framework} Gap</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase border ${finding.severity === 'high' ? 'bg-pastel-blush text-pastel-blushText border-pastel-blushBorder' : 'bg-pastel-peach text-pastel-peachText border-pastel-peachBorder'}`}>
                          {finding.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-aria-textMuted mb-4 leading-relaxed">{finding.text}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-aria-border">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-pastel-sageText">
                          <CheckCircle2 className="w-4 h-4" /> Evidence Cited
                        </div>
                        <button className="text-xs font-bold text-aria-accent hover:text-aria-textMain flex items-center gap-1 transition">
                          View Clause <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>
        </div>
      </div>

      {/* TASK EXPLORER MODAL OVERLAY */}
      {showTaskModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-aria-bg/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-white border border-aria-border shadow-premium rounded-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-aria-border">
              <div>
                <h2 className="text-xl font-bold text-aria-textMain">Environment Configuration</h2>
                <p className="text-sm text-aria-textMuted mt-1">Select an audit scenario to initialize the ARIA agent.</p>
              </div>
              <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition text-aria-textMuted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 bg-[#FAFAFD]">
              {taskTiers.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTask === tier.id;
                return (
                  <div 
                    key={tier.id}
                    onClick={() => setSelectedTask(tier.id)}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col gap-3 ${
                      isSelected ? 'border-aria-accent bg-white shadow-md' : 'border-aria-border bg-white/50 hover:bg-white hover:border-aria-accentLight'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-aria-accentLight text-aria-accent' : 'bg-gray-100 text-gray-500'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-aria-textMain">{tier.name}</h3>
                          <span className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest">{tier.id} Tier</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-aria-textMuted">{tier.desc}</p>
                    <div className="flex items-center gap-4 mt-2 pt-3 border-t border-aria-border/50 text-xs font-semibold text-aria-textMuted">
                      <span><span className="text-aria-textMain">Scope:</span> {tier.frameworks}</span>
                      <span><span className="text-aria-textMain">Budget:</span> {tier.steps} Steps</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-6 border-t border-aria-border flex justify-end gap-4 bg-white rounded-b-2xl">
              <button onClick={() => setShowTaskModal(false)} className="px-5 py-2.5 rounded-lg font-semibold text-aria-textMuted hover:bg-gray-100 transition">
                Cancel
              </button>
              <button onClick={() => { setShowTaskModal(false); runGhostDemo(); }} className="px-6 py-2.5 rounded-lg font-semibold bg-aria-textMain text-white hover:bg-aria-accent transition shadow-md flex items-center gap-2">
                <Play className="w-4 h-4" /> Load Scenario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPERT MODE INCIDENT MODAL OVERLAY */}
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