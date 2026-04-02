import { useState, useRef, useEffect } from 'react';
import { ShieldAlert, FileText, CheckCircle2, AlertTriangle, Activity, ChevronRight, Play, Sparkles } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line } from 'recharts';

// --- INITIAL MOCK DATA ---
const mockDocument = {
  title: "Data Protection Addendum (DPA)",
  version: "v2.1.4",
  sections: [
    { id: "s1", title: "1. Definitions", content: "For the purposes of this Addendum, 'Personal Data' shall have the meaning assigned to it in Article 4 of the GDPR..." },
    { id: "s2", title: "2. Data Retention Periods", content: "The Data Processor shall retain customer personal data for a period of 5 years after the termination of the service agreement, or as otherwise required by standard operational procedures. Upon completion of this period, data may be archived in our secondary storage facilities indefinitely." },
    { id: "s3", title: "3. Sub-processors", content: "The Processor shall not engage another processor without prior specific or general written authorization of the Controller..." },
    { id: "s4", title: "4. Security Measures", content: "All data must be encrypted at rest using AES-256. Access logs must be maintained." },
    { id: "s5", title: "5. Incident Response", content: "In the event of a breach, the Processor will notify the Controller without undue delay. The incident response team will assess the risk and determine next steps." }
  ]
};

// Data we will stream in during the demo
const streamLogs = [
  "Initializing audit sequence for GDPR framework...",
  "Scanning Section 1: Definitions. No compliance gaps detected.",
  "Analyzing Section 2: Data Retention. Flagging '5 years' and 'indefinitely'.",
  "CROSS-REFERENCE: GDPR Article 5(1)(e) requires explicit data minimization.",
  "Generating Gap Finding: Data Retention Period Exceeded.",
  "Scanning Section 5: Incident Response.",
  "Flagging missing 72-hour notification maximum (GDPR Article 33)."
];

export default function App() {
  // State for the ghost demo
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([streamLogs[0]]);
  const [chartData, setChartData] = useState([{ step: 1, reward: 0.05, cumulative: 0.05 }]);
  const [findings, setFindings] = useState<any[]>([]);

  // Auto-scroll ref for the logs
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const runGhostDemo = () => {
    setIsDemoRunning(true);
    setLogs([streamLogs[0]]);
    setChartData([{ step: 1, reward: 0.05, cumulative: 0.05 }]);
    setFindings([]);
    setActiveSection("s1");

    let step = 1;
    
    // Simulate WebSocket stream interval
    const interval = setInterval(() => {
      step++;
      
      if (step === 2) setActiveSection("s1");
      if (step === 3) {
        setActiveSection("s2");
        setLogs(prev => [...prev, streamLogs[1], streamLogs[2]]);
      }
      if (step === 4) {
        setLogs(prev => [...prev, streamLogs[3], streamLogs[4]]);
        setChartData(prev => [...prev, { step, reward: 0.20, cumulative: 0.25 }]);
        setFindings([{ id: 1, type: "data_retention", severity: "high", framework: "GDPR", text: "Data retention clause exceeds GDPR maximum period and implies indefinite storage.", location: "s2" }]);
      }
      if (step === 5) {
        setActiveSection("s5");
        setLogs(prev => [...prev, streamLogs[5], streamLogs[6]]);
      }
      if (step === 6) {
        setChartData(prev => [...prev, { step, reward: 0.15, cumulative: 0.40 }]);
        setFindings(prev => [...prev, { id: 2, type: "breach_notification", severity: "medium", framework: "GDPR", text: "Incident response plan lacks 72-hour maximum escalation protocol.", location: "s5" }]);
        clearInterval(interval);
        setIsDemoRunning(false);
      }
    }, 2000); // Trigger a new step every 2 seconds
  };

  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      <div className="w-full max-w-7xl matte-panel p-8">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-aria-border">
          <h1 className="text-3xl font-light tracking-wide flex items-center gap-3 text-aria-textMain">
            <div className="w-8 h-8 rounded-lg bg-aria-accent flex items-center justify-center shadow-premium">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight">ARIA</span>
          </h1>

          <nav className="flex items-center gap-6 text-sm font-bold text-aria-textMuted uppercase tracking-widest">
            {/* Standard Button (Disabled for now) */}
            <button disabled className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg cursor-not-allowed">
              <Play className="w-4 h-4" /> API Run
            </button>
            
            {/* Ghost Demo Button */}
            <button 
              onClick={runGhostDemo}
              disabled={isDemoRunning}
              className="flex items-center gap-2 bg-aria-accent text-white px-4 py-2 rounded-lg hover:bg-violet-600 transition shadow-premium disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isDemoRunning ? 'Simulating...' : 'Simulate Run'}
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
                    <div key={sec.id} className={`p-4 rounded-xl transition-all duration-500 ${
                      isFlagged ? 'bg-pastel-blush border border-pastel-blushBorder shadow-sm' : 
                      isActive ? 'bg-pastel-peach border border-pastel-peachBorder shadow-sm scale-[1.02]' : 'hover:bg-gray-50 border border-transparent'
                    }`}>
                      <h4 className="font-semibold text-aria-textMain mb-2 font-sans text-sm">{sec.title}</h4>
                      <p className={`text-sm leading-relaxed ${isFlagged ? 'text-pastel-blushText' : isActive ? 'text-pastel-peachText' : 'text-gray-600'}`}>
                        {sec.content}
                      </p>
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
                   <div key={index} className="flex gap-3 items-start border-b border-aria-border pb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="min-w-6 mt-0.5"><Activity className="w-4 h-4 text-aria-accent" /></div>
                      <p className="text-xs leading-relaxed text-aria-textMuted">{log}</p>
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
                          {finding.severity === 'high' ? 
                            <ShieldAlert className="w-4 h-4 text-pastel-blushText" /> : 
                            <AlertTriangle className="w-4 h-4 text-pastel-peachText" />
                          }
                          <span className="text-xs font-bold uppercase tracking-wider text-aria-textMain">{finding.framework} Gap</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase border ${
                          finding.severity === 'high' 
                            ? 'bg-pastel-blush text-pastel-blushText border-pastel-blushBorder' 
                            : 'bg-pastel-peach text-pastel-peachText border-pastel-peachBorder'
                        }`}>
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
    </div>
  )
}