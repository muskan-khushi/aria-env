import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Zap } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, ZAxis,
} from 'recharts';

const fallbackLeaderboard = [
  { rank: 1, agent: "GPT-4o-mini (Multi)", easy: 0.94, medium: 0.71, hard: 0.52, expert: 0.33, avg: 0.63, status: "baseline", precision: 0.88, recall: 0.75 },
  { rank: 2, agent: "GPT-4o-mini (Single)", easy: 0.87, medium: 0.63, hard: 0.44, expert: 0.28, avg: 0.56, status: "baseline", precision: 0.81, recall: 0.62 },
  { rank: 3, agent: "Nemotron-3-Super (SinglePass)", easy: 0.74, medium: 0.60, hard: 0.52, expert: 0.35, avg: 0.55, status: "baseline", precision: 1.0, recall: 0.76 },
  { rank: 4, agent: "Nemotron-3-Super (MultiPass)", easy: 0.74, medium: 0.55, hard: 0.47, expert: 0.36, avg: 0.53, status: "baseline", precision: 0.95, recall: 0.79 },
  { rank: 5, agent: "llama-3.1-8b-instant (MultiPass)", easy: 0.64, medium: 0.53, hard: 0.47, expert: 0.37, avg: 0.50, status: "baseline", precision: 0.83, recall: 0.40 },
  { rank: 6, agent: "GPT-3.5-turbo", easy: 0.72, medium: 0.48, hard: 0.31, expert: 0.17, avg: 0.42, status: "baseline", precision: 0.65, recall: 0.45 },
  { rank: 7, agent: "llama-3.1-8b-instant (SinglePass)", easy: 0.28, medium: 0.03, hard: 0.03, expert: 0.03, avg: 0.09, status: "baseline", precision: 0.25, recall: 0.08 },
  { rank: 8, agent: "Random Agent", easy: 0.15, medium: 0.09, hard: 0.04, expert: 0.02, avg: 0.08, status: "control", precision: 0.12, recall: 0.15 },
];

const TIER_COLORS: Record<string, string> = {
  easy:   '#A78BFA',
  medium: '#818CF8',
  hard:   '#6D28D9',
  expert: '#3B0764',
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const AGENT_COLORS = ['#7C3AED', '#6D28D9', '#4C1D95', '#94A3B8'];

function ScoreBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(109,40,217,0.08)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, fontFamily: 'monospace', minWidth: 32, color: 'var(--color-text-primary)' }}>{value.toFixed(2)}</span>
    </div>
  );
}

function DifficultySpreadChart({ data }: { data: typeof fallbackLeaderboard }) {
  const chartData = data.map(d => ({
    name: d.agent.split('(')[0].trim()
      .replace('GPT-', '')
      .replace('llama-3.1-8b-instant', 'Llama 3.1')
      .replace('Nemotron-3-Super', 'Nemotron')
      .replace(/nvidia\/nemotron.*/, 'Nemotron'),
    Easy: d.easy,
    Medium: d.medium,
    Hard: d.hard,
    Expert: d.expert,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(109,40,217,0.08)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                <p style={{ fontWeight: 500, marginBottom: 4, color: 'var(--color-text-primary)' }}>{label}</p>
                {payload.map((p: any) => (
                  <p key={p.dataKey} style={{ color: p.fill, margin: '2px 0' }}>{p.dataKey}: {p.value.toFixed(2)}</p>
                ))}
              </div>
            );
          }}
        />
        {(['Easy', 'Medium', 'Hard', 'Expert'] as const).map((tier) => (
          <Bar key={tier} dataKey={tier} fill={TIER_COLORS[tier.toLowerCase()]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PrecisionRecallChart({ data }: { data: typeof fallbackLeaderboard }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(109,40,217,0.08)" />
        <XAxis type="number" dataKey="precision" name="Precision" domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} label={{ value: 'Precision', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#6B5B81' }} />
        <YAxis type="number" dataKey="recall" name="Recall" domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} label={{ value: 'Recall', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#6B5B81' }} />
        <ZAxis range={[80, 80]} />
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                <p style={{ fontWeight: 500, marginBottom: 4, color: 'var(--color-text-primary)' }}>{d.agent}</p>
                <p style={{ color: '#7C3AED', margin: '2px 0' }}>Precision: {d.precision.toFixed(2)}</p>
                <p style={{ color: '#0D9488', margin: '2px 0' }}>Recall: {d.recall.toFixed(2)}</p>
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((_, index) => (
            <Cell key={index} fill={AGENT_COLORS[index] ?? '#94A3B8'} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function RadarSpread({ agent }: { agent: typeof fallbackLeaderboard[0] }) {
  const radarData = [
    { tier: 'Easy',   value: agent.easy },
    { tier: 'Medium', value: agent.medium },
    { tier: 'Hard',   value: agent.hard },
    { tier: 'Expert', value: agent.expert },
    { tier: 'Prec.',  value: agent.precision },
    { tier: 'Recall', value: agent.recall },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
        <PolarGrid stroke="rgba(109,40,217,0.12)" />
        <PolarAngleAxis dataKey="tier" tick={{ fontSize: 10, fill: '#6B5B81' }} />
        <Radar dataKey="value" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.18} strokeWidth={2} dot={{ r: 3, fill: '#7C3AED' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState(fallbackLeaderboard);
  const [selectedAgent, setSelectedAgent] = useState<typeof fallbackLeaderboard[0] | null>(fallbackLeaderboard[0]);
  const [activeChart, setActiveChart] = useState<'spread' | 'scatter' | 'radar'>('spread');

  useEffect(() => {
    fetch('/aria/leaderboard')
      .then(res => res.json())
      .then(result => {
        if (result?.results?.length > 0) {
          const fetchedAgents: Record<string, any> = {};
          result.results.forEach((r: any) => {
            const agentKey = r.agent || "Local Model";
            if (!fetchedAgents[agentKey]) {
              fetchedAgents[agentKey] = { agent: agentKey, easy: 0, medium: 0, hard: 0, expert: 0, status: "local run", precisions: [], recalls: [] };
            }
            fetchedAgents[agentKey][r.task] = r.score || 0;
            fetchedAgents[agentKey].precisions.push(r.precision || 0);
            fetchedAgents[agentKey].recalls.push(r.recall || 0);
          });
          
          const formatted = Object.values(fetchedAgents).map((a: any) => ({
            ...a,
            avg: (a.easy + a.medium + a.hard + a.expert) / 4,
            precision: a.precisions.length > 0 ? a.precisions.reduce((s: number, v: number) => s + v, 0) / a.precisions.length : 0,
            recall: a.recalls.length > 0 ? a.recalls.reduce((s: number, v: number) => s + v, 0) / a.recalls.length : 0,
          }));
          
          const combined = [...fallbackLeaderboard];
          
          formatted.forEach(item => {
            const existingIdx = combined.findIndex(c => c.agent === item.agent);
            if (existingIdx !== -1) {
              combined[existingIdx] = item;
            } else {
              combined.push(item);
            }
          });
          
          combined.sort((a, b) => b.avg - a.avg);
          combined.forEach((a, idx) => { a.rank = idx + 1; });
          
          setData(combined);
          setSelectedAgent(combined[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to load leaderboard data: ", err);
      });
  }, []);

  const best = data[0];

  return (
    <div className="h-full matte-panel bg-white flex flex-col gap-0 animate-in fade-in duration-500 overflow-y-auto">
      
      {/* ── Top summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid rgba(109,40,217,0.1)' }}>
        {[
          { label: 'Top Score', value: best.avg.toFixed(2), sub: best.agent.split('(')[0].trim(), icon: Trophy, color: '#7C3AED' },
          { label: 'Best Precision', value: best.precision.toFixed(2), sub: 'avg across tasks', icon: Target, color: '#6D28D9' },
          { label: 'Best Recall', value: best.recall.toFixed(2), sub: 'avg across tasks', icon: TrendingUp, color: '#5B21B6' },
          { label: 'Agents Ranked', value: data.length, sub: `${data.filter(d => d.status === 'baseline').length} baseline`, icon: Zap, color: '#4C1D95' },
        ].map((card, i) => (
          <div key={i} style={{ padding: '20px 24px', borderRight: i < 3 ? '1px solid rgba(109,40,217,0.08)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <card.icon style={{ width: 14, height: 14, color: card.color }} />
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>{card.label}</span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 700, color: card.color, margin: 0, lineHeight: 1 }}>{card.value}</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, minHeight: 0 }}>
        
        {/* ── Left: table ── */}
        <div style={{ overflowY: 'auto', borderRight: '1px solid rgba(109,40,217,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(109,40,217,0.1)', position: 'sticky', top: 0, background: 'var(--color-background-primary)', zIndex: 1 }}>
                {['Rank', 'Agent', 'Easy', 'Medium', 'Hard', 'Expert', 'Avg'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Agent' ? 'left' : 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const isSelected = selectedAgent?.agent === row.agent;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedAgent(row)}
                    style={{
                      borderBottom: '1px solid rgba(109,40,217,0.06)',
                      background: isSelected ? 'rgba(109,40,217,0.04)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      borderLeft: isSelected ? '3px solid #7C3AED' : '3px solid transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {i < 3
                        ? <span style={{ fontSize: 16 }}>{RANK_MEDALS[i]}</span>
                        : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>#{row.rank}</span>
                      }
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{row.agent}</p>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 4, background: row.status === 'control' ? 'rgba(148,163,184,0.15)' : 'rgba(109,40,217,0.08)', color: row.status === 'control' ? 'var(--color-text-secondary)' : '#6D28D9' }}>{row.status}</span>
                    </td>
                    {(['easy', 'medium', 'hard', 'expert'] as const).map(tier => (
                      <td key={tier} style={{ padding: '14px 8px' }}>
                        <ScoreBar value={row[tier]} color={TIER_COLORS[tier]} />
                      </td>
                    ))}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#7C3AED', fontFamily: 'monospace' }}>{row.avg.toFixed(2)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Right: charts panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: 12, overflowY: 'auto' }}>
          
          {/* Chart tab switcher */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(109,40,217,0.06)', borderRadius: 8, padding: 3 }}>
            {(['spread', 'scatter', 'radar'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveChart(tab)}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', border: 'none', cursor: 'pointer', borderRadius: 6, transition: 'all 0.2s',
                  background: activeChart === tab ? '#7C3AED' : 'transparent',
                  color: activeChart === tab ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {tab === 'spread' ? 'Tiers' : tab === 'scatter' ? 'P/R' : 'Radar'}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{ height: 200 }}>
            {activeChart === 'spread' && <DifficultySpreadChart data={data} />}
            {activeChart === 'scatter' && <PrecisionRecallChart data={data} />}
            {activeChart === 'radar' && selectedAgent && <RadarSpread agent={selectedAgent} />}
          </div>

          {/* Selected agent detail */}
          {selectedAgent && (
            <div style={{ borderTop: '1px solid rgba(109,40,217,0.1)', paddingTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                {selectedAgent.agent.split('(')[0].trim()} — breakdown
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(['easy', 'medium', 'hard', 'expert'] as const).map(tier => (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', minWidth: 48 }}>{tier}</span>
                    <ScoreBar value={selectedAgent[tier]} color={TIER_COLORS[tier]} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div style={{ background: 'rgba(109,40,217,0.05)', borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: 0 }}>Precision</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#7C3AED', margin: '2px 0 0', fontFamily: 'monospace' }}>{selectedAgent.precision.toFixed(2)}</p>
                  </div>
                  <div style={{ background: 'rgba(13,148,136,0.05)', borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: 0 }}>Recall</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#0D9488', margin: '2px 0 0', fontFamily: 'monospace' }}>{selectedAgent.recall.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Color legend */}
          <div style={{ borderTop: '1px solid rgba(109,40,217,0.08)', paddingTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(TIER_COLORS).map(([tier, color]) => (
              <span key={tier} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                {tier}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}