import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

interface FindingsPanelProps {
  findings: any[];
  /** Called when user clicks "View Clause" — passes the section_id to highlight in the doc viewer */
  onViewClause?: (sectionId: string) => void;
}

/**
 * Extracts the section_id from a clause_ref.
 * e.g. "privacy_policy.s3.p2" → "s3"
 *      "privacy_policy.s3"     → "s3"
 */
function extractSectionId(clauseRef: string): string | null {
  if (!clauseRef) return null;
  const parts = clauseRef.split('.');
  // Format is typically: doc_id.section_id[.paragraph]
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Determines if a finding has a cited evidence entry.
 * The backend sets finding.status = 'CITED' or 'REMEDIATED' once evidence is attached.
 */
function hasCitation(finding: any): boolean {
  return finding.status === 'CITED' || finding.status === 'REMEDIATED';
}

export default function FindingsPanel({ findings, onViewClause }: FindingsPanelProps) {
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
          <div className="h-full flex items-center justify-center text-xs text-aria-textMuted italic">
            Awaiting findings...
          </div>
        ) : (
          findings.map((finding) => {
            const sectionId = extractSectionId(finding.clause_ref);
            const cited = hasCitation(finding);

            return (
              <div
                key={finding.finding_id}
                className="bg-white border border-aria-border p-4 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-500"
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {finding.severity === 'high'
                      ? <ShieldAlert className="w-4 h-4 text-pastel-blushText" />
                      : <AlertTriangle className="w-4 h-4 text-pastel-peachText" />
                    }
                    <span className="text-xs font-bold uppercase tracking-wider text-aria-textMain">
                      {finding.framework ? `${finding.framework} ` : ''}GAP
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase border ${
                      finding.severity === 'high'
                        ? 'bg-pastel-blush text-pastel-blushText border-pastel-blushBorder'
                        : 'bg-pastel-peach text-pastel-peachText border-pastel-peachBorder'
                    }`}
                  >
                    {finding.gap_type?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-aria-textMuted mb-3 leading-relaxed">{finding.description}</p>

                {/* Explainability Panel */}
                {finding.agent_thinking && (
                  <div className="mb-4 bg-[#FAFAFD] border border-aria-border rounded-lg p-3 relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-aria-accent" />
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold text-aria-accent uppercase tracking-widest flex items-center gap-1.5">
                         🤖 Agent Reasoning
                       </span>
                       {finding.confidence_score !== undefined && (
                         <span className="text-[10px] font-bold text-aria-textMuted">
                           Confidence: {(finding.confidence_score * 100).toFixed(0)}%
                         </span>
                       )}
                    </div>
                    <p className="text-xs text-gray-600 font-mono leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                      {finding.agent_thinking}
                    </p>
                  </div>
                )}

                {/* Clause ref pill */}
                {finding.clause_ref && (
                  <p className="text-[10px] font-mono text-aria-textMuted bg-gray-100 rounded px-2 py-1 mb-3 w-fit">
                    {finding.clause_ref}
                  </p>
                )}

                {/* Footer row */}
                <div className="flex items-center justify-between pt-3 border-t border-aria-border">
                  {/* Evidence status — only shown when actually cited */}
                  {cited ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-pastel-sageText">
                      <CheckCircle2 className="w-4 h-4" /> Evidence Cited
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-aria-textMuted">
                      <Clock className="w-3.5 h-3.5" /> Awaiting Evidence
                    </div>
                  )}

                  {/* View Clause button — scrolls + highlights the section in the doc viewer */}
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