import { useState, useRef } from 'react';
import { X, Play, Zap, Layers, Swords, Siren, Sparkles, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useARIAEnv } from '../hooks/useARIAEnv';

const taskTiers = [
  {
    id: 'easy', name: 'Single-Doc GDPR', icon: Zap, emoji: '🌱',
    desc: 'Direct pattern matching on a single GDPR document. 3 gaps, 1 red herring.',
    frameworks: ['GDPR'], steps: 15, gaps: 3,
    color: '#10B981', bg: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', border: '#6EE7B7', lightBg: '#F0FDF4',
  },
  {
    id: 'medium', name: 'Cross-Doc Review', icon: Layers, emoji: '🌸',
    desc: 'Multi-document DPA + Privacy Policy with contradictions. 5 gaps, 1 conflict.',
    frameworks: ['GDPR', 'CCPA'], steps: 25, gaps: 5,
    color: '#8B5CF6', bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', border: '#C4B5FD', lightBg: '#F3EEFF',
  },
  {
    id: 'hard', name: 'Multi-Framework', icon: Swords, emoji: '🔥',
    desc: 'Adversarial clauses and cross-framework conflicts. 8 gaps, 2 conflicts.',
    frameworks: ['GDPR', 'HIPAA', 'CCPA'], steps: 40, gaps: 8,
    color: '#F97316', bg: 'linear-gradient(135deg, #FFEDD5, #FED7AA)', border: '#FDBA74', lightBg: '#FFF7ED',
  },
  {
    id: 'expert', name: 'Incident Suite', icon: Siren, emoji: '⚡',
    desc: 'Dual-task: live data breach at step 25 mid-audit. 10 gaps, 3 conflicts.',
    frameworks: ['GDPR', 'HIPAA', 'CCPA', 'SOC2'], steps: 60, gaps: 10,
    color: '#EC4899', bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', border: '#F9A8D4', lightBg: '#FDF2F8',
  },
  {
    id: 'blind', name: 'Blind Test', icon: Sparkles, emoji: '🕶️',
    desc: 'Paraphrased language — no trigger phrases. Tests genuine regulatory reasoning.',
    frameworks: ['GDPR', 'CCPA'], steps: 25, gaps: 6,
    color: '#6D28D9', bg: 'linear-gradient(135deg, #EDE9FE, #C4B5FD)', border: '#A78BFA', lightBg: '#F5F3FF',
  },
  {
    id: 'custom', name: 'Upload Your Doc', icon: Upload, emoji: '📄',
    desc: 'Audit your own corporate policies, terms of service, or BAA drafts.',
    frameworks: ['Custom'], steps: 'Dyn', gaps: '?',
    color: '#0EA5E9', bg: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)', border: '#7DD3FC', lightBg: '#F0F9FF',
  },
];

interface TaskExplorerProps {
  show: boolean;
  onClose: () => void;
  onLaunch: () => void;
  selectedTask: string;
  setSelectedTask: (id: string) => void;
}

export default function TaskExplorer({ show, onClose, onLaunch, selectedTask, setSelectedTask }: TaskExplorerProps) {
  const [customFilename, setCustomFilename] = useState("Company_Policy.txt");
  const [customContent, setCustomContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startDemo, isLoading } = useARIAEnv();

  if (!show) return null;

  const handleFileRead = (file: File) => {
    setCustomFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => { setCustomContent(e.target?.result as string || ''); setUploadSuccess(false); };
    reader.readAsText(file);
  };

  const handleLaunchClick = async () => {
    if (selectedTask === 'custom') {
      if (!customContent.trim()) return;
      setIsUploading(true);
      try {
        const API_BASE = window.location.hostname === "localhost" ? "http://localhost:7860" : "";
        const res = await fetch(`${API_BASE}/aria/upload/custom`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: customFilename, content: customContent })
        });
        if (res.ok) setUploadSuccess(true);
      } catch (err) { console.error("Upload failed", err); }
      finally { setIsUploading(false); }
    }
    await startDemo(selectedTask);
    onLaunch();
    onClose();
  };

  const selectedTier = taskTiers.find(t => t.id === selectedTask);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: 'rgba(250,247,255,0.6)',
      backdropFilter: 'blur(12px)',
      fontFamily: "'Bricolage Grotesque', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 920,
        background: 'white', borderRadius: 32,
        border: '1.5px solid rgba(196,181,253,0.4)',
        boxShadow: '0 40px 100px rgba(109,40,217,0.12)',
        overflow: 'hidden', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        animation: 'float-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px', borderBottom: '1px solid rgba(196,181,253,0.2)', background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a0a2e', margin: 0, letterSpacing: '-0.5px' }}>Choose a Task</h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: '4px 0 0', fontWeight: 500 }}>Select a scenario to initialize the ARIA audit agent</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12, border: '1.5px solid rgba(196,181,253,0.3)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FCE7F3'; (e.currentTarget as HTMLElement).style.color = '#EC4899'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Task grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: '24px', background: '#FAF7FF', overflowY: 'auto', flex: 1 }}>
          {taskTiers.map(tier => {
            // const Icon = tier.icon;
            const isSelected = selectedTask === tier.id;
            return (
              <div key={tier.id} onClick={() => { setSelectedTask(tier.id); setUploadSuccess(false); }} style={{
                padding: '22px', borderRadius: 22, cursor: 'pointer',
                background: isSelected ? tier.bg : 'white',
                border: `2px solid ${isSelected ? tier.border : 'rgba(196,181,253,0.2)'}`,
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isSelected ? `0 12px 32px ${tier.color}20` : '0 2px 8px rgba(109,40,217,0.04)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isSelected ? tier.color : 'transparent', borderRadius: '22px 22px 0 0', transition: 'background 0.3s' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: isSelected ? `${tier.color}20` : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s' }}>
                      {tier.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a0a2e' }}>{tier.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: isSelected ? tier.color : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tier.id}</span>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 style={{ width: 18, height: 18, color: tier.color, flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.55, fontWeight: 500 }}>{tier.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: `1px dashed ${isSelected ? tier.border : 'rgba(196,181,253,0.2)'}` }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tier.frameworks.map(fw => (
                      <span key={fw} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: isSelected ? `${tier.color}15` : '#F3F4F6', color: isSelected ? tier.color : '#9CA3AF', border: `1px solid ${isSelected ? tier.border : 'transparent'}` }}>
                        {fw}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700 }}>⏱{tier.steps} · 🔍{tier.gaps}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Context panels */}
        {selectedTier && (
          <div style={{ padding: '0 24px', flexShrink: 0 }}>
            {selectedTask === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>Document Title</label>
                    <input type="text" value={customFilename} onChange={e => setCustomFilename(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 14, border: '1.5px solid rgba(196,181,253,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#1a0a2e', background: 'white', outline: 'none' }}
                      placeholder="Privacy_Policy.txt"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>Upload</label>
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                      borderRadius: 14, border: '1.5px solid rgba(196,181,253,0.3)',
                      background: 'white', cursor: 'pointer', fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontSize: 13, fontWeight: 700, color: '#8B5CF6',
                    }}>
                      <FileText style={{ width: 14, height: 14 }} /> Browse
                    </button>
                    <input ref={fileInputRef} type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])} />
                  </div>
                </div>
                <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileRead(f); }}
                  style={{ border: `2px dashed ${dragOver ? '#8B5CF6' : 'rgba(196,181,253,0.4)'}`, borderRadius: 18, padding: '12px 16px', background: dragOver ? '#F3EEFF' : 'transparent', transition: 'all 0.2s' }}>
                  <textarea value={customContent} onChange={e => setCustomContent(e.target.value)}
                    style={{ width: '100%', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, height: 80, resize: 'none', border: 'none', background: 'transparent', outline: 'none', color: '#1a0a2e' }}
                    placeholder="Paste document content here, or drag & drop a .txt file..."
                  />
                </div>
                {uploadSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#D1FAE5', borderRadius: 14, border: '1px solid #A7F3D0', fontSize: 13, fontWeight: 700, color: '#065F46' }}>
                    <CheckCircle2 style={{ width: 16, height: 16 }} /> Uploaded successfully!
                  </div>
                )}
              </div>
            )}
            {selectedTask === 'blind' && (
              <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'linear-gradient(135deg, #EDE9FE, #F3EEFF)', borderRadius: 18, border: '1.5px solid #C4B5FD', marginBottom: 4, marginTop: 8 }}>
                <AlertCircle style={{ width: 16, height: 16, color: '#8B5CF6', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: '#5B21B6', margin: 0, fontWeight: 600, lineHeight: 1.5 }}>Paraphrased language — no heuristic trigger phrases match. Agent must reason from first principles. Expected score ~0.36.</p>
              </div>
            )}
            {selectedTask === 'expert' && (
              <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'linear-gradient(135deg, #FCE7F3, #FFE4E8)', borderRadius: 18, border: '1.5px solid #F9A8D4', marginBottom: 4, marginTop: 8 }}>
                <Siren style={{ width: 16, height: 16, color: '#EC4899', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: '#9D174D', margin: 0, fontWeight: 600, lineHeight: 1.5 }}>At step 25, a data breach fires. Agent must contain, document, notify DPO + supervisory authority within 8 steps or face −0.25/step penalty.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(196,181,253,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>
            {selectedTier && (
              <span><strong style={{ color: '#1a0a2e' }}>{selectedTier.name}</strong> · {selectedTier.steps} max steps · ~{typeof selectedTier.gaps === 'number' ? selectedTier.gaps : '?'} gaps</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 14, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: '#7C6E9C', background: 'white', border: '1.5px solid rgba(196,181,253,0.3)', cursor: 'pointer', transition: 'all 0.2s' }}>Cancel</button>
            <button disabled={isLoading || isUploading || (selectedTask === 'custom' && !customContent.trim())} onClick={handleLaunchClick} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 26px', borderRadius: 14,
              fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 800,
              color: 'white', border: 'none', cursor: (isLoading || isUploading) ? 'not-allowed' : 'pointer',
              background: (isLoading || isUploading) ? '#E5E7EB' : 'linear-gradient(135deg, #9561F4, #7C3AED)',
              boxShadow: (isLoading || isUploading) ? 'none' : '0 4px 16px rgba(109,40,217,0.35)',
              transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {(isLoading || isUploading) ? (
                <><div style={{ width: 14, height: 14, border: '2px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Starting...</>
              ) : (
                <><Play style={{ width: 15, height: 15 }} /> Launch Agent</>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float-in { 0% { opacity: 0; transform: scale(0.94) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}