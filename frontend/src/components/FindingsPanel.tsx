import { ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

interface FindingsPanelProps {
  findings: any[];
}

export default function FindingsPanel({ findings }: FindingsPanelProps) {
  return (
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
  );
}