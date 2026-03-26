"""
ARIA — Agentic Regulatory Intelligence Architecture
Core Pydantic v2 data models — all other modules import from here.
"""
from __future__ import annotations
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field
import uuid


# ─── Enums ────────────────────────────────────────────────────────────────────

class Framework(str, Enum):
    GDPR = "GDPR"
    HIPAA = "HIPAA"
    CCPA = "CCPA"
    SOC2 = "SOC2"


class GapType(str, Enum):
    DATA_RETENTION = "data_retention"
    CONSENT_MECHANISM = "consent_mechanism"
    BREACH_NOTIFICATION = "breach_notification"
    DATA_SUBJECT_RIGHTS = "data_subject_rights"
    CROSS_BORDER_TRANSFER = "cross_border_transfer"
    DATA_MINIMIZATION = "data_minimization"
    PURPOSE_LIMITATION = "purpose_limitation"
    DPO_REQUIREMENT = "dpo_requirement"
    PHI_SAFEGUARD = "phi_safeguard"
    BAA_REQUIREMENT = "baa_requirement"
    OPT_OUT_MECHANISM = "opt_out_mechanism"
    AUDIT_LOG_REQUIREMENT = "audit_log_requirement"
    AVAILABILITY_CONTROL = "availability_control"


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActionType(str, Enum):
    REQUEST_SECTION = "request_section"
    IDENTIFY_GAP = "identify_gap"
    CITE_EVIDENCE = "cite_evidence"
    SUBMIT_REMEDIATION = "submit_remediation"
    FLAG_FALSE_POSITIVE = "flag_false_positive"
    ESCALATE_CONFLICT = "escalate_conflict"
    RESPOND_TO_INCIDENT = "respond_to_incident"
    REQUEST_CLARIFICATION = "request_clarification"
    SUBMIT_FINAL_REPORT = "submit_final_report"


class ActionResult(str, Enum):
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    DUPLICATE = "DUPLICATE"


class FindingStatus(str, Enum):
    PENDING = "PENDING"
    CITED = "CITED"
    REMEDIATED = "REMEDIATED"
    RETRACTED = "RETRACTED"


class IncidentResponseType(str, Enum):
    NOTIFY_SUPERVISORY_AUTHORITY = "notify_supervisory_authority"
    NOTIFY_DATA_SUBJECTS = "notify_data_subjects"
    CONTAIN_BREACH = "contain_breach"
    DOCUMENT_INCIDENT = "document_incident"
    ENGAGE_DPO = "engage_dpo"


# ─── Document Models ───────────────────────────────────────────────────────────

class Section(BaseModel):
    section_id: str
    title: str
    content: str
    subsections: list["Section"] = Field(default_factory=list)


class Document(BaseModel):
    doc_id: str
    title: str
    sections: list[Section]


# ─── Evidence & Findings ───────────────────────────────────────────────────────

class EvidenceCitation(BaseModel):
    citation_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    finding_id: str
    passage_text: str
    passage_location: str
    score: float = 0.0


class Finding(BaseModel):
    finding_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    clause_ref: str
    gap_type: GapType
    severity: Severity
    description: str
    status: FindingStatus = FindingStatus.PENDING
    framework: Framework | None = None


class Remediation(BaseModel):
    remediation_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    finding_id: str
    text: str
    target_framework: Framework | None = None
    quality_score: float = 0.0


# ─── Regulatory Context ────────────────────────────────────────────────────────

class RegulatoryContext(BaseModel):
    frameworks_in_scope: list[Framework]
    applicable_articles: dict[str, list[str]] = Field(default_factory=dict)


# ─── Incident Models ───────────────────────────────────────────────────────────

class IncidentEvent(BaseModel):
    step: int
    event_type: str
    description: str


class Incident(BaseModel):
    incident_id: str
    incident_type: str
    records_affected: int
    discovered_at_step: int
    deadline_steps: int
    description: str
    required_responses: list[IncidentResponseType]
    completed_responses: list[IncidentResponseType] = Field(default_factory=list)


# ─── Action Model ─────────────────────────────────────────────────────────────

class ARIAAction(BaseModel):
    action_type: ActionType

    # request_section
    document_id: str | None = None
    section_id: str | None = None

    # identify_gap
    clause_ref: str | None = None
    gap_type: GapType | None = None
    severity: Severity | None = None
    description: str | None = None

    # cite_evidence
    finding_id: str | None = None
    passage_text: str | None = None
    passage_location: str | None = None

    # submit_remediation
    remediation_text: str | None = None
    target_framework: Framework | None = None

    # escalate_conflict
    framework_a: Framework | None = None
    framework_b: Framework | None = None
    conflict_desc: str | None = None

    # respond_to_incident
    incident_id: str | None = None
    response_type: IncidentResponseType | None = None
    response_detail: str | None = None

    # flag_false_positive
    retract_finding_id: str | None = None


# ─── Observation Model ────────────────────────────────────────────────────────

class ARIAObservation(BaseModel):
    # Episode context
    session_id: str
    task_id: str
    task_description: str
    regulatory_context: RegulatoryContext

    # Documents
    documents: list[Document]
    visible_sections: list[str] = Field(default_factory=list)

    # Agent's work
    active_findings: list[Finding] = Field(default_factory=list)
    retracted_findings: list[Finding] = Field(default_factory=list)
    submitted_remediations: list[Remediation] = Field(default_factory=list)

    # Immediate feedback
    last_action: ActionType | None = None
    last_action_result: ActionResult = ActionResult.ACCEPTED
    last_reward: float = 0.0
    last_reward_reason: str = "Episode started"

    # Running totals
    cumulative_reward: float = 0.0
    steps_taken: int = 0
    steps_remaining: int = 15

    # Episode status
    done: bool = False
    phase: Literal["reading", "auditing", "remediating", "complete"] = "reading"

    # Evidence chain
    evidence_citations: list[EvidenceCitation] = Field(default_factory=list)

    # Expert mode
    active_incident: Incident | None = None
    incident_timeline: list[IncidentEvent] = Field(default_factory=list)
    incident_deadline_steps: int | None = None


# ─── Reward Model ─────────────────────────────────────────────────────────────

class ARIAReward(BaseModel):
    reward: float
    reason: str
    action_result: ActionResult


# ─── Grade Result ─────────────────────────────────────────────────────────────

class F1Score(BaseModel):
    precision: float
    recall: float
    f1: float
    tp: int
    fp: int
    fn: int


class GradeResult(BaseModel):
    score: float  # 0.0 – 1.0 final composite
    f1_score: F1Score
    evidence_score: float
    severity_accuracy: float
    remediation_score: float
    conflict_score: float
    efficiency_bonus: float
    breakdown: dict[str, float] = Field(default_factory=dict)
    session_id: str = ""
    task_id: str = ""