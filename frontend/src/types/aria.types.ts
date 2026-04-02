// src/types/aria.types.ts

export interface ARIAObservation {
  cumulative_reward: number;
  steps_taken: number;
  phase: string;
}

export interface ARIAAction {
  action_type: string;
  clause_ref?: string;
  gap_type?: string;
  severity?: string;
}

export interface ARIAEvent {
  type: "step" | "episode_complete" | "incident_alert";
  step_number?: number;
  action?: ARIAAction;
  reward?: number;
  reward_reason?: string;
  observation?: ARIAObservation;
  agent_thinking?: string;
}