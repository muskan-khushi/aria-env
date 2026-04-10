import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, ChevronRight, Globe, FileText, Scale, Database } from 'lucide-react';

const FRAMEWORKS = [
  {
    id: 'GDPR',
    name: 'General Data Protection Regulation',
    jurisdiction: 'EU / EEA',
    maxFine: '€20M or 4% global turnover',
    color: '#4F46E5',
    bg: '#EEF2FF',
    border: '#C7D2FE',
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
    id: 'HIPAA',
    name: 'Health Insurance Portability and Accountability Act',
    jurisdiction: 'United States (Healthcare)',
    maxFine: '$1.9M per violation category annually',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
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
    id: 'CCPA',
    name: 'California Consumer Privacy Act / CPRA',
    jurisdiction: 'California, USA',
    maxFine: '$7,500 per intentional violation',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: Scale,
    summary: 'California\'s comprehensive privacy law grants consumers control over their personal information and imposes obligations on businesses that collect it.',
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
    id: 'SOC2',
    name: 'SOC 2 Type II — Trust Services Criteria',
    jurisdiction: 'Global (SaaS / Cloud)',
    maxFine: 'Loss of certification, enterprise contract loss',
    color: '#059669',
    bg: '#F0FDF4',
    border: '#A7F3D0',
    icon: Database,
    summary: 'AICPA\'s auditing standard for service organizations. Evaluates controls related to security, availability, processing integrity, confidentiality, and privacy.',
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

const GAP_TYPE_LABELS: Record<string, string> = {
  data_retention: 'Data Retention',
  consent_mechanism: 'Consent Mechanism',
  breach_notification: 'Breach Notification',
  data_subject_rights: 'Data Subject Rights',
  cross_border_transfer: 'Cross-Border Transfer',
  data_minimization: 'Data Minimization',
  purpose_limitation: 'Purpose Limitation',
  dpo_requirement: 'DPO Requirement',
  phi_safeguard: 'PHI Safeguard',
  baa_requirement: 'BAA Requirement',
  opt_out_mechanism: 'Opt-Out Mechanism',
  audit_log_requirement: 'Audit Log Requirement',
  availability_control: 'Availability Control',
};

// Cross-framework conflict matrix
const CONFLICT_MATRIX = [
  {
    fw_a: 'GDPR',
    fw_b: 'HIPAA',
    desc: 'Breach notification: GDPR requires 72 hours to supervisory authority; HIPAA allows 60 days for individual notification.',
    resolution: 'Apply 72-hour GDPR clock for EU-resident data subjects. Maintain parallel HIPAA track for US-only breaches.',
    severity: 'high',
  },
  {
    fw_a: 'GDPR',
    fw_b: 'CCPA',
    desc: 'Consent model: GDPR requires opt-in consent before processing. CCPA allows processing until consumer opts out.',
    resolution: 'Implement jurisdiction-aware consent: opt-in for EU users, opt-out mechanism for California users.',
    severity: 'high',
  },
  {
    fw_a: 'GDPR',
    fw_b: 'HIPAA',
    desc: 'Data retention: GDPR storage limitation requires deletion when data is no longer necessary. HIPAA requires 6-year minimum.',
    resolution: 'Retain for HIPAA minimum (6 years), delete immediately upon expiry, inform EU data subjects of constraint.',
    severity: 'medium',
  },
  {
    fw_a: 'HIPAA',
    fw_b: 'CCPA',
    desc: 'PHI sharing: HIPAA permits PHI for healthcare operations without consent. CCPA restricts sharing of health info of CA residents.',
    resolution: 'Treat CA patient health data as sensitive under CPRA 1798.121 — implement limit-use mechanism.',
    severity: 'medium',
  },
];

export default function FrameworkExplorer() {
  const [selectedFw, setSelectedFw] = useState(FRAMEWORKS[0]);
  const [showConflicts, setShowConflicts] = useState(false);

  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Framework selector tabs */}
      <div className="flex gap-2 flex-shrink-0">
        {FRAMEWORKS.map(fw => {
          const Icon = fw.icon;
          const isSelected = selectedFw.id === fw.id;
          return (
            <button
              key={fw.id}
              onClick={() => { setSelectedFw(fw); setShowConflicts(false); }}
              className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                isSelected 
                  ? 'border-2 shadow-md scale-[1.02]' 
                  : 'border-aria-border hover:border-gray-300 bg-white'
              }`}
              style={isSelected ? { borderColor: fw.color, background: fw.bg } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isSelected ? fw.color : '#6B5B81' }} />
              <div className="text-left">
                <p className="text-xs font-bold" style={{ color: isSelected ? fw.color : '#2E1A47' }}>{fw.id}</p>
                <p className="text-[9px] text-aria-textMuted leading-none">{fw.jurisdiction}</p>
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setShowConflicts(true)}
          className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
            showConflicts
              ? 'border-rose-400 bg-rose-50 shadow-md scale-[1.02]'
              : 'border-aria-border bg-white hover:border-gray-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: showConflicts ? '#DC2626' : '#6B5B81' }} />
          <div className="text-left">
            <p className="text-xs font-bold" style={{ color: showConflicts ? '#DC2626' : '#2E1A47' }}>Conflicts</p>
            <p className="text-[9px] text-aria-textMuted leading-none">Cross-framework</p>
          </div>
        </button>
      </div>

      {!showConflicts ? (
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Left: overview */}
          <div className="col-span-4 flex flex-col gap-3">
            {/* Header card */}
            <div className="matte-panel p-5 border-2" style={{ borderColor: selectedFw.color, background: selectedFw.bg }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: selectedFw.color }}>
                  <selectedFw.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: selectedFw.color }}>{selectedFw.id}</h2>
                  <p className="text-xs text-gray-600 mt-0.5">{selectedFw.name}</p>
                </div>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{selectedFw.summary}</p>
            </div>

            {/* Meta info */}
            <div className="matte-panel p-4 bg-white flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest">Jurisdiction</span>
                <span className="text-xs font-semibold text-aria-textMain">{selectedFw.jurisdiction}</span>
              </div>
              <div className="flex items-center justify-between border-t border-aria-border pt-3">
                <span className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest">Max Fine</span>
                <span className="text-xs font-bold text-rose-600">{selectedFw.maxFine}</span>
              </div>
              <div className="border-t border-aria-border pt-3">
                <span className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest block mb-2">Gap Types Detected</span>
                <div className="flex flex-wrap gap-1">
                  {selectedFw.gapTypes.map(gt => (
                    <span key={gt} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-aria-accentLight text-aria-accent border border-aria-accent/20">
                      {GAP_TYPE_LABELS[gt] || gt}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Known conflicts */}
            <div className="matte-panel p-4 bg-white flex flex-col gap-2">
              <span className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest">Known Conflicts With</span>
              {selectedFw.conflicts.map((c, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-700 leading-relaxed">{c}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: key articles */}
          <div className="col-span-8 matte-panel p-5 bg-white overflow-y-auto" style={{ maxHeight: '620px' }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-aria-border">
              <h3 className="text-sm font-bold text-aria-textMain">Key Articles & Provisions</h3>
              <span className="text-[10px] font-bold text-aria-textMuted bg-gray-100 px-2 py-1 rounded-full">
                {selectedFw.keyArticles.length} provisions
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {selectedFw.keyArticles.map((article, i) => (
                <div key={i} className="group p-4 border border-aria-border rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: selectedFw.bg }}>
                      <span className="text-[10px] font-bold" style={{ color: selectedFw.color }}>{i + 1}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold" style={{ color: selectedFw.color }}>{article.ref}</span>
                        <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{article.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Conflict matrix view */
        <div className="flex-1 matte-panel p-5 bg-white overflow-y-auto">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-aria-border">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-aria-textMain">Cross-Framework Legal Conflicts</h3>
              <p className="text-xs text-aria-textMuted">Satisfying one regulation may violate another — agents must detect and escalate these paradoxes</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {CONFLICT_MATRIX.map((conflict, i) => (
              <div key={i} className="border-2 border-rose-200 rounded-xl p-5 bg-rose-50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold bg-white border border-rose-300 text-rose-700 px-3 py-1 rounded-full">{conflict.fw_a}</span>
                  <span className="text-xs text-rose-400 font-bold">⟺</span>
                  <span className="text-xs font-bold bg-white border border-rose-300 text-rose-700 px-3 py-1 rounded-full">{conflict.fw_b}</span>
                  <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${conflict.severity === 'high' ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                    {conflict.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed mb-3">{conflict.desc}</p>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Resolution</p>
                  <p className="text-xs text-emerald-800 leading-relaxed">{conflict.resolution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}