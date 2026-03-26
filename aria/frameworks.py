"""
ARIA — Regulatory Framework Registry
Full rule specifications for GDPR, HIPAA, CCPA, SOC 2.
"""
from __future__ import annotations
from aria.models import Framework, GapType

# ─── Framework Article Registry ───────────────────────────────────────────────

FRAMEWORK_REGISTRY: dict[str, dict] = {
    "GDPR": {
        "full_name": "General Data Protection Regulation",
        "jurisdiction": "EU / EEA",
        "max_fine": "€20M or 4% global turnover",
        "articles": {
            "Article 5": "Principles relating to processing of personal data",
            "Article 5(1)(a)": "Lawfulness, fairness and transparency",
            "Article 5(1)(b)": "Purpose limitation",
            "Article 5(1)(c)": "Data minimisation",
            "Article 5(1)(e)": "Storage limitation — data must not be kept longer than necessary",
            "Article 6": "Lawfulness of processing — requires legal basis",
            "Article 7": "Conditions for consent — must be freely given, specific, informed, unambiguous",
            "Article 12": "Transparent information — data subjects must be informed clearly",
            "Article 13": "Information to be provided where data collected from data subject",
            "Article 14": "Information to be provided where data not obtained from data subject",
            "Article 15": "Right of access by data subject",
            "Article 16": "Right to rectification",
            "Article 17": "Right to erasure ('right to be forgotten')",
            "Article 18": "Right to restriction of processing",
            "Article 20": "Right to data portability",
            "Article 21": "Right to object",
            "Article 25": "Data protection by design and by default",
            "Article 28": "Processor requirements — DPA required",
            "Article 30": "Records of processing activities",
            "Article 33": "Notification of breach to supervisory authority — within 72 hours",
            "Article 34": "Communication of breach to data subject",
            "Article 35": "Data protection impact assessment",
            "Article 37": "Designation of data protection officer",
            "Article 44": "General principle for transfers",
            "Article 46": "Transfers subject to appropriate safeguards",
        },
        "gap_types": [
            GapType.DATA_RETENTION,
            GapType.CONSENT_MECHANISM,
            GapType.BREACH_NOTIFICATION,
            GapType.DATA_SUBJECT_RIGHTS,
            GapType.CROSS_BORDER_TRANSFER,
            GapType.DATA_MINIMIZATION,
            GapType.PURPOSE_LIMITATION,
            GapType.DPO_REQUIREMENT,
        ],
        "breach_notification_hours": 72,
    },
    "HIPAA": {
        "full_name": "Health Insurance Portability and Accountability Act",
        "jurisdiction": "United States (healthcare)",
        "max_fine": "$1.9M per violation category",
        "articles": {
            "45 CFR 164.306": "Security standards: general rules",
            "45 CFR 164.308": "Administrative safeguards",
            "45 CFR 164.310": "Physical safeguards",
            "45 CFR 164.312": "Technical safeguards",
            "45 CFR 164.314": "Organizational requirements — BAA required",
            "45 CFR 164.316": "Policies and procedures and documentation requirements",
            "45 CFR 164.402": "Definition of breach",
            "45 CFR 164.404": "Notification to individuals — 60 days after discovery",
            "45 CFR 164.406": "Notification to media",
            "45 CFR 164.408": "Notification to Secretary of HHS",
            "45 CFR 164.410": "Notification by a Business Associate",
            "45 CFR 164.502": "Uses and disclosures of PHI — minimum necessary standard",
            "45 CFR 164.514": "De-identification of PHI",
            "45 CFR 164.524": "Access of individuals to PHI",
            "45 CFR 164.526": "Amendment of PHI",
            "45 CFR 164.528": "Accounting of disclosures of PHI",
        },
        "gap_types": [
            GapType.PHI_SAFEGUARD,
            GapType.BAA_REQUIREMENT,
            GapType.BREACH_NOTIFICATION,
            GapType.AUDIT_LOG_REQUIREMENT,
            GapType.DATA_MINIMIZATION,
        ],
        "breach_notification_days": 60,
    },
    "CCPA": {
        "full_name": "California Consumer Privacy Act / CPRA",
        "jurisdiction": "California, USA",
        "max_fine": "$7,500 per intentional violation",
        "articles": {
            "1798.100": "Right to know about personal information collected",
            "1798.105": "Right to delete personal information",
            "1798.106": "Right to correct inaccurate personal information",
            "1798.110": "Right to know categories and specific pieces",
            "1798.115": "Right to know disclosures for business purposes",
            "1798.120": "Right to opt-out of sale or sharing of personal information",
            "1798.121": "Right to limit use and disclosure of sensitive personal information",
            "1798.125": "Non-discrimination for exercising rights",
            "1798.130": "Notice and methods for submitting requests",
            "1798.135": "Opt-out required — 'Do Not Sell or Share My Personal Information' link",
            "1798.150": "Private right of action for data breaches",
            "1798.185": "Regulations — data broker registration required",
        },
        "gap_types": [
            GapType.OPT_OUT_MECHANISM,
            GapType.DATA_SUBJECT_RIGHTS,
            GapType.CONSENT_MECHANISM,
            GapType.DATA_RETENTION,
            GapType.PURPOSE_LIMITATION,
        ],
        "breach_notification_days": 30,
    },
    "SOC2": {
        "full_name": "SOC 2 Type II — Trust Services Criteria",
        "jurisdiction": "Global (SaaS/cloud)",
        "max_fine": "Loss of certification, enterprise contract loss",
        "articles": {
            "CC1": "Control Environment — COSO principles",
            "CC2": "Communication and Information",
            "CC3": "Risk Assessment",
            "CC4": "Monitoring Activities",
            "CC5": "Control Activities",
            "CC6": "Logical and Physical Access Controls",
            "CC7": "System Operations — incident management and monitoring",
            "CC8": "Change Management",
            "CC9": "Risk Mitigation",
            "A1": "Availability — uptime and SLA commitments",
            "C1": "Confidentiality — classification and protection",
            "PI1": "Processing Integrity — complete, accurate, timely processing",
            "P1": "Privacy — notice and communication",
            "P2": "Privacy — choice and consent",
            "P3": "Privacy — collection",
            "P4": "Privacy — use, retention, and disposal",
            "P5": "Privacy — access",
            "P6": "Privacy — disclosure and notification",
            "P7": "Privacy — quality",
            "P8": "Privacy — monitoring and enforcement",
        },
        "gap_types": [
            GapType.AUDIT_LOG_REQUIREMENT,
            GapType.AVAILABILITY_CONTROL,
            GapType.DATA_RETENTION,
            GapType.BREACH_NOTIFICATION,
        ],
    },
}


# ─── Cross-Framework Conflicts ─────────────────────────────────────────────────

KNOWN_CONFLICTS = [
    {
        "conflict_id": "gdpr_hipaa_breach_timeline",
        "framework_a": Framework.GDPR,
        "framework_b": Framework.HIPAA,
        "description": (
            "GDPR requires breach notification to supervisory authority within 72 hours. "
            "HIPAA allows up to 60 days for individual notification (and 60 days for HHS). "
            "Organizations subject to both must apply the stricter GDPR timeline for EU data subjects."
        ),
        "resolution": "Apply 72-hour GDPR deadline for EU-resident data subjects; 60-day HIPAA for US-only.",
        "gap_types": [GapType.BREACH_NOTIFICATION],
    },
    {
        "conflict_id": "gdpr_ccpa_consent_model",
        "framework_a": Framework.GDPR,
        "framework_b": Framework.CCPA,
        "description": (
            "GDPR requires opt-in consent before processing personal data for most purposes. "
            "CCPA operates on an opt-out model — processing is permitted unless the consumer opts out of sale/sharing. "
            "A policy that satisfies CCPA opt-out may still violate GDPR's opt-in requirement for EU users."
        ),
        "resolution": "Implement opt-in for EU users, opt-out for California users, with clear jurisdiction detection.",
        "gap_types": [GapType.CONSENT_MECHANISM, GapType.OPT_OUT_MECHANISM],
    },
    {
        "conflict_id": "gdpr_hipaa_retention",
        "framework_a": Framework.GDPR,
        "framework_b": Framework.HIPAA,
        "description": (
            "GDPR's storage limitation principle requires deletion when data is no longer necessary. "
            "HIPAA requires medical records to be retained for a minimum of 6 years from creation. "
            "Health data subject to both frameworks must be retained at least 6 years (HIPAA) "
            "but no longer than necessary (GDPR)."
        ),
        "resolution": "Retain for HIPAA's 6-year minimum, delete immediately thereafter if no longer necessary under GDPR.",
        "gap_types": [GapType.DATA_RETENTION],
    },
    {
        "conflict_id": "gdpr_ccpa_deletion_rights",
        "framework_a": Framework.GDPR,
        "framework_b": Framework.CCPA,
        "description": (
            "Both GDPR (Article 17) and CCPA (1798.105) provide rights to deletion, but with different exceptions. "
            "GDPR allows retention for legal claims; CCPA allows retention for security debugging. "
            "A unified deletion procedure must satisfy both exception sets."
        ),
        "resolution": "Implement deletion that evaluates both GDPR and CCPA exception criteria before declining.",
        "gap_types": [GapType.DATA_SUBJECT_RIGHTS],
    },
]


def get_applicable_articles(framework: str, gap_type: GapType) -> list[str]:
    """Return relevant articles for a framework + gap_type combination."""
    fw = FRAMEWORK_REGISTRY.get(framework, {})
    articles = fw.get("articles", {})

    GAP_TO_ARTICLES: dict[GapType, dict[str, list[str]]] = {
        GapType.DATA_RETENTION: {
            "GDPR": ["Article 5(1)(e)", "Article 30"],
            "HIPAA": ["45 CFR 164.316"],
            "CCPA": ["1798.100"],
            "SOC2": ["P4"],
        },
        GapType.CONSENT_MECHANISM: {
            "GDPR": ["Article 6", "Article 7"],
            "CCPA": ["1798.120", "1798.135"],
        },
        GapType.BREACH_NOTIFICATION: {
            "GDPR": ["Article 33", "Article 34"],
            "HIPAA": ["45 CFR 164.404", "45 CFR 164.408"],
            "CCPA": ["1798.150"],
            "SOC2": ["CC7"],
        },
        GapType.DATA_SUBJECT_RIGHTS: {
            "GDPR": ["Article 15", "Article 16", "Article 17", "Article 18", "Article 20", "Article 21"],
            "CCPA": ["1798.100", "1798.105", "1798.106", "1798.120"],
        },
        GapType.CROSS_BORDER_TRANSFER: {
            "GDPR": ["Article 44", "Article 46"],
        },
        GapType.DATA_MINIMIZATION: {
            "GDPR": ["Article 5(1)(c)"],
            "HIPAA": ["45 CFR 164.502"],
        },
        GapType.PURPOSE_LIMITATION: {
            "GDPR": ["Article 5(1)(b)"],
            "CCPA": ["1798.100"],
        },
        GapType.DPO_REQUIREMENT: {
            "GDPR": ["Article 37"],
        },
        GapType.PHI_SAFEGUARD: {
            "HIPAA": ["45 CFR 164.306", "45 CFR 164.308", "45 CFR 164.312"],
        },
        GapType.BAA_REQUIREMENT: {
            "HIPAA": ["45 CFR 164.314"],
        },
        GapType.OPT_OUT_MECHANISM: {
            "CCPA": ["1798.120", "1798.135"],
        },
        GapType.AUDIT_LOG_REQUIREMENT: {
            "HIPAA": ["45 CFR 164.312", "45 CFR 164.528"],
            "SOC2": ["CC7", "CC4"],
        },
        GapType.AVAILABILITY_CONTROL: {
            "SOC2": ["A1", "CC7"],
        },
    }

    mapping = GAP_TO_ARTICLES.get(gap_type, {})
    article_keys = mapping.get(framework, [])
    return [articles[k] for k in article_keys if k in articles]


def get_conflicts(framework_a: str, framework_b: str) -> list[dict]:
    """Return known conflicts between two frameworks."""
    fa = Framework(framework_a)
    fb = Framework(framework_b)
    return [
        c for c in KNOWN_CONFLICTS
        if {c["framework_a"], c["framework_b"]} == {fa, fb}
    ]