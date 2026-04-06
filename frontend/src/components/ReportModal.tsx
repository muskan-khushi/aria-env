import { useRef } from 'react';
import { X, Download} from 'lucide-react';

interface ReportModalProps {
  show: boolean;
  onClose: () => void;
  findings: any[];
  chartData: any[];
  currentDoc: any;
  selectedTask: string;
  replaySteps: any[];
}

const SEVERITY_COLOR: Record<string, string> = {
  high:   '#DC2626',
  medium: '#D97706',
  low:    '#059669',
};

const GAP_BG: Record<string, string> = {
  high:   '#FEF2F2',
  medium: '#FFFBEB',
  low:    '#F0FDF4',
};

function printReport(el: HTMLElement | null) {
  if (!el) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ARIA Compliance Audit Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; background: white; }
        @page { margin: 18mm 20mm; size: A4; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>${el.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export default function ReportModal({
  show, onClose, findings, chartData, currentDoc, selectedTask, replaySteps
}: ReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!show) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const highFindings   = findings.filter(f => f.severity === 'high');
  const medFindings    = findings.filter(f => f.severity === 'medium');
  const lowFindings    = findings.filter(f => f.severity === 'low');
  const citedFindings  = findings.filter(f => f.status === 'CITED' || f.status === 'REMEDIATED');
  const finalReward    = chartData.length > 1 ? chartData[chartData.length - 1].cumulative : 0;
  const totalSteps     = chartData.length - 1;
  const positiveSteps  = chartData.filter(d => d.reward > 0).length;
  const negativeSteps  = chartData.filter(d => d.reward < 0).length;

  // Deduplicate frameworks
  const frameworks = [...new Set(findings.map(f => f.framework).filter(Boolean))];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '820px', maxHeight: '90vh' }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Compliance Audit Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">Preview before downloading as PDF</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => printReport(reportRef.current)}
              className="flex items-center gap-2 bg-aria-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-600 transition"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
          <div
            ref={reportRef}
            style={{
              background: 'white',
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              color: '#1a1a2e',
              padding: '40px 48px',
              maxWidth: '720px',
              margin: '0 auto',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          >
            {/* ── Cover header ── */}
            <div style={{ borderBottom: '3px solid #7C3AED', paddingBottom: '24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>A</span>
                    </div>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#7C3AED', letterSpacing: '-0.5px' }}>ARIA</span>
                  </div>
                  <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0, lineHeight: 1.2 }}>
                    Regulatory Compliance<br />Audit Report
                  </h1>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#6B7280' }}>
                  <p style={{ fontWeight: 600, color: '#374151' }}>{dateStr}</p>
                  <p>{timeStr}</p>
                  <p style={{ marginTop: '6px' }}>Task: <span style={{ fontWeight: 600, textTransform: 'capitalize', color: '#7C3AED' }}>{selectedTask}</span></p>
                  <p>Document: <span style={{ fontWeight: 600 }}>{currentDoc?.doc_id ?? 'N/A'}</span></p>
                </div>
              </div>
            </div>

            {/* ── Executive Summary ── */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C3AED', marginBottom: '14px', borderLeft: '4px solid #7C3AED', paddingLeft: '10px' }}>
                Executive Summary
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Total Findings', value: findings.length, color: '#7C3AED' },
                  { label: 'High Severity', value: highFindings.length, color: '#DC2626' },
                  { label: 'Evidence Cited', value: citedFindings.length, color: '#059669' },
                  { label: 'Cumulative Score', value: finalReward.toFixed(2), color: '#0D9488' },
                ].map((card) => (
                  <div key={card.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: card.color, margin: 0 }}>{card.value}</p>
                  </div>
                ))}
              </div>
              <p style={{ color: '#374151', lineHeight: '1.7' }}>
                This report documents the findings of an automated compliance audit conducted by ARIA on the <strong>{currentDoc?.title ?? selectedTask}</strong> document.
                The agent completed <strong>{totalSteps} steps</strong>, recording <strong>{positiveSteps} rewarded actions</strong> and <strong>{negativeSteps} penalized actions</strong>.
                {frameworks.length > 0 && <> Regulatory frameworks assessed: <strong>{frameworks.join(', ')}</strong>.</>}
              </p>
            </div>

            {/* ── Agent Performance ── */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C3AED', marginBottom: '14px', borderLeft: '4px solid #7C3AED', paddingLeft: '10px' }}>
                Agent Performance
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Steps Executed', value: totalSteps },
                  { label: 'Rewarded Actions', value: positiveSteps },
                  { label: 'Penalized Actions', value: negativeSteps },
                  { label: 'Final Cumulative Reward', value: finalReward.toFixed(3) },
                  { label: 'Findings Identified', value: findings.length },
                  { label: 'Evidence Coverage', value: findings.length > 0 ? `${Math.round((citedFindings.length / findings.length) * 100)}%` : 'N/A' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                    <span style={{ color: '#6B7280', fontSize: '12px' }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: '#1a1a2e', fontFamily: 'monospace' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Findings Detail ── */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C3AED', marginBottom: '14px', borderLeft: '4px solid #7C3AED', paddingLeft: '10px' }}>
                Compliance Findings ({findings.length})
              </h2>

              {findings.length === 0 ? (
                <p style={{ color: '#6B7280', fontStyle: 'italic' }}>No findings recorded in this episode.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {findings.map((f, i) => (
                    <div key={f.finding_id ?? i} style={{ border: `1px solid ${SEVERITY_COLOR[f.severity] ?? '#E5E7EB'}`, borderLeft: `4px solid ${SEVERITY_COLOR[f.severity] ?? '#7C3AED'}`, borderRadius: '8px', padding: '14px 16px', background: GAP_BG[f.severity] ?? '#F9FAFB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: SEVERITY_COLOR[f.severity] ?? '#7C3AED', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>
                            {f.severity ?? 'unknown'}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7C3AED', background: '#EDE9FE', padding: '2px 8px', borderRadius: '4px' }}>
                            {f.gap_type?.replace(/_/g, ' ') ?? 'gap'}
                          </span>
                          {f.framework && (
                            <span style={{ fontSize: '11px', color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              {f.framework}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: '4px' }}>
                          {f.clause_ref}
                        </span>
                      </div>
                      <p style={{ color: '#374151', margin: '0 0 8px', fontSize: '13px', lineHeight: '1.6' }}>{f.description}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        {(f.status === 'CITED' || f.status === 'REMEDIATED') ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>✓ Evidence cited</span>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>⏳ Awaiting evidence</span>
                        )}
                        {f.status === 'REMEDIATED' && (
                          <span style={{ color: '#7C3AED', fontWeight: 600, marginLeft: '8px' }}>✓ Remediated</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Severity Breakdown ── */}
            {findings.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C3AED', marginBottom: '14px', borderLeft: '4px solid #7C3AED', paddingLeft: '10px' }}>
                  Severity Breakdown
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'High', count: highFindings.length, color: '#DC2626', bg: '#FEF2F2' },
                    { label: 'Medium', count: medFindings.length, color: '#D97706', bg: '#FFFBEB' },
                    { label: 'Low', count: lowFindings.length, color: '#059669', bg: '#F0FDF4' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: '8px', padding: '14px 16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '28px', fontWeight: 700, color: s.color, margin: '0 0 4px' }}>{s.count}</p>
                      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: s.color, fontWeight: 600, margin: 0 }}>{s.label} Severity</p>
                      <p style={{ fontSize: '11px', color: '#6B7280', margin: '4px 0 0' }}>
                        {findings.length > 0 ? `${Math.round((s.count / findings.length) * 100)}% of total` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step Log Summary ── */}
            {replaySteps.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7C3AED', marginBottom: '14px', borderLeft: '4px solid #7C3AED', paddingLeft: '10px' }}>
                  Agent Action Log (last {Math.min(replaySteps.length, 15)} steps)
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#F3F4F6' }}>
                      {['Step', 'Action', 'Reward', 'Reason'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {replaySteps.slice(-15).map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#6B7280' }}>{s.step}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#374151' }}>{s.action}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, color: s.reward >= 0 ? '#059669' : '#DC2626' }}>
                          {s.reward >= 0 ? '+' : ''}{s.reward.toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 10px', color: '#6B7280', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#9CA3AF' }}>
              <span>Generated by ARIA — Agentic Regulatory Intelligence Architecture</span>
              <span>{dateStr} · {timeStr}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}