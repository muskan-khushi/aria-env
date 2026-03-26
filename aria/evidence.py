"""
ARIA — Evidence Chain Validator
Scores citation quality 0.0–1.0 across location, text match, relevance, violation signal.
"""
from __future__ import annotations
from difflib import SequenceMatcher
from aria.models import (
    Finding, EvidenceCitation, Document, GapType
)

# Keywords per gap type for relevance scoring
GAP_KEYWORDS: dict[GapType, list[str]] = {
    GapType.DATA_RETENTION: [
        "retain", "retention", "store", "storage", "delete", "deletion",
        "purge", "archive", "period", "duration", "longer than necessary",
        "maximum", "expiry", "expiration", "years", "months",
    ],
    GapType.CONSENT_MECHANISM: [
        "consent", "agree", "opt-in", "opt in", "permission", "authorize",
        "authorization", "freely given", "specific", "informed", "unambiguous",
        "withdraw", "withdrawal", "prior to",
    ],
    GapType.BREACH_NOTIFICATION: [
        "breach", "notification", "notify", "incident", "supervisory",
        "authority", "72 hours", "60 days", "report", "dpa", "hhs",
        "without undue delay", "article 33",
    ],
    GapType.DATA_SUBJECT_RIGHTS: [
        "right", "access", "erasure", "delete", "rectification", "portability",
        "object", "restrict", "restriction", "data subject", "request",
        "respond", "response", "30 days", "without undue delay",
    ],
    GapType.CROSS_BORDER_TRANSFER: [
        "transfer", "third country", "international", "adequacy", "standard",
        "contractual", "clauses", "binding", "corporate", "rules", "schrems",
        "privacy shield", "dpf", "data privacy framework",
    ],
    GapType.DATA_MINIMIZATION: [
        "minimum necessary", "minimization", "minimise", "minimize", "only",
        "necessary", "relevant", "limited", "proportionate", "adequate",
    ],
    GapType.PURPOSE_LIMITATION: [
        "purpose", "original purpose", "compatible", "incompatible",
        "collect", "further processing", "secondary use",
    ],
    GapType.DPO_REQUIREMENT: [
        "data protection officer", "dpo", "appoint", "appointment",
        "designate", "designation", "article 37",
    ],
    GapType.PHI_SAFEGUARD: [
        "phi", "protected health information", "safeguard", "encrypt",
        "encryption", "access control", "minimum necessary", "hipaa",
        "covered entity", "healthcare",
    ],
    GapType.BAA_REQUIREMENT: [
        "business associate", "baa", "agreement", "contract", "vendor",
        "third party", "subcontractor", "service provider",
    ],
    GapType.OPT_OUT_MECHANISM: [
        "opt-out", "opt out", "do not sell", "do not share", "opting out",
        "unsubscribe", "decline", "california", "ccpa", "cpra",
    ],
    GapType.AUDIT_LOG_REQUIREMENT: [
        "audit", "log", "logging", "record", "monitor", "monitoring",
        "track", "tracking", "event", "activity", "trail",
    ],
    GapType.AVAILABILITY_CONTROL: [
        "uptime", "availability", "sla", "downtime", "redundancy",
        "backup", "recovery", "rpo", "rto", "disaster", "continuity",
    ],
}

# Violation signal keywords per gap type (absence implies non-compliance)
VIOLATION_SIGNALS: dict[GapType, dict] = {
    GapType.DATA_RETENTION: {
        "absent": ["maximum", "no longer than", "delete after", "years", "months", "days"],
        "present_bad": ["as long as necessary", "indefinitely", "as needed", "when required"],
    },
    GapType.CONSENT_MECHANISM: {
        "absent": ["explicit consent", "opt-in", "freely given", "withdraw"],
        "present_bad": ["by using our service you agree", "implied consent", "assumed consent"],
    },
    GapType.BREACH_NOTIFICATION: {
        "absent": ["72 hours", "without undue delay", "supervisory authority"],
        "present_bad": ["we may notify", "at our discretion", "when appropriate"],
    },
    GapType.DATA_SUBJECT_RIGHTS: {
        "absent": ["may request", "right to access", "right to delete", "right to erasure"],
        "present_bad": ["we are not obligated", "not required to", "may decline all requests"],
    },
    GapType.CROSS_BORDER_TRANSFER: {
        "absent": ["standard contractual clauses", "adequacy decision", "appropriate safeguards"],
        "present_bad": ["may transfer data internationally", "no restrictions on transfer"],
    },
    GapType.DATA_MINIMIZATION: {
        "absent": ["only collect", "minimum necessary", "limited to"],
        "present_bad": ["collect all available", "gather comprehensive", "maximum information"],
    },
    GapType.DPO_REQUIREMENT: {
        "absent": ["data protection officer", "dpo"],
        "present_bad": [],
    },
    GapType.OPT_OUT_MECHANISM: {
        "absent": ["opt-out", "do not sell", "opt out"],
        "present_bad": ["no opt-out", "cannot opt out", "waive your right"],
    },
}


class EvidenceScore:
    def __init__(self, score: float, reason: str):
        self.score = score
        self.reason = reason


class EvidenceChainValidator:
    """
    Validates evidence citations 0.0 – 1.0 across four criteria:
    1. Location exists (0.20)
    2. Text fuzzy-matches that section (0.20)
    3. Gap relevance of the passage (0.30)
    4. Violation signal present in passage (0.30)
    """

    def validate(
        self,
        finding: Finding,
        citation: EvidenceCitation,
        documents: list[Document],
    ) -> EvidenceScore:
        # Step 1: Location check
        section_content = self._find_section(citation.passage_location, documents)
        if not section_content:
            return EvidenceScore(0.0, f"Section not found: {citation.passage_location}")

        score = 0.20  # location found

        # Step 2: Fuzzy text match
        text_ratio = SequenceMatcher(
            None,
            citation.passage_text.lower().strip(),
            section_content.lower().strip(),
        ).ratio()

        if text_ratio >= 0.55:
            score += 0.20
            text_note = f"{text_ratio:.0%} text match"
        elif text_ratio >= 0.30:
            score += 0.10
            text_note = f"partial text match ({text_ratio:.0%})"
        else:
            text_note = f"low text match ({text_ratio:.0%})"

        # Step 3: Keyword relevance
        relevance = self._score_keyword_relevance(citation.passage_text, finding.gap_type)
        score += relevance * 0.30
        relevance_note = f"{relevance:.0%} relevance"

        # Step 4: Violation signal
        violation_score = self._check_violation_signal(
            citation.passage_text, finding.gap_type
        )
        score += violation_score * 0.30
        violation_note = f"{violation_score:.0%} violation signal"

        return EvidenceScore(
            score=min(1.0, score),
            reason=f"Evidence: {text_note}, {relevance_note}, {violation_note}",
        )

    def _find_section(
        self, passage_location: str, documents: list[Document]
    ) -> str | None:
        """Find section content by location string 'doc_id.section_id' or 'doc_id.section_id.subsection_id'."""
        parts = passage_location.lower().split(".")
        if len(parts) < 2:
            return None

        doc_id = parts[0]
        section_id = parts[1]

        for doc in documents:
            if doc.doc_id.lower() != doc_id:
                continue
            for section in doc.sections:
                if section.section_id.lower() == section_id:
                    if len(parts) >= 3:
                        # Look in subsections
                        for sub in section.subsections:
                            if sub.section_id.lower() == parts[2]:
                                return sub.content
                    return section.content
        return None

    def _score_keyword_relevance(self, text: str, gap_type: GapType) -> float:
        """Score how relevant the passage text is to the gap type (0.0–1.0)."""
        text_lower = text.lower()
        keywords = GAP_KEYWORDS.get(gap_type, [])
        if not keywords:
            return 0.5
        hits = sum(1 for kw in keywords if kw in text_lower)
        return min(1.0, hits / max(3, len(keywords) // 3))

    def _check_violation_signal(self, text: str, gap_type: GapType) -> float:
        """
        Check whether the passage signals non-compliance.
        Returns 0.0–1.0: absence of required language OR presence of bad language.
        """
        text_lower = text.lower()
        signals = VIOLATION_SIGNALS.get(gap_type)
        if not signals:
            return 0.5

        # Check for absence of required terms (strong violation signal)
        absent_terms = signals.get("absent", [])
        if absent_terms:
            missing = sum(1 for t in absent_terms if t.lower() not in text_lower)
            absence_score = missing / len(absent_terms)
        else:
            absence_score = 0.0

        # Check for presence of bad language (direct violation signal)
        bad_terms = signals.get("present_bad", [])
        if bad_terms:
            found_bad = sum(1 for t in bad_terms if t.lower() in text_lower)
            bad_score = min(1.0, found_bad / max(1, len(bad_terms)))
        else:
            bad_score = 0.0

        return min(1.0, (absence_score * 0.6 + bad_score * 0.4))