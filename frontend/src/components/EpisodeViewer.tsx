import { useState, useEffect } from 'react';
import { FastForward, Rewind, PlayCircle, PauseCircle, FileText } from 'lucide-react';

const mockDocument = {
  title: "Data Protection Addendum (DPA)",
  version: "v2.1.4",
  sections: [
    { id: "s1", title: "1. Definitions", content: "For the purposes of this Addendum, 'Personal Data' shall have the meaning assigned to it in Article 4 of the GDPR..." },
    { id: "s2", title: "2. Data Retention", content: "The Processor shall retain customer data for 5 years. Upon completion, data may be archived indefinitely." },
    { id: "s3", title: "3. Sub-processors", content: "The Processor shall not engage another processor without prior authorization..." }
  ]
};

const mockReplaySteps = [
  { step: 1, action: "request_section (s1)", reward: 0.0, desc: "Reading Definitions...", highlight: 's1', flag: null },
  { step: 2, action: "request_section (s2)", reward: 0.0, desc: "Reading Data Retention...", highlight: 's2', flag: null },
  { step: 3, action: "identify_gap (data_retention)", reward: 0.20, desc: "Flagged indefinite retention.", highlight: null, flag: 's2' },
  { step: 4, action: "cite_evidence (s2.p1)", reward: 0.12, desc: "Cited evidence for gap.", highlight: 's2', flag: 's2' },
  { step: 5, action: "submit_remediation", reward: 0.15, desc: "Proposed 24-month limit.", highlight: null, flag: 's2' }
];

export default function EpisodeViewer({ replaySteps = mockReplaySteps, document = mockDocument }: { replaySteps?: any[], document?: any }) {
  const [replayStep, setReplayStep] = useState(1);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isPlayingReplay) {
      interval = setInterval(() => {
        setReplayStep(prev => {
          if (prev >= replaySteps.length) {
            setIsPlayingReplay(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isPlayingReplay]);

  const currentStepData = replaySteps[replayStep - 1] || replaySteps[0];

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex-1 grid grid-cols-12 gap-6 h-full">
        {/* Left: Replay Action Log */}
        <div className="col-span-3 matte-panel p-6 bg-white flex flex-col">
          <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest mb-4">Step Inspector</h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
            {replaySteps.map((s) => (
              <div key={s.step} onClick={() => setReplayStep(s.step)} className={`p-4 rounded-xl border cursor-pointer transition-all ${replayStep === s.step ? 'bg-aria-accentLight border-aria-accent shadow-sm' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-aria-textMuted">Step {s.step}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.reward > 0 ? 'bg-pastel-sage text-pastel-sageText' : 'bg-gray-200 text-gray-600'}`}>
                    +{s.reward.toFixed(2)} R
                  </span>
                </div>
                <p className="text-sm font-bold text-aria-textMain font-mono">{s.action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Replay Document Viewer (The Fix) */}
        <div className="col-span-5 matte-panel p-6 bg-white flex flex-col">
          <div className="flex items-center gap-2 mb-4 border-b border-aria-border pb-2">
            <FileText className="w-4 h-4 text-aria-textMuted" />
            <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest">Document View @ Step {replayStep}</h2>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 font-serif">
            {document?.sections?.map((sec: any) => {
              const secId = sec.section_id || sec.id;
              const isActive = currentStepData?.highlight === secId;
              const isFlagged = currentStepData?.flag === secId;
              
              return (
                <div key={secId} className={`p-4 rounded-xl transition-all duration-300 ${isFlagged ? 'bg-pastel-blush border border-pastel-blushBorder shadow-sm' : isActive ? 'bg-pastel-peach border border-pastel-peachBorder shadow-sm scale-[1.02]' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <h4 className="font-semibold text-aria-textMain mb-2 font-sans text-sm">{sec.title}</h4>
                  <p className={`text-sm leading-relaxed ${isFlagged ? 'text-pastel-blushText' : isActive ? 'text-pastel-peachText' : 'text-gray-600'}`}>{sec.content}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Observation State */}
        <div className="col-span-4 matte-panel p-6 bg-[#FAFAFD] flex flex-col gap-4">
          <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest border-b border-aria-border pb-2">State JSON @ Step {replayStep}</h2>
          <pre className="text-xs font-mono text-aria-textMuted overflow-auto bg-white p-4 rounded-xl border border-aria-border h-full">
{JSON.stringify(currentStepData?.rawJson || currentStepData, null, 2)}
          </pre>
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="h-20 matte-panel bg-white p-4 flex items-center gap-6">
        <button onClick={() => setReplayStep(1)} className="p-2 text-aria-textMuted hover:text-aria-textMain transition"><Rewind className="w-5 h-5" /></button>
        <button onClick={() => setIsPlayingReplay(!isPlayingReplay)} className="p-2 text-aria-accent hover:text-violet-700 transition">
          {isPlayingReplay ? <PauseCircle className="w-8 h-8" /> : <PlayCircle className="w-8 h-8" />}
        </button>
        <button onClick={() => setReplayStep(replaySteps.length)} className="p-2 text-aria-textMuted hover:text-aria-textMain transition"><FastForward className="w-5 h-5" /></button>
        
        <div className="flex-1 mx-4 relative flex items-center">
          <input 
            type="range" min="1" max={replaySteps.length || 1} value={replayStep} 
            onChange={(e) => { setReplayStep(Number(e.target.value)); setIsPlayingReplay(false); }}
            className="w-full accent-aria-accent h-2 rounded-lg appearance-none bg-gray-200 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}