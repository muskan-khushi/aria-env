import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

interface FindingsPanelProps {
  findings: any[];
  onViewClause?: (sectionId: string) => void;
}

function extractSectionId(clauseRef: string): string | null {
  if (!clauseRef) return null;
  const parts = clauseRef.split('.');
  return parts.length >= 2 ? parts[1] : null;
}

function hasCitation(finding: any): boolean {
  const status = getStatus(finding);
  return status === 'CITED' || status === 'REMEDIATED';
}

// FIX: Handle both string statuses and object statuses from backend
function getStatus(finding: any): string {
  if (!finding) return 'PENDING';
  const s = finding.status;
  if (!s) return 'PENDING';
  // If it's an object with a value field (Pydantic enum serialization)
  if (typeof s === 'object' && s !== null) return s.value || 'PENDING';
  return String(s);
}

// FIX: Handle gap_type that may come as string or enum object
function getGapType(finding: any): string {
  if (!finding) return 'unknown';
  const gt = finding.gap_type;
  if (!gt) return 'unknown';
  if (typeof gt === 'object' && gt !== null) return gt.value || String(gt);
  return String(gt);
}

// FIX: Handle severity that may come as string or enum object
function getSeverity(finding: any): string {
  if (!finding) return 'medium';
  const sev = finding.severity;
  if (!sev) return 'medium';
  if (typeof sev === 'object' && sev !== null) return sev.value || String(sev);
  return String(sev);
}

// FIX: Handle framework
function getFramework(finding: any): string {
  if (!finding) return '';
  const fw = finding.framework;
  if (!fw) return '';
  if (typeof fw === 'object' && fw !== null) return fw.value || String(fw);
  return String(fw);
}

export default function FindingsPanel({ findings, onViewClause }: FindingsPanelProps) {
  // DEBUG: Log findings to console to verify data flow
  if (findings && findings.length > 0) {
    console.log('[FindingsPanel] Received findings:', findings.length, findings[0]);
  }

  return (
    <div className="col-span-4 flex flex-col gap-3">
      <div className="flex items-center justify-between pl-1">
        <h2 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest">Audit Findings</h2>
        <span className="bg-pastel-blush text-pastel-blushText border border-pastel-blushBorder text-[10px] px-2 py-0.5 rounded-full font-bold">
          {findings.length} ACTIVE
        </span>
      </div>

      <div className="flex-1 matte-panel p-5 overflow-y-auto bg-gray-50/30 flex flex-col gap-4 pr-2" style={{ maxHeight: '640px' }}>
        {findings.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-aria-textMuted">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-aria-textMuted">Awaiting findings...</p>
              <p className="text-[10px] text-aria-textMuted/60 mt-1">Gaps will appear here as the agent audits</p>
            </div>
          </div>
        ) : (
          findings.map((finding, index) => {
            const sectionId = extractSectionId(finding.clause_ref);
            const cited = hasCitation(finding);
            const severity = getSeverity(finding);
            const gapType = getGapType(finding);
            const framework = getFramework(finding);
            const status = getStatus(finding);

            return (
              <div
                key={finding.finding_id || index}
                className="bg-white border border-aria-border p-4 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-500"
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {severity === 'high'
                      ? <ShieldAlert className="w-4 h-4 text-pastel-blushText" />
                      : <AlertTriangle className="w-4 h-4 text-pastel-peachText" />
                    }
                    <span className="text-xs font-bold uppercase tracking-wider text-aria-textMain">
                      {framework ? `${framework} ` : ''}GAP
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase border ${
                      severity === 'high'
                        ? 'bg-pastel-blush text-pastel-blushText border-pastel-blushBorder'
                        : 'bg-pastel-peach text-pastel-peachText border-pastel-peachBorder'
                    }`}
                  >
                    {gapType.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-aria-textMuted mb-3 leading-relaxed">
                  {finding.description || 'No description provided.'}
                </p>

                {/* Agent thinking panel */}
                {finding.agent_thinking && (
                  <div className="mb-4 bg-[#FAFAFD] border border-aria-border rounded-lg p-3 relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-aria-accent" />
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold text-aria-accent uppercase tracking-widest flex items-center gap-1.5">
                         ⚖️ Compliance Tribunal Log
                       </span>
                       {finding.confidence_score !== undefined && (
                         <span className="text-[10px] font-bold text-aria-textMuted">
                           Confidence: {(finding.confidence_score * 100).toFixed(0)}%
                         </span>
                       )}
                    </div>
                    <div className="text-xs text-gray-600 font-mono leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all flex flex-col gap-2">
                      {finding.agent_thinking.split('\n').map((line: string, i: number) => {
                         if (!line.trim()) return null;
                         const parts = line.split(/(\*\*.*?\*\*)/g);
                         return (
                           <span key={i} className="block">
                             {parts.map((p, j) => 
                               p.startsWith('**') && p.endsWith('**') 
                                 ? <strong key={j} className="text-aria-textMain">{p.slice(2, -2)}</strong> 
                                 : p
                             )}
                           </span>
                         );
                      })}
                    </div>
                  </div>
                )}

                {/* Clause ref pill */}
                {finding.clause_ref && (
                  <p className="text-[10px] font-mono text-aria-textMuted bg-gray-100 rounded px-2 py-1 mb-3 w-fit">
                    {finding.clause_ref}
                  </p>
                )}

                {/* Severity badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    severity === 'high' ? 'bg-red-100 text-red-700' :
                    severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {severity} severity
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    status === 'REMEDIATED' ? 'bg-purple-100 text-purple-700' :
                    status === 'CITED' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {status}
                  </span>
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between pt-3 border-t border-aria-border">
                  {cited ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-pastel-sageText">
                      <CheckCircle2 className="w-4 h-4" /> Evidence Cited
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-aria-textMuted">
                      <Clock className="w-3.5 h-3.5" /> Awaiting Evidence
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (sectionId && onViewClause) {
                        onViewClause(sectionId);
                      }
                    }}
                    disabled={!sectionId || !onViewClause}
                    className="text-xs font-bold text-aria-accent hover:text-aria-textMain flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    View Clause <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}