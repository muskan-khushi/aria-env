import { useState, useEffect } from 'react';
import { FastForward, Rewind, PlayCircle, PauseCircle, FileText, Activity, Code2 } from 'lucide-react';

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
          if (prev >= replaySteps.length) { setIsPlayingReplay(false); return prev; }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isPlayingReplay, replaySteps.length]);

  const currentStepData = replaySteps[replayStep - 1] || replaySteps[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: '680px' }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 20, minHeight: 0 }}>

        {/* Step Inspector */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.3)',
          overflow: 'hidden', boxShadow: '0 8px 40px -8px rgba(109,40,217,0.06)',
        }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(196,181,253,0.2)', background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity style={{ width: 14, height: 14, color: '#8B5CF6' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#5B4E7A', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Step Inspector</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {replaySteps.map((s) => (
              <div key={s.step} onClick={() => setReplayStep(s.step)} style={{
                padding: '14px 16px', borderRadius: 16, cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                background: replayStep === s.step ? 'linear-gradient(135deg, #EDE9FE, #DDD6FE)' : '#FAF7FF',
                border: `1.5px solid ${replayStep === s.step ? '#C4B5FD' : 'rgba(196,181,253,0.2)'}`,
                transform: replayStep === s.step ? 'scale(1.02)' : 'scale(1)',
                boxShadow: replayStep === s.step ? '0 4px 16px rgba(139,92,246,0.15)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: replayStep === s.step ? '#8B5CF6' : '#9CA3AF' }}>Step {s.step}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                    background: s.reward > 0 ? '#D1FAE5' : '#F3F4F6',
                    color: s.reward > 0 ? '#065F46' : '#9CA3AF',
                  }}>
                    {s.reward > 0 ? `+${s.reward.toFixed(2)}` : s.reward.toFixed(2)} R
                  </span>
                </div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: replayStep === s.step ? '#6D28D9' : '#374151', margin: 0, lineHeight: 1.4 }}>{s.action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Document viewer */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.3)',
          overflow: 'hidden', boxShadow: '0 8px 40px -8px rgba(109,40,217,0.06)',
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(196,181,253,0.2)', background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText style={{ width: 14, height: 14, color: '#EC4899' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#5B4E7A', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Document View</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#8B5CF6', background: '#EDE9FE', padding: '3px 10px', borderRadius: 100 }}>@ Step {replayStep}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {document?.sections?.map((sec: any) => {
              const secId = sec.section_id || sec.id;
              const isActive = currentStepData?.highlight === secId;
              const isFlagged = currentStepData?.flag === secId;
              return (
                <div key={secId} style={{
                  padding: '20px', borderRadius: 20, transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                  background: isFlagged ? 'linear-gradient(135deg, #FFF0F3, #FFE4E8)' : isActive ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : '#FAF7FF',
                  border: `1.5px solid ${isFlagged ? '#FECDD3' : isActive ? '#FDE68A' : 'rgba(196,181,253,0.2)'}`,
                  transform: isActive && !isFlagged ? 'scale(1.01)' : 'scale(1)',
                  boxShadow: (isActive || isFlagged) ? '0 8px 24px rgba(0,0,0,0.06)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h4 style={{ fontWeight: 800, color: '#1a0a2e', fontSize: 14, margin: 0 }}>{sec.title}</h4>
                    {isFlagged && <span style={{ fontSize: 10, fontWeight: 800, color: '#BE123C', background: '#FFE4E6', padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚠ FLAGGED</span>}
                    {isActive && !isFlagged && <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E', background: '#FEF3C7', padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.08em' }}>ACTIVE</span>}
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: isFlagged ? '#9F1239' : isActive ? '#78350F' : '#6B7280', margin: 0, fontWeight: 500 }}>{sec.content}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* State JSON */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#0F0A1F', borderRadius: 24,
          overflow: 'hidden', boxShadow: '0 8px 40px -8px rgba(0,0,0,0.3)',
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139,92,246,0.3)' }}>
              <Code2 style={{ width: 14, height: 14, color: '#A78BFA' }} />
            </div>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 11, fontWeight: 800, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.14em' }}>State JSON</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#6D28D9', background: 'rgba(109,40,217,0.2)', padding: '3px 10px', borderRadius: 100 }}>@ {replayStep}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <pre style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 11, color: '#C4B5FD',
              lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {JSON.stringify(currentStepData?.rawJson || currentStepData, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div style={{
        background: 'white', borderRadius: 20,
        border: '1.5px solid rgba(196,181,253,0.3)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 4px 20px rgba(109,40,217,0.06)',
      }}>
        <button onClick={() => setReplayStep(1)} style={{ padding: 8, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        >
          <Rewind style={{ width: 18, height: 18 }} />
        </button>
        <button onClick={() => setIsPlayingReplay(!isPlayingReplay)} style={{
          padding: 4, color: '#8B5CF6', background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
          border: '1.5px solid #C4B5FD', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {isPlayingReplay ? <PauseCircle style={{ width: 36, height: 36 }} /> : <PlayCircle style={{ width: 36, height: 36 }} />}
        </button>
        <button onClick={() => setReplayStep(replaySteps.length)} style={{ padding: 8, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, transition: 'all 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        >
          <FastForward style={{ width: 18, height: 18 }} />
        </button>

        <div style={{ flex: 1, margin: '0 8px', position: 'relative' }}>
          <input
            type="range" min="1" max={replaySteps.length || 1} value={replayStep}
            onChange={e => { setReplayStep(Number(e.target.value)); setIsPlayingReplay(false); }}
            style={{ width: '100%', height: 6, accentColor: '#8B5CF6', cursor: 'pointer', borderRadius: 99 }}
          />
        </div>

        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13, fontWeight: 800, color: '#8B5CF6',
          background: '#EDE9FE', padding: '6px 14px', borderRadius: 100,
          border: '1.5px solid #C4B5FD', whiteSpace: 'nowrap',
        }}>
          {replayStep} / {replaySteps.length}
        </span>
      </div>
    </div>
  );
}