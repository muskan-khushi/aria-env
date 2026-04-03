import { useState } from 'react';
import { X, Play, Zap, Layers, Swords, Siren, Dna } from 'lucide-react';

const taskTiers = [
  { id: 'easy', name: 'Single-Doc GDPR', icon: Zap, desc: 'Direct pattern matching on a single document.', frameworks: 'GDPR', steps: 15 },
  { id: 'medium', name: 'Cross-Doc Review', icon: Layers, desc: 'Multi-document relational reasoning with contradictions.', frameworks: 'GDPR, CCPA', steps: 25 },
  { id: 'hard', name: 'Multi-Framework Conflict', icon: Swords, desc: 'Adversarial clauses and cross-framework conflicts.', frameworks: 'GDPR, HIPAA, CCPA', steps: 40 },
  { id: 'expert', name: 'Incident Response Suite', icon: Siren, desc: 'Dual-task: Live data breach mid-audit.', frameworks: 'All Frameworks', steps: 60 },
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

  if (!show) return null;

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

                {/* Procedural Seed Input Generator Form */}
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
              </div>
            )
          })}
        </div>
        
        <div className="p-6 border-t border-aria-border flex justify-end gap-4 bg-white">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-semibold text-aria-textMuted hover:bg-gray-100 transition">Cancel</button>
          <button onClick={() => { onClose(); onLaunch(); }} className="px-6 py-2.5 rounded-lg font-semibold bg-aria-textMain text-white hover:bg-aria-accent transition shadow-md flex items-center gap-2">
            <Play className="w-4 h-4" /> Load Scenario {selectedTask === 'procedural' ? `[Seed: ${seed}]` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}