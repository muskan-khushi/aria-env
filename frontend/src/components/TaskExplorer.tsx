import { useState } from 'react';
import { X, Play, Zap, Layers, Swords, Siren, Dna } from 'lucide-react';
// 1. Import the hook
import { useARIAEnv } from '../hooks/useARIAEnv';

const taskTiers = [
  { id: 'easy', name: 'Single-Doc GDPR', icon: Zap, desc: 'Direct pattern matching on a single document.', frameworks: 'GDPR', steps: 15 },
  { id: 'medium', name: 'Cross-Doc Review', icon: Layers, desc: 'Multi-document relational reasoning with contradictions.', frameworks: 'GDPR, CCPA', steps: 25 },
  { id: 'hard', name: 'Multi-Framework Conflict', icon: Swords, desc: 'Adversarial clauses and cross-framework conflicts.', frameworks: 'GDPR, HIPAA, CCPA', steps: 40 },
  { id: 'expert', name: 'Incident Response Suite', icon: Siren, desc: 'Dual-task: Live data breach mid-audit.', frameworks: 'All Frameworks', steps: 60 },
  { id: 'custom', name: 'Company Upload Mode', icon: Layers, desc: 'Upload your own corporate documents for live auditing.', frameworks: 'Custom Target', steps: 40 },
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
  
  // 2. Destructure the startDemo function and loading state
  const { startDemo, isLoading } = useARIAEnv();

  if (!show) return null;

  // 3. New handler to trigger the server-side audit
  const handleLaunchClick = async () => {
    if (selectedTask === 'custom') {
      setIsUploading(true);
      try {
        const API_BASE = window.location.hostname === "localhost" ? "http://localhost:7860" : "";
        await fetch(`${API_BASE}/aria/upload/custom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: customFilename, content: customContent })
        });
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setIsUploading(false);
      }
    }

    // This tells the FastAPI server to run the agent in the background
    await startDemo(selectedTask); 
    
    // Optional: Call the original onLaunch if it handles other UI resets
    onLaunch(); 
    
    // Close the modal
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-aria-bg/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-white border border-aria-border shadow-premium rounded-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-aria-border">
          <div>
            <h2 className="text-xl font-bold text-aria-textMain">Environment Configuration</h2>
            <p className="text-sm text-aria-textMuted mt-1">Select an audit scenario to initialize the ARIA agent.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition text-aria-textMuted">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-2 gap-4 bg-[#FAFAFD] max-h-[60vh] overflow-y-auto">
          {taskTiers.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selectedTask === tier.id;
            return (
              <div key={tier.id} className="flex flex-col gap-2">
                <div 
                  onClick={() => setSelectedTask(tier.id)}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col gap-3 h-full ${isSelected ? 'border-aria-accent bg-white shadow-md' : 'border-aria-border bg-white/50 hover:bg-white hover:border-aria-accentLight'}`}
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
                  <p className="text-sm text-aria-textMuted flex-1">{tier.desc}</p>
                  <div className="flex items-center justify-between mt-2 pt-3 border-t border-aria-border/50 text-xs font-semibold text-aria-textMuted">
                    <span><span className="text-aria-textMain">Scope:</span> {tier.frameworks}</span>
                    <span><span className="text-aria-textMain">Budget:</span> {tier.steps} Steps</span>
                  </div>
                </div>

                {isSelected && tier.id === 'procedural' && (
                  <div className="p-4 bg-aria-accentLight/30 border border-aria-accent/20 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-aria-textMain font-semibold text-sm">
                      <Dna className="w-4 h-4 text-aria-accent" />
                      Generator Seed
                    </div>
                    <input 
                      type="number" 
                      value={seed}
                      onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-1.5 rounded-lg border border-aria-border text-center font-mono text-sm focus:outline-none focus:border-aria-accent focus:ring-1 focus:ring-aria-accent"
                    />
                  </div>
                )}

                {isSelected && tier.id === 'custom' && (
                  <div className="p-4 mt-2 bg-aria-accentLight/30 border border-aria-accent/20 rounded-xl flex flex-col gap-3 animate-in slide-in-from-top-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-aria-textMain">Document Title</label>
                      <input 
                        type="text" 
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-aria-border font-mono text-sm focus:outline-none focus:border-aria-accent focus:ring-1 focus:ring-aria-accent"
                        placeholder="E.g., Privacy_Policy.txt"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-aria-textMain">Paste Document Content</label>
                      <textarea 
                        value={customContent}
                        onChange={(e) => setCustomContent(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-aria-border font-mono text-sm h-32 resize-none focus:outline-none focus:border-aria-accent focus:ring-1 focus:ring-aria-accent"
                        placeholder="Paste your company policies, terms of service, or BAA drafts here..."
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        <div className="p-6 border-t border-aria-border flex justify-end gap-4 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-semibold text-aria-textMuted hover:bg-gray-100 transition">Cancel</button>
          
          {/* 4. Update the Load Button to call handleLaunchClick and show loading state */}
          <button 
            disabled={isLoading || isUploading || (selectedTask === 'custom' && !customContent.trim())}
            onClick={handleLaunchClick} 
            className={`px-6 py-2.5 rounded-lg font-semibold text-white transition shadow-md flex items-center gap-2 ${(isLoading || isUploading) ? 'bg-gray-400 cursor-not-allowed' : 'bg-aria-textMain hover:bg-aria-accent'}`}
          >
            {(isLoading || isUploading) ? (
              <>Initializing Agent...</>
            ) : (
              <>
                <Play className="w-4 h-4" /> 
                Load Scenario {selectedTask === 'procedural' ? `[Seed: ${seed}]` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}