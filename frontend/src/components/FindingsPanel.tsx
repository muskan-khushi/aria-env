import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, ChevronRight, Sparkles } from 'lucide-react';

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

function getStatus(finding: any): string {
  if (!finding) return 'PENDING';
  const s = finding.status;
  if (!s) return 'PENDING';
  if (typeof s === 'object' && s !== null) return s.value || 'PENDING';
  return String(s);
}

function getGapType(finding: any): string {
  if (!finding) return 'unknown';
  const gt = finding.gap_type;
  if (!gt) return 'unknown';
  if (typeof gt === 'object' && gt !== null) return gt.value || String(gt);
  return String(gt);
}

function getSeverity(finding: any): string {
  if (!finding) return 'medium';
  const sev = finding.severity;
  if (!sev) return 'medium';
  if (typeof sev === 'object' && sev !== null) return sev.value || String(sev);
  return String(sev);
}

function getFramework(finding: any): string {
  if (!finding) return '';
  const fw = finding.framework;
  if (!fw) return '';
  if (typeof fw === 'object' && fw !== null) return fw.value || String(fw);
  return String(fw);
}

const SEVERITY_CONFIG = {
  high: { bg: 'linear-gradient(135deg, #FFF0F3, #FFE4E8)', border: '#FECDD3', badge: '#BE123C', badgeBg: '#FFE4E6', icon: '#EC4899', dot: '#F43F5E' },
  medium: { bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border: '#FDE68A', badge: '#92400E', badgeBg: '#FEF3C7', icon: '#F59E0B', dot: '#FBBF24' },
  low: { bg: 'linear-gradient(135deg, #F0FDF4, #D1FAE5)', border: '#A7F3D0', badge: '#065F46', badgeBg: '#D1FAE5', icon: '#10B981', dot: '#34D399' },
};

export default function FindingsPanel({ findings, onViewClause }: FindingsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, gridColumn: 'span 4' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F9A8D4' }}>
            <ShieldAlert style={{ width: 14, height: 14, color: '#EC4899' }} />
          </div>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 11, fontWeight: 800, color: '#5B4E7A', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Audit Findings</span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: findings.length > 0 ? 'linear-gradient(135deg, #FFE4E6, #FCE7F3)' : '#F3F4F6',
          border: `1.5px solid ${findings.length > 0 ? '#FECDD3' : '#E5E7EB'}`,
          borderRadius: 100, padding: '4px 12px',
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 11, fontWeight: 800,
          color: findings.length > 0 ? '#BE123C' : '#9CA3AF',
        }}>
          {findings.length > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F43F5E', animation: 'pulse 2s infinite' }} />}
          {findings.length} ACTIVE
        </div>
      </div>

      {/* Findings list */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(160deg, #FAF7FF, #F3EEFF)',
        borderRadius: 24,
        border: '1.5px solid rgba(196,181,253,0.3)',
        padding: '16px',
        overflowY: 'auto',
        maxHeight: '620px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 8px 40px -8px rgba(109,40,217,0.06)',
      }}>
        {findings.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 22, background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #C4B5FD' }}>
              <Sparkles style={{ width: 28, height: 28, color: '#8B5CF6' }} />
            </div>
            <div>
              <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, color: '#3B0764', marginBottom: 6 }}>Awaiting findings...</p>
              <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, color: '#9CA3AF', fontWeight: 500, lineHeight: 1.5 }}>Compliance gaps will surface here as the agent audits each section</p>
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
            const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;

            return (
              <div key={finding.finding_id || index} style={{
                background: 'white',
                borderRadius: 20,
                border: `1.5px solid ${cfg.border}`,
                padding: '20px',
                boxShadow: `0 4px 20px -4px rgba(0,0,0,0.06)`,
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                position: 'relative',
                overflow: 'hidden',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px -6px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px -4px rgba(0,0,0,0.06)'; }}
              >
                {/* Severity stripe */}
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: cfg.dot, borderRadius: '20px 0 0 20px' }} />

                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingLeft: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {severity === 'high'
                      ? <ShieldAlert style={{ width: 15, height: 15, color: cfg.icon }} />
                      : <AlertTriangle style={{ width: 15, height: 15, color: cfg.icon }} />
                    }
                    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 11, fontWeight: 800, color: '#1a0a2e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {framework ? `${framework} ` : ''}GAP
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 10, fontWeight: 800, padding: '4px 10px',
                    borderRadius: 100, border: `1px solid ${cfg.border}`,
                    background: cfg.badgeBg, color: cfg.badge,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {gapType.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, color: '#5B4E7A', marginBottom: 14, lineHeight: 1.6, paddingLeft: 8, fontWeight: 500 }}>
                  {finding.description || 'No description provided.'}
                </p>

                {/* Agent thinking */}
                {finding.agent_thinking && (
                  <div style={{
                    marginBottom: 14, marginLeft: 8,
                    background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)',
                    border: '1.5px solid rgba(196,181,253,0.4)',
                    borderRadius: 14, padding: '12px 14px',
                    borderLeft: '3px solid #8B5CF6',
                  }}>
                    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 10, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
                      ⚖️ Tribunal Reasoning
                    </span>
                    <p style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11, color: '#6D28D9', lineHeight: 1.55, margin: 0, opacity: 0.9 }}>
                      {finding.agent_thinking.substring(0, 200)}{finding.agent_thinking.length > 200 ? '...' : ''}
                    </p>
                  </div>
                )}

                {/* Clause ref */}
                {finding.clause_ref && (
                  <span style={{
                    display: 'inline-block', marginBottom: 12, marginLeft: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, color: '#8B5CF6', background: '#EDE9FE',
                    padding: '3px 8px', borderRadius: 8, fontWeight: 700,
                  }}>
                    {finding.clause_ref}
                  </span>
                )}

                {/* Status badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingLeft: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 10, fontWeight: 800, padding: '3px 10px',
                    borderRadius: 100,
                    background: severity === 'high' ? '#FFE4E6' : severity === 'medium' ? '#FEF3C7' : '#D1FAE5',
                    color: severity === 'high' ? '#BE123C' : severity === 'medium' ? '#92400E' : '#065F46',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {severity}
                  </span>
                  <span style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 10, fontWeight: 800, padding: '3px 10px',
                    borderRadius: 100,
                    background: status === 'REMEDIATED' ? '#EDE9FE' : status === 'CITED' ? '#DBEAFE' : '#F3F4F6',
                    color: status === 'REMEDIATED' ? '#6D28D9' : status === 'CITED' ? '#1D4ED8' : '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {status}
                  </span>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(196,181,253,0.2)', paddingLeft: 8 }}>
                  {cited ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12, fontWeight: 700, color: '#10B981' }}>
                      <CheckCircle2 style={{ width: 14, height: 14 }} /> Evidence Cited
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12, fontWeight: 700, color: '#9CA3AF' }}>
                      <Clock style={{ width: 13, height: 13 }} /> Awaiting Evidence
                    </div>
                  )}
                  <button
                    onClick={() => sectionId && onViewClause && onViewClause(sectionId)}
                    disabled={!sectionId || !onViewClause}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontSize: 12, fontWeight: 800, color: '#8B5CF6',
                      background: 'none', border: 'none', cursor: 'pointer',
                      opacity: (!sectionId || !onViewClause) ? 0.3 : 1,
                      transition: 'color 0.2s',
                    }}
                  >
                    View Clause <ChevronRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}