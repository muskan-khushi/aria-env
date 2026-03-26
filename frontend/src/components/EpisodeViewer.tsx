import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';
import { useARIAReplay } from '../hooks/useARIAEnv';
import type { ReplayStep } from '../types/aria.types';

function ActionBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    request_section: 'rgba(148,163,184,0.15)',
    identify_gap: 'rgba(251,191,36,0.15)',
    cite_evidence: 'rgba(167,136,220,0.15)',
    submit_remediation: 'rgba(110,231,183,0.12)',
    flag_false_positive: 'rgba(248,113,113,0.12)',
    escalate_conflict: 'rgba(192,132,252,0.15)',
    respond_to_incident: 'rgba(248,113,113,0.15)',
    submit_final_report: 'rgba(110,231,183,0.15)',
  };
  const textColors: Record<string, string> = {
    request_section: '#94a3b8',
    identify_gap: '#fbbf24',
    cite_evidence: 'var(--color-lavender)',
    submit_remediation: '#6ee7b7',
    flag_false_positive: '#f87171',
    escalate_conflict: '#c084fc',
    respond_to_incident: '#f87171',
    submit_final_report: '#6ee7b7',
  };

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{
        background: colors[type] ?? 'rgba(167,136,220,0.1)',
        color: textColors[type] ?? 'var(--color-lavender)',
      }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function StepCard({ step, isActive }: { step: ReplayStep; isActive: boolean }) {
  return (
    <div
      className={`card px-3 py-2.5 cursor-pointer transition-all duration-200 ${
        isActive ? 'card-glow' : ''
      }`}
      style={isActive ? { borderColor: 'var(--color-thistle)' } : {}}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="mono-text text-[10px] w-6 opacity-50">{step.step_number}</span>
          <ActionBadge type={step.action.action_type} />
        </div>
        <span
          className="font-mono text-xs font-medium"
          style={{ color: step.reward >= 0 ? '#86efac' : '#f87171' }}
        >
          {step.reward >= 0 ? '+' : ''}{step.reward.toFixed(3)}
        </span>
      </div>
      {step.reward_reason && (
        <p className="text-[11px] mt-1.5 ml-8" style={{ color: 'rgba(204,170,230,0.5)' }}>
          {step.reward_reason}
        </p>
      )}
      {step.agent_thinking && (
        <p className="text-[11px] mt-1 ml-8 italic" style={{ color: 'rgba(204,170,230,0.4)' }}>
          "{step.agent_thinking.slice(0, 80)}…"
        </p>
      )}
    </div>
  );
}

function ObservationPanel({ step }: { step: ReplayStep | null }) {
  if (!step) {
    return (
      <div className="card p-6 text-center">
        <p className="section-label">Select a step to inspect</p>
      </div>
    );
  }

  const obs = step.observation;

  return (
    <div className="space-y-3">
      {/* Action detail */}
      <div className="card p-4 space-y-2">
        <p className="section-label text-[10px]">Action</p>
        <ActionBadge type={step.action.action_type} />
        {step.action.clause_ref && (
          <p className="mono-text text-[11px]">{step.action.clause_ref}</p>
        )}
        {step.action.gap_type && (
          <p className="text-xs" style={{ color: 'var(--color-lavender)' }}>
            {step.action.gap_type.replace(/_/g, ' ')}
          </p>
        )}
        {step.action.description && (
          <p className="text-xs" style={{ color: 'rgba(204,170,230,0.6)' }}>
            {step.action.description}
          </p>
        )}
        {step.action.passage_text && (
          <blockquote
            className="text-xs border-l-2 pl-3 italic"
            style={{ borderColor: 'var(--color-thistle)', color: 'rgba(204,170,230,0.6)' }}
          >
            "{step.action.passage_text.slice(0, 200)}"
          </blockquote>
        )}
      </div>

      {/* State snapshot */}
      <div className="card p-4 space-y-2">
        <p className="section-label text-[10px]">State at Step {step.step_number}</p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span style={{ color: 'rgba(204,170,230,0.5)' }}>Phase: </span>
            <span className="phase-pill text-[10px] py-0">{obs.phase}</span>
          </div>
          <div>
            <span style={{ color: 'rgba(204,170,230,0.5)' }}>Cumulative: </span>
            <span className="font-mono" style={{ color: obs.cumulative_reward >= 0 ? '#86efac' : '#f87171' }}>
              {obs.cumulative_reward >= 0 ? '+' : ''}{obs.cumulative_reward.toFixed(3)}
            </span>
          </div>
          <div>
            <span style={{ color: 'rgba(204,170,230,0.5)' }}>Findings: </span>
            <span style={{ color: 'var(--color-lavender)' }}>{obs.active_findings.length}</span>
          </div>
          <div>
            <span style={{ color: 'rgba(204,170,230,0.5)' }}>Steps left: </span>
            <span style={{ color: '#fbbf24' }}>{obs.steps_remaining}</span>
          </div>
        </div>
      </div>

      {/* Active findings at this step */}
      {obs.active_findings.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="section-label text-[10px]">Findings at this step</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {obs.active_findings.map((f) => (
              <div key={f.finding_id} className="flex items-start gap-2 text-xs">
                <span className={`badge badge-${f.severity} shrink-0`}>{f.severity}</span>
                <span className="mono-text text-[10px]">{f.clause_ref}</span>
                <span style={{ color: 'rgba(204,170,230,0.6)' }}>
                  {f.gap_type.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EpisodeViewer() {
  const { replay, loading, error, fetchReplay } = useARIAReplay();
  const [replayId, setReplayId] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const handleFetch = () => {
    if (replayId.trim()) fetchReplay(replayId.trim());
  };

  const steps = replay?.steps ?? [];
  const activeStep = steps[currentStep] ?? null;

  const goTo = (i: number) => setCurrentStep(Math.max(0, Math.min(steps.length - 1, i)));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-light" style={{ color: 'var(--color-lilac)' }}>
            Episode Replay
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(204,170,230,0.4)' }}>
            Step-by-step inspection of completed episodes
          </p>
        </div>
      </div>

      {/* Replay ID input */}
      <div className="flex gap-2 max-w-sm">
        <input
          value={replayId}
          onChange={(e) => setReplayId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder="Enter episode replay ID…"
          className="input-field text-xs flex-1"
        />
        <button onClick={handleFetch} disabled={loading} className="btn-primary flex items-center gap-1.5">
          <Search size={11} />
          Load
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && (
        <div className="card p-6 text-center">
          <p className="section-label">Loading replay…</p>
        </div>
      )}

      {replay && (
        <>
          {/* Episode summary */}
          <div className="card p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="font-display text-2xl font-light" style={{ color: 'var(--color-lavender)' }}>
                  {replay.final_score.toFixed(2)}
                </p>
                <p className="section-label text-[9px]">Final Score</p>
              </div>
              <div>
                <p className="font-display text-2xl font-light" style={{ color: 'var(--color-lilac)' }}>
                  {replay.total_steps}
                </p>
                <p className="section-label text-[9px]">Total Steps</p>
              </div>
              <div>
                <p className="font-display text-2xl font-light" style={{ color: '#6ee7b7' }}>
                  {(replay.grade_result.precision * 100).toFixed(0)}%
                </p>
                <p className="section-label text-[9px]">Precision</p>
              </div>
              <div>
                <p className="font-display text-2xl font-light" style={{ color: '#fbbf24' }}>
                  {(replay.grade_result.recall * 100).toFixed(0)}%
                </p>
                <p className="section-label text-[9px]">Recall</p>
              </div>
            </div>
          </div>

          {/* Scrubber controls */}
          <div className="flex items-center gap-3">
            <button onClick={() => goTo(0)} className="btn-ghost p-1.5">
              <SkipBack size={12} />
            </button>
            <button onClick={() => goTo(currentStep - 1)} className="btn-ghost p-1.5">
              <ChevronLeft size={12} />
            </button>

            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={Math.max(steps.length - 1, 0)}
                value={currentStep}
                onChange={(e) => goTo(parseInt(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(90deg, var(--color-thistle) ${
                    (currentStep / Math.max(steps.length - 1, 1)) * 100
                  }%, rgba(204,170,230,0.1) 0%)`,
                  outline: 'none',
                }}
              />
            </div>

            <button onClick={() => goTo(currentStep + 1)} className="btn-ghost p-1.5">
              <ChevronRight size={12} />
            </button>
            <button onClick={() => goTo(steps.length - 1)} className="btn-ghost p-1.5">
              <SkipForward size={12} />
            </button>

            <span className="mono-text opacity-60 text-[11px]">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Step list + observation */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2 max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
              {steps.map((s, i) => (
                <div key={i} onClick={() => setCurrentStep(i)}>
                  <StepCard step={s} isActive={i === currentStep} />
                </div>
              ))}
            </div>
            <div className="col-span-3">
              <ObservationPanel step={activeStep} />
            </div>
          </div>
        </>
      )}

      {!replay && !loading && !error && (
        <div className="card p-10 text-center space-y-3">
          <div
            className="text-4xl font-display font-light opacity-20"
            style={{ color: 'var(--color-lavender)' }}
          >
            ⟳
          </div>
          <p className="section-label">No episode loaded</p>
          <p className="text-xs" style={{ color: 'rgba(204,170,230,0.35)' }}>
            Enter a replay ID from a completed episode to inspect it step by step
          </p>
        </div>
      )}
    </div>
  );
}