import { useState } from 'react';
import { Code2, Copy, CheckCircle2, ExternalLink, ChevronDown, ChevronRight, Terminal, Zap } from 'lucide-react';

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  description: string;
  headers?: { name: string; type: string; required: boolean; desc: string }[];
  body?: { name: string; type: string; required: boolean; default?: string; desc: string }[];
  response?: string;
  example?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/reset',
    summary: 'Initialize a new audit episode',
    description: 'Creates a new environment session, loads the specified task, and returns the initial ARIAObservation. Call this before any step() calls.',
    headers: [
      { name: 'X-Session-ID', type: 'string', required: false, desc: 'Optional session identifier. If provided, the session will be registered under this ID.' },
    ],
    body: [
      { name: 'task_name', type: 'string', required: false, default: '"easy"', desc: 'Task difficulty: easy | medium | hard | expert | blind | custom' },
      { name: 'seed', type: 'integer', required: false, default: '42', desc: 'Random seed for reproducibility.' },
      { name: 'session_id', type: 'string', required: false, desc: 'Session ID override (can also be set via header).' },
    ],
    response: `{
  "session_id": "abc123def456",
  "task_id": "easy_1",
  "task_description": "Global SaaS Provider Basic Audit",
  "regulatory_context": {
    "frameworks_in_scope": ["GDPR"],
    "applicable_articles": { "GDPR": ["Article 5", ...] }
  },
  "documents": [{ "doc_id": "privacy_policy", "title": "...", "sections": [...] }],
  "visible_sections": [],
  "active_findings": [],
  "phase": "reading",
  "steps_taken": 0,
  "steps_remaining": 15,
  "cumulative_reward": 0.0,
  "done": false
}`,
    example: `curl -X POST /reset \\
  -H "Content-Type: application/json" \\
  -H "X-Session-ID: my-session-001" \\
  -d '{"task_name": "medium", "seed": 42}'`,
  },
  {
    method: 'POST',
    path: '/step',
    summary: 'Submit an agent action',
    description: 'Advances the episode by one step. The server validates the action, computes the reward, updates state, and broadcasts to WebSocket subscribers.',
    headers: [
      { name: 'X-Session-ID', type: 'string', required: true, desc: 'Session ID from a prior /reset call.' },
    ],
    body: [
      { name: 'action', type: 'ARIAAction', required: true, desc: 'Action object with action_type and relevant fields. See Action Space below.' },
    ],
    response: `{
  "observation": { /* Full ARIAObservation */ },
  "reward": 0.20,
  "done": false,
  "info": {}
}`,
    example: `curl -X POST /step \\
  -H "Content-Type: application/json" \\
  -H "X-Session-ID: my-session-001" \\
  -d '{
    "action": {
      "action_type": "identify_gap",
      "clause_ref": "privacy_policy.s2",
      "gap_type": "data_retention",
      "severity": "high",
      "description": "No maximum retention period specified."
    }
  }'`,
  },
  {
    method: 'GET',
    path: '/state',
    summary: 'Get current observation',
    description: 'Returns the current ARIAObservation without advancing the episode. Useful for inspecting state between agent calls.',
    headers: [
      { name: 'X-Session-ID', type: 'string', required: true, desc: 'Session ID from a prior /reset call.' },
    ],
    response: `{ /* Full ARIAObservation at current step */ }`,
    example: `curl -H "X-Session-ID: my-session-001" /state`,
  },
  {
    method: 'GET',
    path: '/tasks',
    summary: 'List all available tasks',
    description: 'Returns metadata for all registered tasks including difficulty, frameworks in scope, gap count, and the full ARIAAction JSON schema.',
    response: `{
  "tasks": [
    {
      "id": "easy_1",
      "name": "Global SaaS Provider Basic Audit",
      "difficulty": "easy",
      "max_steps": 15,
      "frameworks": ["GDPR"],
      "num_gaps": 3,
      "has_incident": false
    },
    ...
  ],
  "total": 5,
  "action_schema": { /* JSON Schema for ARIAAction */ }
}`,
    example: `curl /tasks`,
  },
  {
    method: 'POST',
    path: '/grader',
    summary: 'Grade a completed episode',
    description: 'Deterministic final scoring across 5 components: Gap F1 (40%), Evidence Quality (25%), Remediation Quality (20%), Severity Accuracy (10%), Conflict Detection (5%).',
    headers: [
      { name: 'X-Session-ID', type: 'string', required: false, desc: 'Session ID (also accepted in body).' },
    ],
    body: [
      { name: 'session_id', type: 'string', required: false, desc: 'Session ID override.' },
    ],
    response: `{
  "score": 0.7336,
  "f1_score": { "precision": 1.0, "recall": 1.0, "f1": 1.0, "tp": 3, "fp": 0, "fn": 0 },
  "evidence_score": 0.4767,
  "severity_accuracy": 1.0,
  "remediation_score": 0.2222,
  "conflict_score": 1.0,
  "efficiency_bonus": 0.02,
  "breakdown": {
    "gap_f1": 0.4,
    "evidence": 0.1192,
    "remediation": 0.0444,
    "severity": 0.1,
    "conflict": 0.05,
    "efficiency": 0.02
  }
}`,
    example: `curl -X POST /grader \\
  -H "X-Session-ID: my-session-001"`,
  },
  {
    method: 'POST',
    path: '/aria/upload/custom',
    summary: 'Upload a custom document for auditing',
    description: 'Converts raw text into an ARIA task.json and saves it as the "custom" task. Launch with task_name="custom".',
    body: [
      { name: 'filename', type: 'string', required: true, desc: 'Display name for the document (e.g., "Company_Policy.txt").' },
      { name: 'content', type: 'string', required: true, desc: 'Raw text content of the document to audit.' },
    ],
    response: `{ "message": "Custom task created", "task_id": "custom_abc12345" }`,
    example: `curl -X POST /aria/upload/custom \\
  -H "Content-Type: application/json" \\
  -d '{"filename": "Privacy_Policy.txt", "content": "..."}'`,
  },
  {
    method: 'GET',
    path: '/aria/leaderboard',
    summary: 'Get leaderboard results',
    description: 'Returns all baseline results from cached runs. Supports multi-agent comparison.',
    response: `{ "results": [{ "task": "easy", "agent": "MultiPass", "score": 0.734, ... }] }`,
    example: `curl /aria/leaderboard`,
  },
];

const ACTION_TYPES = [
  { type: 'request_section', reward: '+0.01 / −0.02', fields: 'document_id, section_id', desc: 'Read a document section. First read earns +0.01, redundant reads penalized.' },
  { type: 'identify_gap', reward: '+0.20 / +0.12 / −0.10', fields: 'clause_ref, gap_type, severity, description', desc: 'Flag a compliance violation. Exact match +0.20, partial +0.12, false positive −0.10. +0.05 severity bonus.' },
  { type: 'cite_evidence', reward: '+0.12 scaled', fields: 'finding_id, passage_text, passage_location', desc: 'Link finding to source text. Scored by windowed fuzzy match (anti-gaming v2). Max +0.12 at score ≥ 0.80.' },
  { type: 'submit_remediation', reward: '+0.15', fields: 'finding_id, remediation_text', desc: 'Propose fix for a finding. Scored by canonical keyword coverage. +0.15 at ≥70% coverage.' },
  { type: 'escalate_conflict', reward: '+0.18 max', fields: 'framework_a, framework_b, conflict_desc', desc: 'Report cross-framework contradiction. Scored: 60% pair match + 40% description quality.' },
  { type: 'respond_to_incident', reward: '+0.20', fields: 'incident_id, response_type, response_detail', desc: 'Expert tier only. Execute containment/notification within deadline. −0.25/step if deadline missed.' },
  { type: 'flag_false_positive', reward: '+0.05 / −0.08', fields: 'retract_finding_id', desc: 'Retract a previous finding. +0.05 for correct retraction (FP), −0.08 for retracting a real finding.' },
  { type: 'submit_final_report', reward: '0.0 (triggers grader)', fields: '(none)', desc: 'Ends the episode and triggers the deterministic terminal grader.' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-gray-700 transition text-gray-400 hover:text-white">
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-aria-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition text-left"
      >
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md min-w-[42px] text-center ${
          endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono font-bold text-aria-textMain">{endpoint.path}</code>
        <span className="text-sm text-aria-textMuted">{endpoint.summary}</span>
        <span className="ml-auto">
          {expanded ? <ChevronDown className="w-4 h-4 text-aria-textMuted" /> : <ChevronRight className="w-4 h-4 text-aria-textMuted" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-aria-border">
          <div className="p-5 flex flex-col gap-4">
            <p className="text-sm text-gray-600">{endpoint.description}</p>

            {endpoint.headers && (
              <div>
                <h4 className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest mb-2">Headers</h4>
                <table className="w-full text-xs">
                  <tbody>
                    {endpoint.headers.map(h => (
                      <tr key={h.name} className="border-b border-aria-border">
                        <td className="py-2 pr-4 font-mono font-bold text-aria-textMain">{h.name}</td>
                        <td className="py-2 pr-4 font-mono text-blue-600">{h.type}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${h.required ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
                            {h.required ? 'required' : 'optional'}
                          </span>
                        </td>
                        <td className="py-2 text-gray-600">{h.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {endpoint.body && (
              <div>
                <h4 className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest mb-2">Request Body</h4>
                <table className="w-full text-xs">
                  <tbody>
                    {endpoint.body.map(b => (
                      <tr key={b.name} className="border-b border-aria-border">
                        <td className="py-2 pr-4 font-mono font-bold text-aria-textMain">{b.name}</td>
                        <td className="py-2 pr-4 font-mono text-blue-600">{b.type}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${b.required ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
                            {b.required ? 'required' : 'optional'}
                          </span>
                        </td>
                        {b.default && <td className="py-2 pr-4 font-mono text-amber-600">{b.default}</td>}
                        <td className="py-2 text-gray-600">{b.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {endpoint.response && (
                <div>
                  <h4 className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest mb-2">Response</h4>
                  <div className="bg-gray-900 rounded-xl p-4 relative">
                    <div className="absolute top-2 right-2">
                      <CopyButton text={endpoint.response} />
                    </div>
                    <pre className="text-[11px] text-gray-300 font-mono overflow-x-auto">{endpoint.response}</pre>
                  </div>
                </div>
              )}

              {endpoint.example && (
                <div>
                  <h4 className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest mb-2">Example</h4>
                  <div className="bg-gray-900 rounded-xl p-4 relative">
                    <div className="absolute top-2 right-2">
                      <CopyButton text={endpoint.example} />
                    </div>
                    <pre className="text-[11px] text-emerald-300 font-mono overflow-x-auto">{endpoint.example}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function APIReference() {
  const [activeSection, setActiveSection] = useState<'endpoints' | 'actions' | 'websocket'>('endpoints');

  return (
    <div className="h-full flex gap-4 animate-in fade-in duration-500" style={{ minHeight: '680px' }}>
      {/* Sidebar */}
      <div className="w-48 flex flex-col gap-1 flex-shrink-0">
        <div className="matte-panel p-3 bg-white flex flex-col gap-1">
          <p className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest px-2 mb-1">Sections</p>
          {[
            { id: 'endpoints', label: 'REST Endpoints', icon: Code2 },
            { id: 'actions', label: 'Action Space', icon: Zap },
            { id: 'websocket', label: 'WebSocket', icon: Terminal },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition ${
                activeSection === id ? 'bg-aria-accentLight text-aria-accent' : 'text-aria-textMuted hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="matte-panel p-3 bg-white">
          <p className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest mb-2">Quick Links</p>
          <a href="/docs" target="_blank" className="flex items-center gap-1.5 text-xs text-aria-accent hover:underline mb-1">
            <ExternalLink className="w-3 h-3" /> Swagger UI
          </a>
          <a href="/redoc" target="_blank" className="flex items-center gap-1.5 text-xs text-aria-accent hover:underline mb-1">
            <ExternalLink className="w-3 h-3" /> ReDoc
          </a>
          <a href="/openenv.yaml" target="_blank" className="flex items-center gap-1.5 text-xs text-aria-accent hover:underline">
            <ExternalLink className="w-3 h-3" /> openenv.yaml
          </a>
        </div>

        <div className="matte-panel p-3 bg-white">
          <p className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest mb-2">Base URL</p>
          <code className="text-[10px] font-mono text-aria-textMain bg-gray-100 px-1.5 py-0.5 rounded">
            {window.location.origin}
          </code>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 matte-panel p-5 bg-white overflow-y-auto" style={{ maxHeight: '680px' }}>
        {activeSection === 'endpoints' && (
          <div className="flex flex-col gap-3">
            <div className="pb-4 border-b border-aria-border">
              <h2 className="text-base font-bold text-aria-textMain">REST API Reference</h2>
              <p className="text-xs text-aria-textMuted mt-1">Full OpenEnv specification + ARIA extended endpoints. All endpoints return JSON.</p>
            </div>
            {ENDPOINTS.map(ep => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        )}

        {activeSection === 'actions' && (
          <div className="flex flex-col gap-4">
            <div className="pb-4 border-b border-aria-border">
              <h2 className="text-base font-bold text-aria-textMain">Action Space</h2>
              <p className="text-xs text-aria-textMuted mt-1">All actions are typed JSON objects conforming to the ARIAAction Pydantic model.</p>
            </div>

            {/* Gap types list */}
            <div className="p-4 bg-aria-accentLight border border-aria-accent/20 rounded-xl">
              <p className="text-[10px] font-bold text-aria-accent uppercase tracking-widest mb-2">Valid gap_type Values</p>
              <div className="flex flex-wrap gap-1.5">
                {['data_retention', 'consent_mechanism', 'breach_notification', 'data_subject_rights', 'cross_border_transfer', 'data_minimization', 'purpose_limitation', 'dpo_requirement', 'phi_safeguard', 'baa_requirement', 'opt_out_mechanism', 'audit_log_requirement', 'availability_control'].map(gt => (
                  <code key={gt} className="text-[10px] font-mono bg-white border border-aria-accent/30 text-aria-accent px-1.5 py-0.5 rounded">{gt}</code>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {ACTION_TYPES.map(action => (
                <div key={action.type} className="border border-aria-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <code className="text-sm font-mono font-bold text-aria-textMain">{action.type}</code>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                      action.reward.startsWith('+') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      action.reward.includes('−') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {action.reward}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 mb-2">{action.desc}</p>
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p className="text-[9px] font-bold text-aria-textMuted uppercase tracking-widest mb-1">Required Fields</p>
                    <code className="text-[10px] font-mono text-aria-textMain">{action.fields}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'websocket' && (
          <div className="flex flex-col gap-4">
            <div className="pb-4 border-b border-aria-border">
              <h2 className="text-base font-bold text-aria-textMain">WebSocket API</h2>
              <p className="text-xs text-aria-textMuted mt-1">Real-time episode event streaming for live dashboard visualization.</p>
            </div>

            <div className="p-4 bg-gray-100 rounded-xl">
              <p className="text-[10px] font-bold text-aria-textMuted uppercase tracking-widest mb-1">Connection URL</p>
              <code className="text-sm font-mono text-aria-textMain">wss://your-space.hf.space/aria/ws/{'{session_id}'}</code>
            </div>

            {[
              {
                type: 'step',
                direction: 'Server → Client',
                desc: 'Emitted after each /step call. Contains action, reward, and full observation.',
                payload: `{
  "type": "step",
  "step_number": 5,
  "action": { "action_type": "identify_gap", ... },
  "reward": 0.20,
  "reward_reason": "Correct data_retention gap in privacy_policy.s2",
  "observation": { /* Full ARIAObservation */ }
}`,
              },
              {
                type: 'incident_alert',
                direction: 'Server → Client',
                desc: 'Emitted once at step 25 in Expert tasks when the data breach triggers.',
                payload: `{
  "type": "incident_alert",
  "incident": {
    "incident_id": "INC-2024-001",
    "incident_type": "unauthorized_database_access",
    "records_affected": 85000,
    "deadline_steps": 8,
    "required_responses": ["contain_breach", "document_incident", ...]
  },
  "message": "ALERT: Unauthorized access detected..."
}`,
              },
              {
                type: 'episode_complete',
                direction: 'Server → Client',
                desc: 'Emitted when done=true. Signals frontend to show final grade.',
                payload: `{
  "type": "episode_complete",
  "session_id": "hackathon_demo_001"
}`,
              },
            ].map(event => (
              <div key={event.type} className="border border-aria-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <code className="text-sm font-mono font-bold text-aria-textMain">{event.type}</code>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{event.direction}</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">{event.desc}</p>
                <div className="bg-gray-900 rounded-xl p-4 relative">
                  <div className="absolute top-2 right-2">
                    <CopyButton text={event.payload} />
                  </div>
                  <pre className="text-[11px] text-gray-300 font-mono overflow-x-auto">{event.payload}</pre>
                </div>
              </div>
            ))}

            <div className="p-4 bg-gray-900 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">JavaScript Example</p>
              <pre className="text-[11px] text-gray-300 font-mono">{`const socket = new WebSocket('wss://your-space.hf.space/aria/ws/session-001');

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'step') {
    console.log('Reward:', data.reward, '| Phase:', data.observation.phase);
  }
  
  if (data.type === 'incident_alert') {
    console.warn('BREACH!', data.incident);
  }
  
  if (data.type === 'episode_complete') {
    // Fetch /grader to get final score
    fetch('/grader', { method: 'POST', headers: {'X-Session-ID': 'session-001'} });
  }
};`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}