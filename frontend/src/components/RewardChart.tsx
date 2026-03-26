import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ARIAEvent } from '../types/aria.types';

interface RewardChartProps {
  events: ARIAEvent[];
}

interface ChartDataPoint {
  step: number;
  reward: number;
  cumulative: number;
  phase: string;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs space-y-1">
      <p className="section-label mb-1">Step {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }}>{p.name === 'reward' ? 'Step Δ' : 'Cumulative'}</span>
          <span
            className="font-mono font-medium"
            style={{ color: p.name === 'reward' ? (p.value >= 0 ? '#86efac' : '#f87171') : '#c084fc' }}
          >
            {p.value >= 0 ? '+' : ''}{p.value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RewardChart({ events }: RewardChartProps) {
  const stepEvents = events.filter((e) => e.type === 'step');

  const data: ChartDataPoint[] = stepEvents.map((e, i) => {
    if (e.type !== 'step') return { step: i + 1, reward: 0, cumulative: 0, phase: '' };
    return {
      step: e.step_number,
      reward: e.reward,
      cumulative: e.observation.cumulative_reward,
      phase: e.observation.phase,
    };
  });

  const phaseChanges: number[] = [];
  data.forEach((d, i) => {
    if (i > 0 && d.phase !== data[i - 1].phase) phaseChanges.push(d.step);
  });

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="text-2xl opacity-20">∿</div>
          <p className="section-label">Awaiting episode data</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgba(204,170,230,0.05)" vertical={false} />
        <XAxis
          dataKey="step"
          tick={{ fill: 'rgba(167,136,220,0.5)', fontSize: 10, fontFamily: 'Fira Code' }}
          axisLine={{ stroke: 'rgba(204,170,230,0.08)' }}
          tickLine={false}
          label={{ value: 'Step', position: 'insideBottomRight', fill: 'rgba(167,136,220,0.4)', fontSize: 9 }}
        />
        <YAxis
          tick={{ fill: 'rgba(167,136,220,0.5)', fontSize: 10, fontFamily: 'Fira Code' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(150,115,210,0.06)' }} />
        {phaseChanges.map((step) => (
          <ReferenceLine
            key={step}
            x={step}
            stroke="rgba(167,136,220,0.2)"
            strokeDasharray="3 3"
          />
        ))}
        <ReferenceLine y={0} stroke="rgba(204,170,230,0.1)" />
        <Bar dataKey="reward" radius={[2, 2, 0, 0]} maxBarSize={16} opacity={0.85}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.reward >= 0 ? 'rgba(150,115,210,0.7)' : 'rgba(239,68,68,0.6)'}
            />
          ))}
        </Bar>
        <Line
          dataKey="cumulative"
          stroke="#c084fc"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: '#c084fc', strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}