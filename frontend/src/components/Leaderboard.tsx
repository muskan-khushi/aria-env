import { Trophy } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ZAxis } from 'recharts';

const mockLeaderboard = [
  { rank: 1, agent: "GPT-4o-mini (Multi)", easy: 0.94, medium: 0.71, hard: 0.52, expert: 0.33, avg: 0.63, status: "baseline", precision: 0.88, recall: 0.75 },
  { rank: 2, agent: "GPT-4o-mini (Single)", easy: 0.87, medium: 0.63, hard: 0.44, expert: 0.28, avg: 0.56, status: "baseline", precision: 0.81, recall: 0.62 },
  { rank: 3, agent: "GPT-3.5-turbo", easy: 0.72, medium: 0.48, hard: 0.31, expert: 0.17, avg: 0.42, status: "baseline", precision: 0.65, recall: 0.45 },
  { rank: 4, agent: "Random Agent", easy: 0.15, medium: 0.09, hard: 0.04, expert: 0.02, avg: 0.08, status: "control", precision: 0.12, recall: 0.15 }
];

export default function Leaderboard() {
  return (
    <div className="h-full matte-panel bg-white p-8 flex flex-col gap-8 animate-in fade-in duration-500 overflow-y-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-aria-textMain">Agent Leaderboard</h2>
          <p className="text-sm text-aria-textMuted mt-1">Multi-tier evaluation scores across baseline and submitted agents.</p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-2 gap-6 h-64">
        <div className="p-4 border border-aria-border rounded-xl bg-[#FAFAFD] flex flex-col">
          <h3 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest mb-4">Difficulty Spread</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockLeaderboard} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DDF4" />
              <XAxis dataKey="agent" tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(109, 40, 217, 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="easy" name="Easy" fill="#A78BFA" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expert" name="Expert" fill="#6D28D9" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 border border-aria-border rounded-xl bg-[#FAFAFD] flex flex-col">
          <h3 className="text-xs font-bold text-aria-textMuted uppercase tracking-widest mb-4">Precision / Recall Matrix</h3>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4DDF4" />
              <XAxis type="number" dataKey="precision" name="Precision" domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="recall" name="Recall" domain={[0, 1]} tick={{ fontSize: 10, fill: '#6B5B81' }} axisLine={false} tickLine={false} />
              <ZAxis type="category" dataKey="agent" name="Agent" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(109, 40, 217, 0.1)' }} />
              <Scatter name="Agents" data={mockLeaderboard} fill="#6D28D9" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto rounded-xl border border-aria-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAFAFD] sticky top-0 border-b border-aria-border">
            <tr>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Rank</th>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Agent Name</th>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Type</th>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Easy</th>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Medium</th>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Hard</th>
              <th className="p-4 font-bold text-aria-textMuted uppercase tracking-wider text-xs">Expert</th>
              <th className="p-4 font-bold text-aria-accent uppercase tracking-wider text-xs">Avg Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aria-border">
            {mockLeaderboard.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition">
                <td className="p-4 font-bold text-aria-textMain">{row.rank === 1 ? <Trophy className="w-4 h-4 text-amber-500" /> : `#${row.rank}`}</td>
                <td className="p-4 font-bold text-aria-textMain">{row.agent}</td>
                <td className="p-4"><span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-gray-100 text-gray-600">{row.status}</span></td>
                <td className="p-4 text-aria-textMuted font-mono">{row.easy.toFixed(2)}</td>
                <td className="p-4 text-aria-textMuted font-mono">{row.medium.toFixed(2)}</td>
                <td className="p-4 text-aria-textMuted font-mono">{row.hard.toFixed(2)}</td>
                <td className="p-4 text-aria-textMuted font-mono">{row.expert.toFixed(2)}</td>
                <td className="p-4 font-bold text-aria-accent font-mono text-base">{row.avg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}