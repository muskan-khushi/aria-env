import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Cell } from 'recharts';

interface RewardChartProps {
  data: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      borderRadius: '16px',
      background: 'white',
      boxShadow: '0 20px 60px -10px rgba(109,40,217,0.2), 0 4px 16px rgba(109,40,217,0.08)',
      padding: '14px 18px',
      fontSize: 12,
      border: '1.5px solid rgba(196,181,253,0.4)',
      fontFamily: "'Bricolage Grotesque', sans-serif",
    }}>
      <p style={{ fontWeight: 800, marginBottom: 8, color: '#1a0a2e', fontSize: 13 }}>Step {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{
          color: p.dataKey === 'reward' ? '#8B5CF6' : '#10B981',
          margin: '4px 0',
          fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dataKey === 'reward' ? '#8B5CF6' : '#10B981', display: 'inline-block' }} />
          {p.dataKey === 'reward' ? 'Step Reward' : 'Cumulative'}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function RewardChart({ data }: RewardChartProps) {
  if (!data || data.length <= 1) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: '180px',
        background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)',
        borderRadius: '20px',
        border: '1.5px dashed rgba(196,181,253,0.5)',
        fontFamily: "'Bricolage Grotesque', sans-serif",
      }}>
        <div style={{ fontSize: 32, opacity: 0.5 }}>📈</div>
        <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, textAlign: 'center', fontStyle: 'italic' }}>
          Performance curve appears once agent starts running...
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: '180px', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="rewardGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="penaltyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EC4899" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#DB2777" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(196,181,253,0.2)" />
          <XAxis
            dataKey="step"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="reward" radius={[6, 6, 0, 0]} maxBarSize={32}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.reward >= 0 ? 'url(#rewardGradient)' : 'url(#penaltyGradient)'}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#10B981"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: '#10B981', strokeWidth: 0, filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.6))' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}