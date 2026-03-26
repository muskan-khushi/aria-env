import { ShieldAlert, CheckCircle, FileText, RotateCcw } from 'lucide-react';
import type { Finding, EvidenceCitation } from '../types/aria.types';

interface FindingsPanelProps {
  findings: Finding[];
  retracted: Finding[];
  citations: EvidenceCitation[];
}

function gapTypeLabel(gt: string): string {
  return gt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'PENDING'
      ? 'badge badge-pending'
      : status === 'CITED'
      ? 'badge badge-cited'
      : status === 'REMEDIATED'
      ? 'badge badge-remediated'
      : 'badge badge-pending';

  const icons: Record<string, React.ReactNode> = {
    PENDING: <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />,
    CITED: <FileText size={9} />,
    REMEDIATED: <CheckCircle size={9} />,
    RETRACTED: <RotateCcw size={9} />,
  };

  return (
    <span className={cls}>
      {icons[status]}
      {status.toLowerCase()}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === 'high'
      ? 'badge badge-high'
      : severity === 'medium'
      ? 'badge badge-medium'
      : 'badge badge-low';
  return <span className={cls}>{severity}</span>;
}

function FrameworkBadge({ framework }: { framework: string }) {
  const cls =
    framework === 'GDPR'
      ? 'badge badge-gdpr'
      : framework === 'HIPAA'
      ? 'badge badge-hipaa'
      : framework === 'CCPA'
      ? 'badge badge-ccpa'
      : 'badge badge-soc2';
  return <span className={cls}>{framework}</span>;
}

function FindingCard({ finding, hasCitation }: { finding: Finding; hasCitation: boolean }) {
  return (
    <div
      className={`card px-3 py-2.5 space-y-1.5 transition-all duration-300 ${
        finding.status === 'REMEDIATED' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <FrameworkBadge framework={finding.framework} />
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
        </div>
        {hasCitation && (
          <span className="text-xs text-green-400 opacity-70 shrink-0">✓ cited</span>
        )}
      </div>

      <p className="mono-text text-[11px] opacity-70">{finding.clause_ref}</p>

      <p className="text-xs font-medium" style={{ color: 'var(--color-lavender)' }}>
        {gapTypeLabel(finding.gap_type)}
      </p>

      {finding.description && (
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(204,170,230,0.6)' }}>
          {finding.description}
        </p>
      )}
    </div>
  );
}

export function FindingsPanel({ findings, retracted, citations }: FindingsPanelProps) {
  const citedFindingIds = new Set(citations.map((c) => c.finding_id));

  if (findings.length === 0 && retracted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center space-y-2">
        <ShieldAlert size={20} className="opacity-20" style={{ color: 'var(--color-lavender)' }} />
        <p className="section-label text-[10px]">No findings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {findings.map((f) => (
        <div
          key={f.finding_id}
          className="animate-fade-up"
          style={{ animationDelay: '0ms', animationFillMode: 'both' }}
        >
          <FindingCard finding={f} hasCitation={citedFindingIds.has(f.finding_id)} />
        </div>
      ))}

      {retracted.length > 0 && (
        <>
          <div className="section-label mt-3 mb-1">Retracted</div>
          {retracted.map((f) => (
            <div key={f.finding_id} className="opacity-40">
              <div className="card px-3 py-2 line-through">
                <p className="mono-text text-[11px]">{f.clause_ref}</p>
                <p className="text-xs" style={{ color: 'var(--color-lavender)' }}>
                  {gapTypeLabel(f.gap_type)}
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}