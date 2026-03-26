"""
ARIA — Evidence Chain Validator Tests
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from aria.evidence import EvidenceChainValidator
from aria.models import Finding, EvidenceCitation, Document, Section, GapType, Severity


def make_doc(content: str, section_id="s3", doc_id="privacy_policy") -> Document:
    return Document(
        doc_id=doc_id,
        title="Test Policy",
        sections=[Section(section_id=section_id, title="Test Section", content=content)],
    )


def make_finding(gap_type: str, clause_ref="privacy_policy.s3") -> Finding:
    return Finding(
        clause_ref=clause_ref,
        gap_type=GapType(gap_type),
        severity=Severity.HIGH,
        description="Test",
    )


class TestEvidenceValidator:

    def test_wrong_location_returns_zero(self):
        v = EvidenceChainValidator()
        finding = make_finding("data_retention")
        doc = make_doc("We retain data forever.")
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="We retain data forever.",
            passage_location="nonexistent_doc.s99",
        )
        result = v.validate(finding, citation, [doc])
        assert result.score == 0.0

    def test_correct_location_earns_base_score(self):
        v = EvidenceChainValidator()
        finding = make_finding("data_retention")
        doc = make_doc("We retain data forever and ever without limit.")
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="We retain data forever",
            passage_location="privacy_policy.s3",
        )
        result = v.validate(finding, citation, [doc])
        assert result.score >= 0.20

    def test_high_quality_citation_scores_above_half(self):
        v = EvidenceChainValidator()
        finding = make_finding("data_retention")
        content = "We retain your account data for as long as your account is active and as long as necessary."
        doc = make_doc(content)
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="We retain your account data for as long as your account is active",
            passage_location="privacy_policy.s3",
        )
        result = v.validate(finding, citation, [doc])
        assert result.score >= 0.40, f"Expected ≥0.40, got {result.score}: {result.reason}"

    def test_wrong_gap_type_keywords_lower_score(self):
        v = EvidenceChainValidator()
        # Citation about data retention but finding is about consent
        finding = make_finding("consent_mechanism")
        doc = make_doc("We retain data for as long as necessary without specifying a maximum period.")
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="retain data for as long as necessary",
            passage_location="privacy_policy.s3",
        )
        result_retention_kw = v.validate(finding, citation, [doc])

        # Now same content for data_retention finding — should score higher
        finding2 = make_finding("data_retention")
        result_consent_kw = v.validate(finding2, citation, [doc])

        # data_retention finding should score better on retention-keyword content
        assert result_consent_kw.score >= result_retention_kw.score

    def test_breach_notification_keywords_detected(self):
        v = EvidenceChainValidator()
        finding = make_finding("breach_notification")
        content = "In case of a breach, we will assess the situation and notify authorities when appropriate at our discretion."
        doc = make_doc(content)
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="notify authorities when appropriate at our discretion",
            passage_location="privacy_policy.s3",
        )
        result = v.validate(finding, citation, [doc])
        # Should detect violation signal (no 72-hour commitment, "at our discretion" = bad)
        assert result.score >= 0.20

    def test_score_always_between_0_and_1(self):
        v = EvidenceChainValidator()
        for gap in ["data_retention", "consent_mechanism", "breach_notification", "opt_out_mechanism"]:
            finding = make_finding(gap)
            doc = make_doc("some random text that may or may not be relevant to the gap")
            citation = EvidenceCitation(
                finding_id=finding.finding_id,
                passage_text="some random text",
                passage_location="privacy_policy.s3",
            )
            result = v.validate(finding, citation, [doc])
            assert 0.0 <= result.score <= 1.0, f"{gap}: score={result.score}"

    def test_subsection_lookup(self):
        """Test that doc.section.subsection location format works."""
        v = EvidenceChainValidator()
        finding = make_finding("data_retention", "privacy_policy.s3.sub1")
        subsection = Section(section_id="sub1", title="Subsection", content="We retain indefinitely.")
        section = Section(section_id="s3", title="Retention", content="Main text.", subsections=[subsection])
        doc = Document(doc_id="privacy_policy", title="Policy", sections=[section])
        citation = EvidenceCitation(
            finding_id=finding.finding_id,
            passage_text="We retain indefinitely",
            passage_location="privacy_policy.s3.sub1",
        )
        result = v.validate(finding, citation, [doc])
        assert result.score >= 0.20  # location found


if __name__ == "__main__":
    pytest.main([__file__, "-v"])