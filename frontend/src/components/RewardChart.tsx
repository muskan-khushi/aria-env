import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Cell } from 'recharts';

interface RewardChartProps {
  data: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ borderRadius: '12px', background: '#fff', boxShadow: '0 4px 20px rgba(109,40,217,0.1)', padding: '10px 14px', fontSize: 11 }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>Step {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.dataKey === 'reward' ? '#7C3AED' : '#0D9488', margin: 0 }}>
          {p.dataKey === 'reward' ? 'Step Reward' : 'Cumulative'}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function RewardChart({ data }: RewardChartProps) {
  if (!data || data.length <= 1) {
    return (
      <div className="flex-1 matte-panel p-4 bg-white flex items-center justify-center text-xs text-aria-textMuted italic" style={{ minHeight: '200px' }}>
        Performance curve will appear once agent starts running...
      </div>
    );
  }

  return (
    <div className="flex-1 matte-panel p-4 bg-white" style={{ minHeight: '200px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DDF4" />
          <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5B81' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5B81' }} />
          <Tooltip content={<CustomTooltip />} />
          {/* Per-bar coloring: purple = positive reward, red = penalty */}
          <Bar dataKey="reward" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.reward >= 0 ? '#7C3AED' : '#DC2626'}
                opacity={0.75}
              />
            ))}
          </Bar>
          {/* Teal cumulative reward line */}
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#0D9488"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, fill: '#0D9488', strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}