import { useEffect, useRef } from 'react';
import { Bot, AlertTriangle } from 'lucide-react';
import type { ARIAEvent } from '../types/aria.types';

interface AgentChatProps {
  events: ARIAEvent[];
}

function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    request_section: '↗ READ',
    identify_gap: '⚠ GAP',
    cite_evidence: '✦ CITE',
    submit_remediation: '⟳ FIX',
    flag_false_positive: '✕ RETRACT',
    escalate_conflict: '⇅ CONFLICT',
    respond_to_incident: '🔴 INCIDENT',
    request_clarification: '? CLARIFY',
    submit_final_report: '✓ SUBMIT',
  };
  return labels[type] ?? type.toUpperCase();
}

function actionColor(type: string): string {
  const colors: Record<string, string> = {
    request_section: 'rgba(148,163,184,0.9)',
    identify_gap: '#fbbf24',
    cite_evidence: 'var(--color-lavender)',
    submit_remediation: '#6ee7b7',
    flag_false_positive: '#f87171',
    escalate_conflict: '#c084fc',
    respond_to_incident: '#f87171',
    request_clarification: 'rgba(148,163,184,0.7)',
    submit_final_report: '#6ee7b7',
  };
  return colors[type] ?? 'var(--color-lilac)';
}

export function AgentChat({ events }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const stepEvents = events.filter((e) => e.type === 'step');

  if (stepEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-20">
        <div className="flex items-center gap-2 opacity-30">
          <Bot size={14} />
          <span className="section-label text-[10px]">Agent inactive</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {stepEvents.slice(-30).map((event, i) => {
        if (event.type !== 'step') return null;
        const isLast = i === stepEvents.slice(-30).length - 1;

        return (
          <div
            key={i}
            className={`flex gap-2.5 text-xs items-start transition-opacity duration-300 ${
              isLast ? 'opacity-100' : 'opacity-50'
            }`}
          >
            {/* Step number */}
            <span
              className="shrink-0 font-mono text-[10px] pt-0.5 w-6 text-right"
              style={{ color: 'rgba(167,136,220,0.4)' }}
            >
              {event.step_number}
            </span>

            {/* Action tag */}
            <span
              className="shrink-0 font-mono text-[10px] font-medium pt-0.5"
              style={{ color: actionColor(event.action.action_type), minWidth: '64px' }}
            >
              {actionLabel(event.action.action_type)}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {event.agent_thinking && (
                <p
                  className="text-[11px] leading-relaxed mb-0.5 italic"
                  style={{ color: 'rgba(204,170,230,0.55)' }}
                >
                  "{event.agent_thinking.slice(0, 120)}{event.agent_thinking.length > 120 ? '…' : ''}"
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: 'rgba(204,170,230,0.5)' }}>{event.reward_reason}</span>
                <span
                  className="font-mono font-medium"
                  style={{ color: event.reward >= 0 ? '#86efac' : '#f87171' }}
                >
                  {event.reward >= 0 ? '+' : ''}{event.reward.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Incident alert */}
      {events.some((e) => e.type === 'incident_alert') && (
        <div className="mt-2 p-2 rounded-lg border border-red-500/20 bg-red-500/5 flex items-start gap-2">
          <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-medium text-red-400 tracking-wide uppercase">Live Incident</p>
            {events
              .filter((e) => e.type === 'incident_alert')
              .slice(-1)
              .map((e, i) => {
                if (e.type !== 'incident_alert') return null;
                return (
                  <p key={i} className="text-[11px] text-red-300/70 mt-0.5">
                    {e.message}
                  </p>
                );
              })}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}