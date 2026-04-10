"""
ARIA — Evidence Chain Validator  (v2 — anti-gaming)
Scores citation quality 0.0–1.0 across location, text match, relevance, violation signal.

v2 changes:
- _find_section() now returns a WINDOWED excerpt (±250 chars around the most relevant
  keyword) instead of the full section content. This closes the "paste the whole section"
  exploit: agents submitting the full 600-char section against a 250-char window score
  poorly on fuzzy match unless they actually found the right passage.
- Added verbosity penalty: passage_text longer than 300 chars gets a length penalty
  applied to the text_match component, discouraging full-section copy-paste.
- Added passage specificity check: if passage_text is longer than 80% of the section
  content, cap the text match component at 0.10 regardless of fuzzy ratio.
- Conflict description scoring: now used by grader.py for conflict_score.
"""
from __future__ import annotations
import re
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

# Conflict description keywords — used by grader to score conflict quality
CONFLICT_KEYWORDS: dict[tuple[str, str], list[str]] = {
    ("GDPR", "HIPAA"): [
        "72 hours", "60 days", "erasure", "retention", "6 years", "notification",
        "supervisory authority", "HHS", "article 33", "article 17",
    ],
    ("GDPR", "CCPA"): [
        "opt-in", "opt-out", "consent", "advertising", "jurisdiction",
        "eu users", "california", "article 6", "article 7", "1798.120",
    ],
    ("HIPAA", "CCPA"): [
        "PHI", "healthcare", "california", "sensitive", "limit use",
        "opt-out", "service provider", "1798.121", "cpra",
    ],
    ("GDPR", "SOC2"): [
        "availability", "uptime", "sla", "data subject", "erasure",
    ],
}


# Maximum characters for the windowed excerpt returned from _find_section
_WINDOW_CHARS = 300
# If passage_text is longer than this fraction of section content, penalize
_VERBOSITY_FRACTION = 0.70
# Hard cap on text_match score for verbatim/near-verbatim full-section submissions
_VERBOSITY_CAP = 0.08


class EvidenceScore:
    def __init__(self, score: float, reason: str):
        self.score = score
        self.reason = reason


class EvidenceChainValidator:
    """
    Validates evidence citations 0.0 – 1.0 across four criteria:
    1. Location exists (0.20)
    2. Text fuzzy-matches the WINDOWED excerpt at that location (0.20)
    3. Gap relevance of the passage (0.30)
    4. Violation signal present in passage (0.30)

    Anti-gaming:
    - Section content is windowed to ±300 chars around the most relevant keyword.
      Full-section copy-paste will score poorly on fuzzy match.
    - Verbosity penalty: if passage_text is longer than 70% of section content,
      text_match is capped at 0.08 regardless of fuzzy ratio.
    """

    def validate(
        self,
        finding: Finding,
        citation: EvidenceCitation,
        documents: list[Document],
    ) -> EvidenceScore:
        # Step 1: Location check — get windowed excerpt
        full_section_content, windowed_content = self._find_section_with_window(
            citation.passage_location, documents, finding.gap_type
        )
        if windowed_content is None:
            return EvidenceScore(0.0, f"Section not found: {citation.passage_location}")

        score = 0.20  # location found

        # Step 2: Fuzzy text match against WINDOWED content (anti-gaming)
        passage_lower = citation.passage_text.lower().strip()
        window_lower = windowed_content.lower().strip()

        # Verbosity check: penalize full-section copies
        section_len = len(full_section_content)
        passage_len = len(citation.passage_text)
        is_verbatim_copy = (
            section_len > 0 and (passage_len / section_len) >= _VERBOSITY_FRACTION
        )

        text_ratio = SequenceMatcher(
            None,
            passage_lower,
            window_lower,
        ).ratio()

        if is_verbatim_copy:
            # Hard cap — copying the whole section is not valid evidence
            text_component = _VERBOSITY_CAP
            text_note = f"verbatim section copy (capped at {_VERBOSITY_CAP:.0%})"
        elif text_ratio >= 0.55:
            text_component = 0.20
            text_note = f"{text_ratio:.0%} text match"
        elif text_ratio >= 0.30:
            text_component = 0.10
            text_note = f"partial text match ({text_ratio:.0%})"
        else:
            text_component = 0.0
            text_note = f"low text match ({text_ratio:.0%})"

        score += text_component

        # Step 3: Keyword relevance — scored against passage_text (what agent submitted)
        relevance = self._score_keyword_relevance(citation.passage_text, finding.gap_type)
        score += relevance * 0.30
        relevance_note = f"{relevance:.0%} relevance"

        # Step 4: Violation signal — scored against passage_text
        violation_score = self._check_violation_signal(
            citation.passage_text, finding.gap_type
        )
        score += violation_score * 0.30
        violation_note = f"{violation_score:.0%} violation signal"

        return EvidenceScore(
            score=min(1.0, score),
            reason=f"Evidence: {text_note}, {relevance_note}, {violation_note}",
        )

    def score_conflict_description(
        self, framework_a: str, framework_b: str, conflict_desc: str
    ) -> float:
        """
        Score a conflict escalation description 0.0–1.0 based on keyword coverage.
        Returns 0.5 for unknown framework pairs (benefit of doubt).
        Returns 0.0–1.0 for known pairs based on how many expected keywords appear.
        Used by grader.py to differentiate genuine conflict understanding from
        "GDPR conflicts with HIPAA because I said so" gaming.
        """
        desc_lower = conflict_desc.lower() if conflict_desc else ""
        
        # Normalize pair for lookup (order-independent)
        pair = (framework_a, framework_b)
        reverse_pair = (framework_b, framework_a)
        
        keywords = CONFLICT_KEYWORDS.get(pair) or CONFLICT_KEYWORDS.get(reverse_pair)
        if not keywords:
            return 0.5  # Unknown pair — benefit of doubt
        
        hits = sum(1 for kw in keywords if kw.lower() in desc_lower)
        # Need at least 2 keywords to get partial credit; 4+ for full credit
        if hits == 0:
            return 0.0
        elif hits == 1:
            return 0.25
        else:
            return min(1.0, hits / 4.0)

    def _find_section_with_window(
        self,
        passage_location: str,
        documents: list[Document],
        gap_type: GapType,
    ) -> tuple[str, str | None]:
        """
        Returns (full_section_content, windowed_excerpt).
        windowed_excerpt is ±_WINDOW_CHARS around the first relevant keyword found.
        If no keyword found, returns a centered window.
        Returns ("", None) if section not found.
        """
        full_content = self._find_full_section(passage_location, documents)
        if full_content is None:
            return ("", None)

        window = self._extract_window(full_content, gap_type)
        return (full_content, window)

    def _find_full_section(
        self, passage_location: str, documents: list[Document]
    ) -> str | None:
        """Find full section content by location string."""
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
                        for sub in section.subsections:
                            if sub.section_id.lower() == parts[2]:
                                return sub.content
                    return section.content
        return None

    def _extract_window(self, content: str, gap_type: GapType) -> str:
        """
        Extract a ±_WINDOW_CHARS window around the first relevant keyword.
        Falls back to the first _WINDOW_CHARS*2 chars if no keyword found.
        This prevents gaming by submitting the full section as evidence.
        """
        content_lower = content.lower()
        keywords = GAP_KEYWORDS.get(gap_type, [])
        
        best_pos = -1
        for kw in keywords:
            pos = content_lower.find(kw.lower())
            if pos != -1:
                if best_pos == -1 or pos < best_pos:
                    best_pos = pos

        if best_pos == -1:
            # No relevant keyword found — return start window
            return content[:_WINDOW_CHARS * 2]

        start = max(0, best_pos - _WINDOW_CHARS // 2)
        end = min(len(content), best_pos + _WINDOW_CHARS)
        return content[start:end]

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

        absent_terms = signals.get("absent", [])
        if absent_terms:
            missing = sum(1 for t in absent_terms if t.lower() not in text_lower)
            absence_score = missing / len(absent_terms)
        else:
            absence_score = 0.0

        bad_terms = signals.get("present_bad", [])
        if bad_terms:
            found_bad = sum(1 for t in bad_terms if t.lower() in text_lower)
            bad_score = min(1.0, found_bad / max(1, len(bad_terms)))
        else:
            bad_score = 0.0

        return min(1.0, (absence_score * 0.6 + bad_score * 0.4))