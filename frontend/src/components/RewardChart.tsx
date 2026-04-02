import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line } from 'recharts';

interface RewardChartProps {
  data: any[];
}

export default function RewardChart({ data }: RewardChartProps) {
  return (
    <div className="flex-1 matte-panel p-4 bg-white">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DDF4" />
          <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5B81' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5B81' }} />
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(109, 40, 217, 0.1)' }} />
          <Bar dataKey="reward" fill="#EDE9FE" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="cumulative" stroke="#6D28D9" strokeWidth={3} dot={{ r: 4, fill: '#6D28D9', strokeWidth: 0 }} isAnimationActive={true} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}