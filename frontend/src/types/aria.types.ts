// ── Enums ────────────────────────────────────────────────────────────────────

export type Framework = 'GDPR' | 'HIPAA' | 'CCPA' | 'SOC2';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'generated';

export type Phase = 'reading' | 'auditing' | 'remediating' | 'complete';

export type ActionType =
  | 'request_section'
  | 'identify_gap'
  | 'cite_evidence'
  | 'submit_remediation'
  | 'flag_false_positive'
  | 'escalate_conflict'
  | 'respond_to_incident'
  | 'request_clarification'
  | 'submit_final_report';

export type GapType =
  | 'data_retention'
  | 'consent_mechanism'
  | 'breach_notification'
  | 'data_subject_rights'
  | 'cross_border_transfer'
  | 'data_minimization'
  | 'purpose_limitation'
  | 'dpo_requirement'
  | 'phi_safeguard'
  | 'baa_requirement'
  | 'opt_out_mechanism'
  | 'audit_log_requirement'
  | 'availability_control';

export type Severity = 'high' | 'medium' | 'low';

export type FindingStatus = 'PENDING' | 'CITED' | 'REMEDIATED' | 'RETRACTED';

export type ActionResult = 'ACCEPTED' | 'REJECTED' | 'DUPLICATE';

export type IncidentResponseType =
  | 'notify_supervisory_authority'
  | 'notify_data_subjects'
  | 'contain_breach'
  | 'document_incident'
  | 'engage_dpo';

// ── Core Models ──────────────────────────────────────────────────────────────

export interface Section {
  section_id: string;
  title: string;
  content: string;
  subsections?: Section[];
}

export interface Document {
  doc_id: string;
  title: string;
  sections: Section[];
}

export interface Finding {
  finding_id: string;
  clause_ref: string;
  gap_type: GapType;
  severity: Severity;
  description: string;
  status: FindingStatus;
  framework: Framework;
}

export interface EvidenceCitation {
  citation_id: string;
  finding_id: string;
  passage_text: string;
  passage_location: string;
  score: number;
}

export interface Remediation {
  remediation_id: string;
  finding_id: string;
  text: string;
  target_framework: Framework;
  quality_score: number;
}

export interface Incident {
  incident_id: string;
  incident_type: string;
  records_affected: number;
  discovered_at_step: number;
  deadline_steps: number;
}

export interface IncidentEvent {
  step: number;
  event_type: string;
  description: string;
}

export interface RegulatoryContext {
  frameworks_in_scope: Framework[];
  applicable_articles: Record<string, string[]>;
}

// ── Observation ──────────────────────────────────────────────────────────────

export interface ARIAObservation {
  session_id: string;
  task_id: string;
  task_description: string;
  regulatory_context: RegulatoryContext;
  documents: Document[];
  visible_sections: string[];
  active_findings: Finding[];
  retracted_findings: Finding[];
  submitted_remediations: Remediation[];
  last_action: ActionType | null;
  last_action_result: ActionResult;
  last_reward: number;
  last_reward_reason: string;
  cumulative_reward: number;
  steps_taken: number;
  steps_remaining: number;
  done: boolean;
  phase: Phase;
  evidence_citations: EvidenceCitation[];
  active_incident: Incident | null;
  incident_timeline: IncidentEvent[];
  incident_deadline_steps: number | null;
}

// ── Action ───────────────────────────────────────────────────────────────────

export interface ARIAAction {
  action_type: ActionType;
  clause_ref?: string;
  gap_type?: GapType;
  severity?: Severity;
  description?: string;
  finding_id?: string;
  passage_text?: string;
  passage_location?: string;
  remediation_text?: string;
  target_framework?: Framework;
  framework_a?: Framework;
  framework_b?: Framework;
  conflict_desc?: string;
  incident_id?: string;
  response_type?: IncidentResponseType;
  response_detail?: string;
  document_id?: string;
  section_id?: string;
  retract_finding_id?: string;
}

// ── WebSocket Events ─────────────────────────────────────────────────────────

export type ARIAEvent =
  | {
      type: 'step';
      step_number: number;
      action: ARIAAction;
      reward: number;
      reward_reason: string;
      observation: ARIAObservation;
      agent_thinking?: string;
    }
  | {
      type: 'episode_complete';
      grade_result: GradeResult;
      replay_id: string;
    }
  | {
      type: 'incident_alert';
      incident: Incident;
      message: string;
    };

// ── Grade & Leaderboard ──────────────────────────────────────────────────────

export interface GradeResult {
  score: number;
  precision: number;
  recall: number;
  f1: number;
  evidence_score: number;
  severity_accuracy: number;
  remediation_score: number;
  conflict_score: number;
}

export interface LeaderboardEntry {
  id: string;
  task_id: string;
  task_title: string;
  difficulty: Difficulty;
  model: string;
  agent_type: string;
  score: number;
  precision: number;
  recall: number;
  f1: number;
  date: string;
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface CompanyProfile {
  name: string;
  industry: string;
  size: string;
  data_types: string[];
  operates_in: string[];
}

export interface Task {
  task_id: string;
  difficulty: Difficulty;
  title: string;
  company_profile: CompanyProfile;
  frameworks_in_scope: Framework[];
  max_steps: number;
  seed?: number;
  is_generated: boolean;
  description?: string;
}

// ── Replay ───────────────────────────────────────────────────────────────────

export interface ReplayStep {
  step_number: number;
  action: ARIAAction;
  reward: number;
  reward_reason: string;
  observation: ARIAObservation;
  agent_thinking?: string;
}

export interface EpisodeReplay {
  replay_id: string;
  task_id: string;
  task_title: string;
  difficulty: Difficulty;
  total_steps: number;
  final_score: number;
  grade_result: GradeResult;
  steps: ReplayStep[];
}

// ── Framework Spec ───────────────────────────────────────────────────────────

export interface FrameworkArticle {
  article_id: string;
  title: string;
  description: string;
  requirements: string[];
  max_penalty: string;
}

export interface FrameworkSpec {
  name: Framework;
  jurisdiction: string;
  articles: FrameworkArticle[];
}