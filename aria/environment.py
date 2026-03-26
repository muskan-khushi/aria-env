"""
ARIA — Main Environment Class
Implements the OpenEnv interface: reset(), step(), state(), grade().
"""
from __future__ import annotations
import json
import uuid
from pathlib import Path
from aria.models import (
    ARIAAction, ARIAObservation, ARIAReward, GradeResult,
    ActionType, ActionResult, FindingStatus,
    Finding, Remediation, EvidenceCitation, Incident, IncidentEvent,
    RegulatoryContext, Framework,
)
from aria.reward_engine import RewardEngine
from aria.grader import Grader


TASKS_DIR = Path(__file__).parent.parent / "tasks"


class ARIAEnv:
    """
    The core RL environment. Fully self-contained — no FastAPI dependency.
    Can be used standalone from any Python script.
    """

    def __init__(self):
        self._reward_engine = RewardEngine()
        self._grader = Grader()
        self._session_id: str = ""
        self._task: dict = {}
        self._obs: ARIAObservation | None = None
        self._escalated_conflicts: list[dict] = []
        self._done: bool = False

    # ─── OpenEnv Interface ────────────────────────────────────────────────────

    def reset(self, task_name: str = "easy", seed: int = 42) -> ARIAObservation:
        """Initialize a new episode. Returns initial ARIAObservation."""
        self._session_id = str(uuid.uuid4())[:12]
        self._task = self._load_task(task_name, seed)
        self._done = False
        self._escalated_conflicts = []

        # Re-init reward engine (resets spam window)
        self._reward_engine = RewardEngine()

        from aria.models import Document, Section
        documents = [
            Document(**doc) for doc in self._task.get("documents", [])
        ]

        frameworks_in_scope = [
            Framework(f) for f in self._task.get("frameworks_in_scope", ["GDPR"])
        ]

        reg_context = RegulatoryContext(
            frameworks_in_scope=frameworks_in_scope,
            applicable_articles=self._task.get("applicable_articles", {}),
        )

        self._obs = ARIAObservation(
            session_id=self._session_id,
            task_id=self._task["task_id"],
            task_description=self._task.get("title", "Compliance Audit"),
            regulatory_context=reg_context,
            documents=documents,
            visible_sections=[],
            active_findings=[],
            retracted_findings=[],
            submitted_remediations=[],
            last_action=None,
            last_action_result=ActionResult.ACCEPTED,
            last_reward=0.0,
            last_reward_reason="Episode initialized — begin by reading document sections",
            cumulative_reward=0.0,
            steps_taken=0,
            steps_remaining=self._task.get("max_steps", 15),
            done=False,
            phase="reading",
            evidence_citations=[],
            active_incident=None,
            incident_timeline=[],
            incident_deadline_steps=None,
        )
        return self._obs

    def step(self, action: ARIAAction) -> tuple[ARIAObservation, float, bool, dict]:
        """
        Advance the episode by one action.
        Returns: (observation, reward, done, info)
        """
        if self._done or self._obs is None:
            raise RuntimeError("Episode is done. Call reset() to start a new episode.")

        obs = self._obs
        gt = self._task.get("ground_truth", {})
        max_steps = self._task.get("max_steps", 15)

        # Validate action
        validation_error = self._validate_action(action, obs)
        if validation_error:
            reward_obj = ARIAReward(
                reward=-0.05,
                reason=validation_error,
                action_result=ActionResult.REJECTED,
            )
            obs.last_action = action.action_type
            obs.last_action_result = ActionResult.REJECTED
            obs.last_reward = reward_obj.reward
            obs.last_reward_reason = reward_obj.reason
            obs.cumulative_reward += reward_obj.reward
            obs.steps_taken += 1
            obs.steps_remaining = max(0, max_steps - obs.steps_taken)
            return obs, reward_obj.reward, False, {"error": validation_error}

        # Check for incident trigger (Expert tasks)
        incident_cfg = self._task.get("incident")
        if (incident_cfg and obs.active_incident is None
                and obs.steps_taken >= incident_cfg.get("trigger_step", 9999)):
            self._trigger_incident(obs, incident_cfg)

        # Phase penalty check
        phase_penalty = self._reward_engine.check_phase_violation(action, obs.phase)

        # Compute reward
        reward_obj = self._reward_engine.compute(action, obs, gt)
        total_reward = reward_obj.reward + phase_penalty

        # Apply state transitions
        self._apply_action(action, obs, reward_obj)

        # Update episode metadata
        obs.steps_taken += 1
        obs.steps_remaining = max(0, max_steps - obs.steps_taken)
        obs.last_action = action.action_type
        obs.last_action_result = reward_obj.action_result
        obs.last_reward = total_reward
        obs.last_reward_reason = reward_obj.reason
        if phase_penalty != 0.0:
            obs.last_reward_reason += f" (phase warning: {phase_penalty:+.2f})"
        obs.cumulative_reward += total_reward

        # Update phase
        obs.phase = self._compute_phase(obs, max_steps)

        # Check done conditions
        done = (
            action.action_type == ActionType.SUBMIT_FINAL_REPORT
            or obs.steps_remaining <= 0
        )
        if done:
            obs.done = True
            obs.phase = "complete"
        self._done = done

        return obs, total_reward, done, {}

    def state(self) -> ARIAObservation:
        """Return current observation without advancing the episode."""
        if self._obs is None:
            raise RuntimeError("No active episode. Call reset() first.")
        return self._obs

    def grade(self) -> GradeResult:
        """Grade the completed episode deterministically."""
        if self._obs is None:
            raise RuntimeError("No active episode to grade.")
        obs = self._obs
        gt = self._task.get("ground_truth", {})
        result = self._grader.score(
            submitted_findings=obs.active_findings + obs.retracted_findings,
            submitted_remediations=obs.submitted_remediations,
            submitted_citations=obs.evidence_citations,
            escalated_conflicts=self._escalated_conflicts,
            ground_truth=gt,
            steps_taken=obs.steps_taken,
            max_steps=self._task.get("max_steps", 15),
            documents=obs.documents,
        )
        result.session_id = self._session_id
        result.task_id = self._task.get("task_id", "")
        return result

    # ─── State Transitions ────────────────────────────────────────────────────

    def _apply_action(
        self, action: ARIAAction, obs: ARIAObservation, reward_obj: ARIAReward
    ) -> None:
        """Update the observation state based on the action taken."""
        atype = action.action_type

        if atype == ActionType.REQUEST_SECTION:
            loc = f"{action.document_id}.{action.section_id}"
            if loc not in obs.visible_sections:
                obs.visible_sections.append(loc)

        elif atype == ActionType.IDENTIFY_GAP:
            if reward_obj.action_result != ActionResult.DUPLICATE:
                finding = Finding(
                    clause_ref=action.clause_ref or "",
                    gap_type=action.gap_type,
                    severity=action.severity,
                    description=action.description or "",
                    status=FindingStatus.PENDING,
                    framework=action.target_framework,
                )
                obs.active_findings.append(finding)

        elif atype == ActionType.CITE_EVIDENCE:
            finding = next(
                (f for f in obs.active_findings if f.finding_id == action.finding_id), None
            )
            if finding:
                citation = EvidenceCitation(
                    finding_id=action.finding_id,
                    passage_text=action.passage_text or "",
                    passage_location=action.passage_location or "",
                    score=0.0,
                )
                obs.evidence_citations.append(citation)
                if finding.status == FindingStatus.PENDING:
                    finding.status = FindingStatus.CITED

        elif atype == ActionType.SUBMIT_REMEDIATION:
            finding = next(
                (f for f in obs.active_findings if f.finding_id == action.finding_id), None
            )
            if finding:
                remediation = Remediation(
                    finding_id=action.finding_id,
                    text=action.remediation_text or "",
                    target_framework=action.target_framework,
                )
                obs.submitted_remediations.append(remediation)
                finding.status = FindingStatus.REMEDIATED

        elif atype == ActionType.FLAG_FALSE_POSITIVE:
            for i, f in enumerate(obs.active_findings):
                if f.finding_id == action.retract_finding_id:
                    f.status = FindingStatus.RETRACTED
                    obs.retracted_findings.append(f)
                    obs.active_findings.pop(i)
                    break

        elif atype == ActionType.ESCALATE_CONFLICT:
            if reward_obj.action_result == ActionResult.ACCEPTED:
                self._escalated_conflicts.append({
                    "framework_a": action.framework_a.value if action.framework_a else "",
                    "framework_b": action.framework_b.value if action.framework_b else "",
                    "conflict_desc": action.conflict_desc or "",
                })

        elif atype == ActionType.RESPOND_TO_INCIDENT:
            if (obs.active_incident and action.response_type
                    and reward_obj.action_result == ActionResult.ACCEPTED):
                obs.active_incident.completed_responses.append(action.response_type)
                obs.incident_timeline.append(IncidentEvent(
                    step=obs.steps_taken,
                    event_type=action.response_type.value,
                    description=action.response_detail or "",
                ))

    def _trigger_incident(self, obs: ARIAObservation, incident_cfg: dict) -> None:
        """Fire the live incident event (Expert tier)."""
        from aria.models import Incident, IncidentResponseType
        incident = Incident(
            incident_id=incident_cfg.get("incident_id", "INC-001"),
            incident_type=incident_cfg.get("incident_type", "unauthorized_access"),
            records_affected=incident_cfg.get("records_affected", 50000),
            discovered_at_step=obs.steps_taken,
            deadline_steps=incident_cfg.get("deadline_steps", 8),
            description=incident_cfg.get("description", "Data breach detected"),
            required_responses=[
                IncidentResponseType(r)
                for r in incident_cfg.get("required_responses", ["contain_breach"])
            ],
        )
        obs.active_incident = incident
        obs.incident_deadline_steps = incident.deadline_steps
        obs.incident_timeline.append(IncidentEvent(
            step=obs.steps_taken,
            event_type="incident_triggered",
            description=f"INCIDENT: {incident.description}",
        ))

    def _compute_phase(self, obs: ARIAObservation, max_steps: int) -> str:
        """Determine current audit phase based on agent behavior."""
        if obs.phase == "complete":
            return "complete"
        step_ratio = obs.steps_taken / max(1, max_steps)
        has_findings = len(obs.active_findings) > 0
        has_remediations = len(obs.submitted_remediations) > 0

        if has_remediations:
            return "remediating"
        elif has_findings:
            return "auditing"
        elif step_ratio > 0.35:
            return "auditing"
        return "reading"

    # ─── Task Loading ─────────────────────────────────────────────────────────

    def _load_task(self, task_name: str, seed: int = 42) -> dict:
        """Load a task JSON from disk."""
        # Try direct file path first
        candidates = [
            TASKS_DIR / task_name / "task.json",
            TASKS_DIR / f"{task_name}.json",
            TASKS_DIR / "easy" / "task.json",  # fallback
        ]
        # Handle difficulty-only names
        difficulty_map = {"easy": "easy", "medium": "medium", "hard": "hard", "expert": "expert"}
        if task_name in difficulty_map:
            candidates.insert(0, TASKS_DIR / difficulty_map[task_name] / "task.json")

        for path in candidates:
            if path.exists():
                with open(path) as f:
                    return json.load(f)

        raise FileNotFoundError(f"Task not found: {task_name}. Available: easy, medium, hard, expert")

    def _validate_action(self, action: ARIAAction, obs: ARIAObservation) -> str | None:
        """Return error string if action is invalid, None if OK."""
        atype = action.action_type
        if atype == ActionType.REQUEST_SECTION:
            if not action.document_id or not action.section_id:
                return "request_section requires document_id and section_id"
        elif atype == ActionType.IDENTIFY_GAP:
            if not action.clause_ref:
                return "identify_gap requires clause_ref"
            if not action.gap_type:
                return "identify_gap requires gap_type"
            if not action.severity:
                return "identify_gap requires severity"
        elif atype == ActionType.CITE_EVIDENCE:
            if not action.finding_id:
                return "cite_evidence requires finding_id"
            if not action.passage_text:
                return "cite_evidence requires passage_text"
            if not action.passage_location:
                return "cite_evidence requires passage_location"
        elif atype == ActionType.SUBMIT_REMEDIATION:
            if not action.finding_id:
                return "submit_remediation requires finding_id"
            if not action.remediation_text:
                return "submit_remediation requires remediation_text"
        elif atype == ActionType.FLAG_FALSE_POSITIVE:
            if not action.retract_finding_id:
                return "flag_false_positive requires retract_finding_id"
        elif atype == ActionType.ESCALATE_CONFLICT:
            if not action.framework_a or not action.framework_b:
                return "escalate_conflict requires framework_a and framework_b"
            if not action.conflict_desc:
                return "escalate_conflict requires conflict_desc"
        elif atype == ActionType.RESPOND_TO_INCIDENT:
            if not action.response_type:
                return "respond_to_incident requires response_type"
        return None