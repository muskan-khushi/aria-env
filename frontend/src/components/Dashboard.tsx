import { useState, useEffect } from 'react';
import { Play, Square, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react';
import { useARIAWebSocket } from '../hooks/useWebSocket';
import { useARIAReset } from '../hooks/useARIAEnv';
import { RewardChart } from './RewardChart';
import { FindingsPanel } from './FindingsPanel';
import { AgentChat } from './AgentChat';
import type { ARIAObservation, Document as ARIADocument, Phase } from '../types/aria.types';

function PhaseIndicator({ phase }: { phase: Phase }) {
  const colors: Record<Phase, string> = {
    reading: '#94a3b8',
    auditing: '#fbbf24',
    remediating: 'var(--color-lavender)',
    complete: '#6ee7b7',
  };
  return (
    <span className="phase-pill" style={{ color: colors[phase], borderColor: `${colors[phase]}33` }}>
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: colors[phase] }}
      />
      {phase}
    </span>
  );
}

function DocumentViewer({
  documents,
  visibleSections,
}: {
  documents: ARIADocument[];
  visibleSections: string[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (docId: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(docId) ? n.delete(docId) : n.add(docId);
      return n;
    });
  };

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const isOpen = expanded.has(doc.doc_id);
        const viewedCount = doc.sections.filter((s) =>
          visibleSections.includes(`${doc.doc_id}.${s.section_id}`)
        ).length;

        return (
          <div key={doc.doc_id} className="card overflow-hidden">
            <button
              onClick={() => toggle(doc.doc_id)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-lilac)' }}>
                  {doc.title}
                </p>
                <p className="section-label text-[10px] mt-0.5">
                  {viewedCount}/{doc.sections.length} sections read
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ width: '48px', background: 'rgba(204,170,230,0.1)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(viewedCount / doc.sections.length) * 100}%`,
                      background: 'linear-gradient(90deg, var(--color-thistle), var(--color-lavender))',
                    }}
                  />
                </div>
                <span
                  className="text-xs transition-transform duration-200"
                  style={{
                    color: 'rgba(204,170,230,0.4)',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  ›
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 space-y-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                {doc.sections.map((section) => {
                  const loc = `${doc.doc_id}.${section.section_id}`;
                  const isViewed = visibleSections.includes(loc);
                  return (
                    <div key={section.section_id} className={`doc-section ${isViewed ? 'viewed' : ''}`}>
                      <div className="flex items-center gap-1.5">
                        {isViewed && <span className="text-green-400 text-[10px]">✓</span>}
                        <span>{section.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatsBar({ obs }: { obs: ARIAObservation }) {
  const progress = obs.steps_taken / (obs.steps_taken + obs.steps_remaining);

  return (
    <div className="card px-4 py-3">
      <div className="grid grid-cols-5 gap-4 text-center">
        <div>
          <p className="text-lg font-display font-light" style={{ color: 'var(--color-lavender)' }}>
            {obs.cumulative_reward >= 0 ? '+' : ''}{obs.cumulative_reward.toFixed(2)}
          </p>
          <p className="section-label text-[9px]">Reward</p>
        </div>
        <div>
          <p className="text-lg font-display font-light" style={{ color: 'var(--color-lilac)' }}>
            {obs.active_findings.length}
          </p>
          <p className="section-label text-[9px]">Findings</p>
        </div>
        <div>
          <p className="text-lg font-display font-light" style={{ color: '#fbbf24' }}>
            {obs.steps_remaining}
          </p>
          <p className="section-label text-[9px]">Steps Left</p>
        </div>
        <div>
          <p className="text-lg font-display font-light" style={{ color: 'var(--color-wisteria)' }}>
            {obs.visible_sections.length}
          </p>
          <p className="section-label text-[9px]">Sections Read</p>
        </div>
        <div>
          <p className="text-lg font-display font-light" style={{ color: '#6ee7b7' }}>
            {obs.submitted_remediations.length}
          </p>
          <p className="section-label text-[9px]">Remediations</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(204,170,230,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, var(--color-thistle), var(--color-lavender))',
          }}
        />
      </div>
    </div>
  );
}

// Difficulty options for the selector
const TASK_OPTIONS = [
  { value: 'easy', label: 'Easy — Basic GDPR' },
  { value: 'medium', label: 'Medium — Cross-Document' },
  { value: 'hard', label: 'Hard — Multi-Framework' },
  { value: 'expert', label: 'Expert — Incident Suite' },
];

export function Dashboard() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('easy');
  const [obs, setObs] = useState<ARIAObservation | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { events, connected, clearEvents } = useARIAWebSocket(sessionId);
  const { reset, loading: resetting } = useARIAReset();

  // Sync obs from WS events
  useEffect(() => {
    const last = [...events].reverse().find((e) => e.type === 'step');
    if (last && last.type === 'step') setObs(last.observation);
  }, [events]);

  const handleStart = async () => {
    clearEvents();
    setObs(null);
    const result = await reset({ task_name: taskName });
    if (result) {
      setSessionId(result.session_id);
      setObs(result.observation);
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    setSessionId(null);
  };

  const isComplete = obs?.done || events.some((e) => e.type === 'episode_complete');

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-light" style={{ color: 'var(--color-lilac)' }}>
            Live Monitor
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(204,170,230,0.4)' }}>
            Real-time agent episode visualization
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            {connected ? (
              <>
                <span className="live-dot" />
                <Wifi size={12} style={{ color: '#6ee7b7' }} />
                <span className="text-xs" style={{ color: '#6ee7b7' }}>Live</span>
              </>
            ) : (
              <>
                <WifiOff size={12} style={{ color: 'rgba(148,163,184,0.5)' }} />
                <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Disconnected</span>
              </>
            )}
          </div>

          {/* Task selector */}
          <select
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="select-field text-xs py-1.5 pr-7 pl-3"
            disabled={isRunning}
            style={{ width: '200px' }}
          >
            {TASK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Action button */}
          {!isRunning || isComplete ? (
            <button
              onClick={handleStart}
              disabled={resetting}
              className="btn-primary flex items-center gap-2"
            >
              {resetting ? (
                <RefreshCw size={11} className="animate-spin" />
              ) : (
                <Play size={11} />
              )}
              {resetting ? 'Starting…' : 'Run Episode'}
            </button>
          ) : (
            <button onClick={handleStop} className="btn-ghost flex items-center gap-2">
              <Square size={11} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {obs && <StatsBar obs={obs} />}

      {/* Phase + task info */}
      {obs && (
        <div className="flex items-center gap-3 flex-wrap">
          <PhaseIndicator phase={obs.phase} />
          <span className="mono-text text-[11px] opacity-60">{obs.task_id}</span>
          <div className="flex gap-1">
            {obs.regulatory_context.frameworks_in_scope.map((f) => (
              <span
                key={f}
                className={`badge badge-${f.toLowerCase()}`}
              >
                {f}
              </span>
            ))}
          </div>
          {obs.active_incident && (
            <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              🔴 Live Incident
            </span>
          )}
          {isComplete && (
            <span className="badge badge-remediated">✓ Episode Complete</span>
          )}
        </div>
      )}

      {/* Main content: 3-column layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Document viewer */}
        <div className="col-span-3 space-y-2">
          <p className="section-label">Documents</p>
          <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
            {obs?.documents ? (
              <DocumentViewer
                documents={obs.documents}
                visibleSections={obs.visible_sections}
              />
            ) : (
              <div className="card p-4 text-center">
                <Activity size={20} className="mx-auto mb-2 opacity-20" />
                <p className="section-label text-[10px]">Start an episode to view documents</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Reward chart + action log */}
        <div className="col-span-5 space-y-3">
          <div>
            <p className="section-label mb-2">Reward Curve</p>
            <div className="card-glow p-3" style={{ height: '220px' }}>
              <RewardChart events={events} />
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Agent Action Log</p>
            <div className="card p-3">
              <AgentChat events={events} />
            </div>
          </div>

          {/* Last reward callout */}
          {obs && obs.last_reward !== 0 && (
            <div
              className="card px-4 py-3 flex items-center justify-between"
              style={{
                borderColor:
                  obs.last_reward > 0
                    ? 'rgba(134,239,172,0.2)'
                    : 'rgba(248,113,113,0.2)',
              }}
            >
              <div>
                <p className="section-label text-[9px]">Last Action</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(204,170,230,0.7)' }}>
                  {obs.last_reward_reason}
                </p>
              </div>
              <p
                className="font-display text-xl font-light"
                style={{ color: obs.last_reward > 0 ? '#86efac' : '#f87171' }}
              >
                {obs.last_reward >= 0 ? '+' : ''}{obs.last_reward.toFixed(3)}
              </p>
            </div>
          )}
        </div>

        {/* Right: Findings panel */}
        <div className="col-span-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="section-label">Active Findings</p>
            {obs && (
              <span className="mono-text text-[10px] opacity-60">
                {obs.active_findings.length} total
              </span>
            )}
          </div>
          <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
            <FindingsPanel
              findings={obs?.active_findings ?? []}
              retracted={obs?.retracted_findings ?? []}
              citations={obs?.evidence_citations ?? []}
            />
          </div>
        </div>
      </div>

      {/* Episode complete summary */}
      {isComplete && obs && (
        <div className="card-glow p-6 animate-fade-up">
          <h3 className="font-display text-xl font-light mb-4" style={{ color: 'var(--color-lilac)' }}>
            Episode Complete
          </h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="stat-number">{obs.cumulative_reward.toFixed(2)}</p>
              <p className="section-label text-[10px] mt-1">Cumulative Reward</p>
            </div>
            <div>
              <p className="stat-number">{obs.active_findings.length}</p>
              <p className="section-label text-[10px] mt-1">Findings Identified</p>
            </div>
            <div>
              <p className="stat-number">{obs.submitted_remediations.length}</p>
              <p className="section-label text-[10px] mt-1">Remediations</p>
            </div>
            <div>
              <p className="stat-number">{obs.evidence_citations.length}</p>
              <p className="section-label text-[10px] mt-1">Evidence Citations</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button onClick={handleStart} className="btn-primary flex items-center gap-2">
              <RefreshCw size={11} />
              Run Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}