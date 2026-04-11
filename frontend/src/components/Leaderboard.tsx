import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Zap, Medal } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, ZAxis,
} from 'recharts';

const fallbackLeaderboard = [
  { rank: 1, agent: "GPT-4o-mini (Multi)", easy: 0.94, medium: 0.71, hard: 0.52, expert: 0.33, avg: 0.63, status: "baseline", precision: 0.88, recall: 0.75 },
  { rank: 2, agent: "Qwen 2.5 7B (MultiPass)", easy: 0.76, medium: 0.58, hard: 0.54, expert: 0.38, avg: 0.56, status: "baseline", precision: 0.95, recall: 0.78 },
  { rank: 3, agent: "GPT-4o-mini (Single)", easy: 0.87, medium: 0.63, hard: 0.44, expert: 0.28, avg: 0.56, status: "baseline", precision: 0.81, recall: 0.62 },
  { rank: 4, agent: "GPT-3.5-turbo", easy: 0.72, medium: 0.48, hard: 0.31, expert: 0.17, avg: 0.42, status: "baseline", precision: 0.65, recall: 0.45 },
  { rank: 5, agent: "Random Agent", easy: 0.15, medium: 0.09, hard: 0.04, expert: 0.02, avg: 0.08, status: "control", precision: 0.12, recall: 0.15 },
];

const TIER_COLORS = { easy: '#10B981', medium: '#8B5CF6', hard: '#F97316', expert: '#EC4899' };
const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const AGENT_COLORS = ['#8B5CF6', '#EC4899', '#F97316', '#10B981', '#9CA3AF'];

function ScoreBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${(value / max) * 100}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: 99, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, minWidth: 36, color: '#1a0a2e' }}>{value.toFixed(2)}</span>
    </div>
  );
}

function DifficultySpreadChart({ data }: { data: typeof fallbackLeaderboard }) {
  const chartData = data.map(d => ({
    name: d.agent.split('(')[0].trim().replace('GPT-', 'GPT ').replace('Qwen 2.5 7B', 'Qwen').replace(/Qwen.*/, 'Qwen'),
    Easy: d.easy, Medium: d.medium, Hard: d.hard, Expert: d.expert,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(196,181,253,0.2)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: 'white', border: '1.5px solid rgba(196,181,253,0.4)', borderRadius: 14, padding: '10px 14px', fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif", boxShadow: '0 10px 30px rgba(109,40,217,0.1)' }}>
                <p style={{ fontWeight: 800, marginBottom: 6, color: '#1a0a2e', fontSize: 13 }}>{label}</p>
                {payload.map((p: any) => (
                  <p key={p.dataKey} style={{ color: p.fill, margin: '3px 0', fontWeight: 700 }}>{p.dataKey}: {p.value.toFixed(2)}</p>
                ))}
              </div>
            );
          }}
        />
        {(['Easy', 'Medium', 'Hard', 'Expert'] as const).map(tier => (
          <Bar key={tier} dataKey={tier} fill={TIER_COLORS[tier.toLowerCase() as keyof typeof TIER_COLORS]} radius={[5, 5, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PrecisionRecallChart({ data }: { data: typeof fallbackLeaderboard }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,181,253,0.2)" />
        <XAxis type="number" dataKey="precision" name="Precision" domain={[0, 1]} tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif" }} axisLine={false} tickLine={false} label={{ value: 'Precision', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }} />
        <YAxis type="number" dataKey="recall" name="Recall" domain={[0, 1]} tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif" }} axisLine={false} tickLine={false} label={{ value: 'Recall', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }} />
        <ZAxis range={[100, 100]} />
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{ background: 'white', border: '1.5px solid rgba(196,181,253,0.4)', borderRadius: 14, padding: '10px 14px', fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif", boxShadow: '0 10px 30px rgba(109,40,217,0.1)' }}>
                <p style={{ fontWeight: 800, marginBottom: 6, color: '#1a0a2e' }}>{d.agent}</p>
                <p style={{ color: '#8B5CF6', margin: '3px 0', fontWeight: 700 }}>Precision: {d.precision.toFixed(2)}</p>
                <p style={{ color: '#10B981', margin: '3px 0', fontWeight: 700 }}>Recall: {d.recall.toFixed(2)}</p>
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((_, index) => (
            <Cell key={index} fill={AGENT_COLORS[index] ?? '#9CA3AF'} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function RadarSpread({ agent }: { agent: typeof fallbackLeaderboard[0] }) {
  const radarData = [
    { tier: 'Easy', value: agent.easy },
    { tier: 'Medium', value: agent.medium },
    { tier: 'Hard', value: agent.hard },
    { tier: 'Expert', value: agent.expert },
    { tier: 'Prec.', value: agent.precision },
    { tier: 'Recall', value: agent.recall },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
        <PolarGrid stroke="rgba(196,181,253,0.3)" />
        <PolarAngleAxis dataKey="tier" tick={{ fontSize: 11, fill: '#7C6E9C', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }} />
        <Radar dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.18} strokeWidth={2.5} dot={{ r: 4, fill: '#8B5CF6' }} />
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
              fetchedAgents[agentKey] = { agent: agentKey, easy: 0, medium: 0, hard: 0, export: 0, expert: 0, status: "local run", precisions: [], recalls: [], evidences: [], remediations: [] };
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
            if (existingIdx !== -1) combined[existingIdx] = item;
            else combined.push(item);
          });
          combined.sort((a, b) => b.avg - a.avg);
          combined.forEach((a, idx) => { a.rank = idx + 1; });
          setData(combined);
          setSelectedAgent(combined[0]);
        }
      })
      .catch(console.error);
  }, []);

  const best = data[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', minHeight: '680px', fontFamily: "'Bricolage Grotesque', sans-serif" }}>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1.5px solid rgba(196,181,253,0.25)', background: 'white', borderRadius: '24px 24px 0 0', border: '1.5px solid rgba(196,181,253,0.3)', overflow: 'hidden' }}>
        {[
          { label: 'Top Score', value: best.avg.toFixed(2), sub: best.agent.split('(')[0].trim(), icon: Trophy, gradient: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', color: '#8B5CF6' },
          { label: 'Best Precision', value: best.precision.toFixed(2), sub: 'avg across tasks', icon: Target, gradient: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', color: '#EC4899' },
          { label: 'Best Recall', value: best.recall.toFixed(2), sub: 'avg across tasks', icon: TrendingUp, gradient: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', color: '#10B981' },
          { label: 'Agents Ranked', value: data.length, sub: `${data.filter(d => d.status === 'baseline').length} baselines`, icon: Zap, gradient: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', color: '#F59E0B' },
        ].map((card, i) => (
          <div key={i} style={{ padding: '28px 28px', borderRight: i < 3 ? '1px solid rgba(196,181,253,0.2)' : 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: card.gradient, borderRadius: '0 0 0 100%', opacity: 0.6 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 10, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <card.icon style={{ width: 14, height: 14, color: card.color }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF' }}>{card.label}</span>
            </div>
            <p style={{ fontSize: 36, fontWeight: 800, color: card.color, margin: 0, lineHeight: 1, letterSpacing: '-1px' }}>{card.value}</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', flex: 1, minHeight: 0, marginTop: 20, gap: 20 }}>

        {/* Table */}
        <div style={{
          background: 'white',
          borderRadius: 24,
          border: '1.5px solid rgba(196,181,253,0.3)',
          overflow: 'hidden',
          boxShadow: '0 8px 40px -8px rgba(109,40,217,0.06)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid rgba(196,181,253,0.2)', background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)' }}>
                {['Rank', 'Agent', 'Easy', 'Medium', 'Hard', 'Expert', 'Avg'].map(h => (
                  <th key={h} style={{ padding: '16px 18px', textAlign: h === 'Agent' ? 'left' : 'center', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const isSelected = selectedAgent?.agent === row.agent;
                return (
                  <tr key={i} onClick={() => setSelectedAgent(row)} style={{
                    borderBottom: '1px solid rgba(196,181,253,0.12)',
                    background: isSelected ? 'linear-gradient(135deg, #FAF7FF, #F3EEFF)' : 'white',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    borderLeft: isSelected ? '4px solid #8B5CF6' : '4px solid transparent',
                  }}>
                    <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                      {i < 3
                        ? <span style={{ fontSize: 20 }}>{RANK_MEDALS[i]}</span>
                        : <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', background: '#F3F4F6', padding: '3px 8px', borderRadius: 8 }}>#{row.rank}</span>
                      }
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#1a0a2e', margin: '0 0 4px' }}>{row.agent}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 100, background: row.status === 'control' ? '#F3F4F6' : '#EDE9FE', color: row.status === 'control' ? '#9CA3AF' : '#6D28D9' }}>{row.status}</span>
                    </td>
                    {(['easy', 'medium', 'hard', 'expert'] as const).map(tier => (
                      <td key={tier} style={{ padding: '16px 10px' }}>
                        <ScoreBar value={row[tier]} color={TIER_COLORS[tier]} />
                      </td>
                    ))}
                    <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: '#8B5CF6', background: '#EDE9FE', padding: '4px 10px', borderRadius: 10 }}>{row.avg.toFixed(2)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Charts panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart tabs */}
          <div style={{ background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.3)', padding: '8px', display: 'flex', gap: 4 }}>
            {(['spread', 'scatter', 'radar'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveChart(tab)} style={{
                flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                border: 'none', cursor: 'pointer', borderRadius: 18, transition: 'all 0.2s',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                background: activeChart === tab ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)' : 'transparent',
                color: activeChart === tab ? 'white' : '#9CA3AF',
                boxShadow: activeChart === tab ? '0 4px 12px rgba(139,92,246,0.3)' : 'none',
              }}>
                {tab === 'spread' ? 'Tiers' : tab === 'scatter' ? 'P/R' : 'Radar'}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{ background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.3)', padding: '16px', height: 220, boxShadow: '0 4px 20px rgba(109,40,217,0.06)' }}>
            {activeChart === 'spread' && <DifficultySpreadChart data={data} />}
            {activeChart === 'scatter' && <PrecisionRecallChart data={data} />}
            {activeChart === 'radar' && selectedAgent && <RadarSpread agent={selectedAgent} />}
          </div>

          {/* Selected agent detail */}
          {selectedAgent && (
            <div style={{ background: 'white', borderRadius: 24, border: '1.5px solid rgba(196,181,253,0.3)', padding: '20px', flex: 1, boxShadow: '0 4px 20px rgba(109,40,217,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Medal style={{ width: 16, height: 16, color: '#8B5CF6' }} />
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9CA3AF', margin: 0 }}>
                  {selectedAgent.agent.split('(')[0].trim()}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {(['easy', 'medium', 'hard', 'expert'] as const).map(tier => (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', minWidth: 52 }}>{tier}</span>
                    <ScoreBar value={selectedAgent[tier]} color={TIER_COLORS[tier]} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', borderRadius: 16, padding: '14px' }}>
                  <p style={{ fontSize: 10, color: '#8B5CF6', margin: '0 0 4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Precision</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: '#6D28D9', margin: 0, letterSpacing: '-0.5px' }}>{selectedAgent.precision?.toFixed(2) || '0.00'}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', borderRadius: 16, padding: '14px' }}>
                  <p style={{ fontSize: 10, color: '#10B981', margin: '0 0 4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recall</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 800, color: '#065F46', margin: 0, letterSpacing: '-0.5px' }}>{selectedAgent.recall?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(TIER_COLORS).map(([tier, color]) => (
              <span key={tier} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7C6E9C', fontWeight: 700, background: 'white', padding: '5px 10px', borderRadius: 100, border: '1px solid rgba(196,181,253,0.3)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}