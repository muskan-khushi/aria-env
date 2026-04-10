import { useState } from 'react';
import { Globe, Shield, Scale, Database, AlertTriangle, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

const FRAMEWORKS = [
  {
    id: 'GDPR', name: 'General Data Protection Regulation', jurisdiction: 'EU / EEA',
    maxFine: '€20M or 4% global turnover', color: '#8B5CF6', bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', lightBg: '#F3EEFF', border: '#C4B5FD', emoji: '🇪🇺',
    icon: Globe,
    summary: 'The gold standard of data protection law. GDPR governs how organizations process personal data of EU residents, regardless of where the company is located.',
    keyArticles: [
      { ref: 'Article 5', desc: 'Core principles: lawfulness, purpose limitation, data minimisation, accuracy, storage limitation, integrity & confidentiality' },
      { ref: 'Article 7', desc: 'Consent must be freely given, specific, informed and unambiguous. Withdrawal must be as easy as giving consent.' },
      { ref: 'Article 17', desc: 'Right to erasure ("right to be forgotten") — data subjects may request deletion under specific conditions.' },
      { ref: 'Article 33', desc: 'Breach notification to supervisory authority within 72 hours of becoming aware of the breach.' },
      { ref: 'Article 35', desc: 'Data Protection Impact Assessment (DPIA) required for high-risk processing activities.' },
      { ref: 'Article 37', desc: 'Mandatory Data Protection Officer designation for certain types of processing.' },
      { ref: 'Article 44', desc: 'Transfers to third countries require appropriate safeguards (SCCs, adequacy decision).' },
    ],
    gapTypes: ['data_retention', 'consent_mechanism', 'breach_notification', 'data_subject_rights', 'cross_border_transfer', 'data_minimization', 'purpose_limitation', 'dpo_requirement'],
    conflicts: ['HIPAA (breach timeline: 72h vs 60 days)', 'CCPA (opt-in vs opt-out model)', 'HIPAA (retention: deletion vs 6-year minimum)'],
  },
  {
    id: 'HIPAA', name: 'Health Insurance Portability and Accountability Act', jurisdiction: 'United States (Healthcare)',
    maxFine: '$1.9M per violation category annually', color: '#EC4899', bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', lightBg: '#FDF2F8', border: '#F9A8D4', emoji: '🏥',
    icon: Shield,
    summary: 'US federal law that establishes national standards to protect sensitive patient health information (PHI) from disclosure without patient consent.',
    keyArticles: [
      { ref: '45 CFR 164.308', desc: 'Administrative safeguards: security officer, workforce training, access controls, contingency plan.' },
      { ref: '45 CFR 164.312', desc: 'Technical safeguards: access control, audit controls, integrity, transmission security.' },
      { ref: '45 CFR 164.314', desc: 'Business Associate Agreements (BAA) required with all third parties handling PHI.' },
      { ref: '45 CFR 164.404', desc: 'Covered entities must notify individuals within 60 days of breach discovery.' },
      { ref: '45 CFR 164.502', desc: 'Minimum necessary standard: only disclose the minimum PHI necessary for the task.' },
      { ref: '45 CFR 164.514', desc: 'De-identification standards: Safe Harbor method removes 18 specific identifiers.' },
    ],
    gapTypes: ['phi_safeguard', 'baa_requirement', 'breach_notification', 'audit_log_requirement', 'data_minimization'],
    conflicts: ['GDPR (breach: 60 days vs 72 hours)', 'GDPR (retention: 6 years vs storage limitation)', 'CCPA (PHI sharing for ops vs opt-out rights)'],
  },
  {
    id: 'CCPA', name: 'California Consumer Privacy Act / CPRA', jurisdiction: 'California, USA',
    maxFine: '$7,500 per intentional violation', color: '#F59E0B', bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', lightBg: '#FFFBF0', border: '#FCD34D', emoji: '⚖️',
    icon: Scale,
    summary: "California's comprehensive privacy law grants consumers control over their personal information and imposes obligations on businesses that collect it.",
    keyArticles: [
      { ref: '1798.100', desc: 'Right to know what personal information is collected, used, shared, or sold.' },
      { ref: '1798.105', desc: 'Right to delete personal information collected from the consumer.' },
      { ref: '1798.120', desc: 'Right to opt-out of the sale or sharing of personal information.' },
      { ref: '1798.121', desc: 'Right to limit use and disclosure of sensitive personal information (CPRA).' },
      { ref: '1798.135', desc: '"Do Not Sell or Share My Personal Information" link required on homepage.' },
      { ref: '1798.130', desc: 'Must respond to consumer requests within 45 days (extendable to 90 with notice).' },
    ],
    gapTypes: ['opt_out_mechanism', 'data_subject_rights', 'consent_mechanism', 'data_retention', 'purpose_limitation'],
    conflicts: ['GDPR (opt-in vs opt-out)', 'HIPAA (PHI sharing permissions)', 'GDPR (deletion exemptions differ)'],
  },
  {
    id: 'SOC2', name: 'SOC 2 Type II — Trust Services Criteria', jurisdiction: 'Global (SaaS / Cloud)',
    maxFine: 'Loss of certification, enterprise contract loss', color: '#10B981', bg: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', lightBg: '#F0FDF8', border: '#6EE7B7', emoji: '🔐',
    icon: Database,
    summary: "AICPA's auditing standard for service organizations. Evaluates controls related to security, availability, processing integrity, confidentiality, and privacy.",
    keyArticles: [
      { ref: 'CC6', desc: 'Logical and physical access controls — authentication, authorization, encryption.' },
      { ref: 'CC7', desc: 'System operations — monitoring, incident management, recovery procedures with IRP testing.' },
      { ref: 'CC8', desc: 'Change management — authorized changes, testing, documentation.' },
      { ref: 'A1', desc: 'Availability — uptime commitments, SLA accuracy, redundancy, capacity planning.' },
      { ref: 'C1', desc: 'Confidentiality — data classification, encryption, access controls, DLP.' },
      { ref: 'PI1', desc: 'Processing integrity — complete, valid, accurate, timely processing.' },
    ],
    gapTypes: ['audit_log_requirement', 'availability_control', 'data_retention', 'breach_notification'],
    conflicts: ['GDPR (erasure rights vs audit log retention)', 'HIPAA (availability vs minimal retention)'],
  },
];

const CONFLICT_MATRIX = [
  { fw_a: 'GDPR', fw_b: 'HIPAA', desc: 'Breach notification: GDPR requires 72 hours to supervisory authority; HIPAA allows 60 days for individual notification.', resolution: 'Apply 72-hour GDPR clock for EU-resident data subjects. Maintain parallel HIPAA track for US-only breaches.', severity: 'high' },
  { fw_a: 'GDPR', fw_b: 'CCPA', desc: 'Consent model: GDPR requires opt-in consent before processing. CCPA allows processing until consumer opts out.', resolution: 'Implement jurisdiction-aware consent: opt-in for EU users, opt-out mechanism for California users.', severity: 'high' },
  { fw_a: 'GDPR', fw_b: 'HIPAA', desc: 'Data retention: GDPR storage limitation requires deletion when data is no longer necessary. HIPAA requires 6-year minimum.', resolution: 'Retain for HIPAA minimum (6 years), delete immediately upon expiry, inform EU data subjects of constraint.', severity: 'medium' },
  { fw_a: 'HIPAA', fw_b: 'CCPA', desc: 'PHI sharing: HIPAA permits PHI for healthcare operations without consent. CCPA restricts sharing of health info of CA residents.', resolution: 'Treat CA patient health data as sensitive under CPRA 1798.121 — implement limit-use mechanism.', severity: 'medium' },
];

const GAP_LABELS: Record<string, string> = {
  data_retention: 'Data Retention', consent_mechanism: 'Consent Mechanism', breach_notification: 'Breach Notification',
  data_subject_rights: 'Data Subject Rights', cross_border_transfer: 'Cross-Border Transfer', data_minimization: 'Data Minimization',
  purpose_limitation: 'Purpose Limitation', dpo_requirement: 'DPO Requirement', phi_safeguard: 'PHI Safeguard',
  baa_requirement: 'BAA Requirement', opt_out_mechanism: 'Opt-Out Mechanism', audit_log_requirement: 'Audit Log',
  availability_control: 'Availability Control',
};

export default function FrameworkExplorer() {
  const [selectedFw, setSelectedFw] = useState(FRAMEWORKS[0]);
  const [showConflicts, setShowConflicts] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '680px', fontFamily: "'Bricolage Grotesque', sans-serif" }}>

      {/* Framework selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {FRAMEWORKS.map(fw => {
          const Icon = fw.icon;
          const isSelected = selectedFw.id === fw.id && !showConflicts;
          return (
            <button key={fw.id} onClick={() => { setSelectedFw(fw); setShowConflicts(false); }} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              padding: '20px 16px', borderRadius: 22,
              background: isSelected ? fw.bg : 'white',
              border: `2px solid ${isSelected ? fw.border : 'rgba(196,181,253,0.25)'}`,
              cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              transform: isSelected ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
              boxShadow: isSelected ? `0 12px 32px ${fw.color}25` : '0 2px 8px rgba(109,40,217,0.04)',
            }}>
              <span style={{ fontSize: 28, filter: isSelected ? 'none' : 'grayscale(0.3)' }}>{fw.emoji}</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: isSelected ? fw.color : '#1a0a2e', letterSpacing: '-0.3px' }}>{fw.id}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>{fw.jurisdiction.split('(')[0].trim()}</div>
              </div>
            </button>
          );
        })}
        <button onClick={() => setShowConflicts(true)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '20px 16px', borderRadius: 22,
          background: showConflicts ? 'linear-gradient(135deg, #FFF0F3, #FFE4E8)' : 'white',
          border: `2px solid ${showConflicts ? '#FECDD3' : 'rgba(196,181,253,0.25)'}`,
          cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          transform: showConflicts ? 'translateY(-3px) scale(1.02)' : 'translateY(0)',
          boxShadow: showConflicts ? '0 12px 32px rgba(236,72,153,0.15)' : '0 2px 8px rgba(109,40,217,0.04)',
        }}>
          <span style={{ fontSize: 28 }}>⚡</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: showConflicts ? '#EC4899' : '#1a0a2e', letterSpacing: '-0.3px' }}>Conflicts</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>Cross-framework</div>
          </div>
        </button>
      </div>

      {!showConflicts ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, flex: 1 }}>
          {/* Left sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header card */}
            <div style={{
              borderRadius: 24, padding: '28px',
              background: selectedFw.bg,
              border: `2px solid ${selectedFw.border}`,
              boxShadow: `0 8px 32px ${selectedFw.color}15`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.1 }}>{selectedFw.emoji}</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 16, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${selectedFw.color}30` }}>
                  <selectedFw.icon style={{ width: 22, height: 22, color: selectedFw.color }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: selectedFw.color, margin: 0, letterSpacing: '-0.5px' }}>{selectedFw.id}</h2>
                  <p style={{ fontSize: 12, color: '#5B4E7A', margin: '4px 0 0', lineHeight: 1.4, fontWeight: 500 }}>{selectedFw.name}</p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{selectedFw.summary}</p>
            </div>

            {/* Meta */}
            <div style={{ background: 'white', borderRadius: 22, border: '1.5px solid rgba(196,181,253,0.25)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Jurisdiction', value: selectedFw.jurisdiction },
                { label: 'Max Fine', value: selectedFw.maxFine, fineStyle: true },
              ].map((item, i) => (
                <div key={i} style={{ paddingBottom: i === 0 ? 14 : 0, borderBottom: i === 0 ? '1px solid rgba(196,181,253,0.2)' : 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.fineStyle ? '#EC4899' : '#1a0a2e' }}>{item.value}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Gap Types Detected</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedFw.gapTypes.map(gt => (
                    <span key={gt} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: selectedFw.lightBg, border: `1px solid ${selectedFw.border}`, color: selectedFw.color }}>
                      {GAP_LABELS[gt] || gt}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Conflicts */}
            <div style={{ background: 'white', borderRadius: 22, border: '1.5px solid rgba(196,181,253,0.25)', padding: '20px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Known Conflicts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedFw.conflicts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'linear-gradient(135deg, #FFF0F3, #FFE4E8)', border: '1px solid #FECDD3', borderRadius: 14 }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: '#EC4899', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: '#9F1239', lineHeight: 1.55, margin: 0, fontWeight: 600 }}>{c}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Articles */}
          <div style={{ background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.25)', overflow: 'hidden', boxShadow: '0 8px 40px rgba(109,40,217,0.04)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(196,181,253,0.2)', background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap style={{ width: 16, height: 16, color: selectedFw.color }} />
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a0a2e', margin: 0 }}>Key Articles & Provisions</h3>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: selectedFw.color, background: selectedFw.lightBg, padding: '4px 12px', borderRadius: 100, border: `1px solid ${selectedFw.border}` }}>
                {selectedFw.keyArticles.length} provisions
              </span>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '560px', padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedFw.keyArticles.map((article, i) => (
                  <div key={i} style={{
                    padding: '18px 20px', borderRadius: 18,
                    border: '1.5px solid rgba(196,181,253,0.2)',
                    background: '#FAF7FF',
                    transition: 'all 0.25s',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = selectedFw.border; (e.currentTarget as HTMLElement).style.background = selectedFw.lightBg; (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,181,253,0.2)'; (e.currentTarget as HTMLElement).style.background = '#FAF7FF'; (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 12, background: selectedFw.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${selectedFw.border}` }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: selectedFw.color }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 800, color: selectedFw.color }}>{article.ref}</span>
                        <ChevronRight style={{ width: 14, height: 14, color: '#D1D5DB' }} />
                      </div>
                      <p style={{ fontSize: 13, color: '#5B4E7A', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{article.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Conflict matrix */
        <div style={{ background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.25)', overflow: 'hidden', flex: 1 }}>
          <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(196,181,253,0.2)', background: 'linear-gradient(135deg, #FFF0F3, #FFE4E8)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 16, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #FECDD3' }}>
              <AlertTriangle style={{ width: 22, height: 22, color: '#EC4899' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#BE123C', margin: 0 }}>Cross-Framework Legal Conflicts</h3>
              <p style={{ fontSize: 13, color: '#9F1239', margin: '4px 0 0', fontWeight: 500, opacity: 0.8 }}>Satisfying one regulation may violate another — agents must detect and escalate these paradoxes</p>
            </div>
          </div>
          <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '560px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {CONFLICT_MATRIX.map((conflict, i) => (
                <div key={i} style={{
                  borderRadius: 22, padding: '28px',
                  background: conflict.severity === 'high' ? 'linear-gradient(135deg, #FFF0F3, #FFE4E8)' : 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                  border: `2px solid ${conflict.severity === 'high' ? '#FECDD3' : '#FDE68A'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 800, padding: '5px 14px',
                      borderRadius: 100, background: 'white',
                      border: `1.5px solid ${conflict.severity === 'high' ? '#FECDD3' : '#FDE68A'}`,
                      color: conflict.severity === 'high' ? '#BE123C' : '#92400E',
                    }}>{conflict.fw_a}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: conflict.severity === 'high' ? '#EC4899' : '#F59E0B' }}>⟺</span>
                    <span style={{
                      fontSize: 12, fontWeight: 800, padding: '5px 14px',
                      borderRadius: 100, background: 'white',
                      border: `1.5px solid ${conflict.severity === 'high' ? '#FECDD3' : '#FDE68A'}`,
                      color: conflict.severity === 'high' ? '#BE123C' : '#92400E',
                    }}>{conflict.fw_b}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100,
                      background: conflict.severity === 'high' ? '#BE123C' : '#D97706',
                      color: 'white', textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {conflict.severity}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.65, marginBottom: 18, fontWeight: 500 }}>{conflict.desc}</p>
                  <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', borderRadius: 16, border: '1.5px solid #A7F3D0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <CheckCircle2 style={{ width: 16, height: 16, color: '#10B981', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Resolution</div>
                      <p style={{ fontSize: 13, color: '#047857', lineHeight: 1.6, margin: 0, fontWeight: 600 }}>{conflict.resolution}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}