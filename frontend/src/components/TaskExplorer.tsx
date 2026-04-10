import { useState, useRef } from 'react';
import { X, Play, Zap, Layers, Swords, Siren, Dna, Upload, FileText, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useARIAEnv } from '../hooks/useARIAEnv';

const taskTiers = [
  { 
    id: 'easy', 
    name: 'Single-Doc GDPR', 
    icon: Zap, 
    desc: 'Direct pattern matching on a single GDPR document. 3 gaps, 1 red herring.',
    frameworks: ['GDPR'],
    steps: 15,
    gaps: 3,
    color: '#059669',
    bg: '#F0FDF4',
    border: '#A7F3D0',
  },
  { 
    id: 'medium', 
    name: 'Cross-Doc Review', 
    icon: Layers, 
    desc: 'Multi-document DPA + Privacy Policy with contradictions. 5 gaps, 1 conflict.',
    frameworks: ['GDPR', 'CCPA'],
    steps: 25,
    gaps: 5,
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  { 
    id: 'hard', 
    name: 'Multi-Framework Conflict', 
    icon: Swords, 
    desc: 'Adversarial clauses and cross-framework conflicts. 8 gaps, 2 conflicts.',
    frameworks: ['GDPR', 'HIPAA', 'CCPA'],
    steps: 40,
    gaps: 8,
    color: '#EA580C',
    bg: '#FFF7ED',
    border: '#FDBA74',
  },
  { 
    id: 'expert', 
    name: 'Incident Response Suite', 
    icon: Siren, 
    desc: 'Dual-task challenge: live data breach at step 25 mid-audit. 10 gaps, 3 conflicts.',
    frameworks: ['GDPR', 'HIPAA', 'CCPA', 'SOC2'],
    steps: 60,
    gaps: 10,
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
  { 
    id: 'blind', 
    name: 'Blind Generalisation', 
    icon: Sparkles, 
    desc: 'Paraphrased language — no trigger phrases. Tests genuine regulatory reasoning.',
    frameworks: ['GDPR', 'CCPA'],
    steps: 25,
    gaps: 6,
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  { 
    id: 'custom', 
    name: 'Upload Your Document', 
    icon: Upload, 
    desc: 'Audit your own corporate policies, terms of service, or BAA drafts.',
    frameworks: ['Custom'],
    steps: 'Dynamic',
    gaps: '?',
    color: '#0891B2',
    bg: '#ECFEFF',
    border: '#A5F3FC',
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
  const [seed, setSeed] = useState<number>(42);
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
    reader.onload = (e) => {
      setCustomContent(e.target?.result as string || '');
      setUploadSuccess(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const handleLaunchClick = async () => {
    if (selectedTask === 'custom') {
      if (!customContent.trim()) return;
      setIsUploading(true);
      setUploadSuccess(false);
      try {
        const API_BASE = window.location.hostname === "localhost" ? "http://localhost:7860" : "";
        const res = await fetch(`${API_BASE}/aria/upload/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: customFilename, content: customContent })
        });
        if (res.ok) setUploadSuccess(true);
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setIsUploading(false);
      }
    }

    await startDemo(selectedTask); 
    onLaunch(); 
    onClose();
  };

  const selectedTier = taskTiers.find(t => t.id === selectedTask);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-aria-bg/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-white border border-aria-border shadow-2xl rounded-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-aria-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-aria-textMain">Environment Configuration</h2>
            <p className="text-xs text-aria-textMuted mt-0.5">Select an audit scenario to initialize the ARIA agent.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition text-aria-textMuted">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Task grid */}
        <div className="grid grid-cols-3 gap-3 p-5 bg-[#FAFAFD] overflow-y-auto flex-1">
          {taskTiers.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selectedTask === tier.id;
            return (
              <div key={tier.id} className="flex flex-col gap-2">
                <div 
                  onClick={() => { setSelectedTask(tier.id); setUploadSuccess(false); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col gap-2 h-full ${
                    isSelected 
                      ? 'shadow-md scale-[1.01]' 
                      : 'border-aria-border bg-white/50 hover:bg-white hover:border-gray-300'
                  }`}
                  style={isSelected ? { borderColor: tier.color, background: tier.bg } : {}}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ background: isSelected ? tier.color : '#F3F4F6' }}>
                        <Icon className="w-4 h-4" style={{ color: isSelected ? 'white' : '#6B7280' }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-aria-textMain">{tier.name}</h3>
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: tier.color }}>{tier.id} tier</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-aria-textMuted flex-1 leading-relaxed">{tier.desc}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] font-semibold text-aria-textMuted">
                    <span className="flex gap-1 flex-wrap">
                      {tier.frameworks.map(fw => (
                        <span key={fw} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" 
                          style={{ background: isSelected ? `${tier.color}20` : '#F3F4F6', color: isSelected ? tier.color : '#6B7280' }}>
                          {fw}
                        </span>
                      ))}
                    </span>
                    <div className="flex gap-2">
                      <span title="Step budget">⏱ {tier.steps}</span>
                      <span title="Gaps to find">🔍 {tier.gaps}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Context panel for selected task */}
        {selectedTier && (
          <div className="px-5 pb-3 border-t border-aria-border bg-white flex-shrink-0">
            {/* Custom upload UI */}
            {selectedTask === 'custom' && (
              <div className="pt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest block mb-1">Document Title</label>
                    <input 
                      type="text" 
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-aria-border font-mono text-xs focus:outline-none focus:border-aria-accent"
                      placeholder="Privacy_Policy.txt"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest block mb-1">Upload File</label>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-aria-border text-xs font-semibold text-aria-textMuted hover:bg-gray-50 transition"
                    >
                      <FileText className="w-3.5 h-3.5" /> Browse
                    </button>
                    <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])} />
                  </div>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-3 transition-all ${dragOver ? 'border-aria-accent bg-aria-accentLight' : 'border-aria-border'}`}
                >
                  <textarea 
                    value={customContent}
                    onChange={(e) => { setCustomContent(e.target.value); setUploadSuccess(false); }}
                    className="w-full font-mono text-xs h-24 resize-none focus:outline-none bg-transparent"
                    placeholder="Paste your document content here, or drag & drop a .txt file above..."
                  />
                  {!customContent && (
                    <p className="text-[10px] text-aria-textMuted text-center">Drag & drop a file or paste content</p>
                  )}
                </div>
                {customContent && (
                  <div className="flex items-center gap-2 text-[10px] text-aria-textMuted">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {customContent.split(' ').length} words · {customContent.length} chars · Ready to audit
                  </div>
                )}
                {uploadSuccess && (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Document uploaded successfully. Launching audit...
                  </div>
                )}
              </div>
            )}

            {/* Blind task warning */}
            {selectedTask === 'blind' && (
              <div className="pt-3 flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-purple-800">Blind Generalisation Task</p>
                  <p className="text-[11px] text-purple-700 mt-0.5">This task uses paraphrased policy language — no heuristic trigger phrases match. The agent must reason from first principles. Scores are expected to be lower (~0.36).</p>
                </div>
              </div>
            )}

            {/* Expert task warning */}
            {selectedTask === 'expert' && (
              <div className="pt-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <Siren className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-rose-800">Expert Mode — Live Incident Response</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">At step 25, a data breach fires. The agent must simultaneously continue auditing AND execute containment → documentation → DPO engagement → supervisory notification → data subject notification within 8 steps.</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Footer */}
        <div className="p-5 border-t border-aria-border flex justify-between items-center bg-white flex-shrink-0">
          <div className="text-xs text-aria-textMuted">
            {selectedTier && (
              <span>
                Selected: <strong className="text-aria-textMain">{selectedTier.name}</strong> · 
                Up to <strong>{selectedTier.steps}</strong> steps · 
                ~{typeof selectedTier.gaps === 'number' ? selectedTier.gaps : '?'} gaps to find
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-aria-textMuted hover:bg-gray-100 transition text-sm">
              Cancel
            </button>
            
            <button 
              disabled={isLoading || isUploading || (selectedTask === 'custom' && !customContent.trim())}
              onClick={handleLaunchClick} 
              className={`px-5 py-2 rounded-lg font-bold text-white transition shadow-md flex items-center gap-2 text-sm ${
                (isLoading || isUploading) 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-aria-accent hover:bg-violet-600'
              }`}
            >
              {(isLoading || isUploading) ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Initializing...</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Launch Agent</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}