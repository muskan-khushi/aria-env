import { useEffect, useState } from "react";
import { RefreshCw, ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useARIALeaderboard } from "../hooks/useARIAEnv";
import type { LeaderboardEntry } from "../types/aria.types";

type SortKey = keyof LeaderboardEntry;
type SortDir = "asc" | "desc";

function ScoreBar({ value }: { value: number }) {
  const pct = value * 100;
  const color =
    pct >= 80
      ? "#6ee7b7"
      : pct >= 60
        ? "var(--color-lavender)"
        : pct >= 40
          ? "#fbbf24"
          : "#f87171";

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1 rounded-full overflow-hidden"
        style={{ background: "rgba(204,170,230,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-mono text-xs w-10 text-right" style={{ color }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function DiffBadge({ diff }: { diff: string }) {
  const map: Record<string, string> = {
    easy: "badge-easy",
    medium: "badge-medium-diff",
    hard: "badge-hard",
    expert: "badge-expert",
  };
  return (
    <span className={`badge ${map[diff] ?? "badge-pending"}`}>{diff}</span>
  );
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "model", label: "Model" },
  { key: "agent_type", label: "Agent" },
  { key: "task_title", label: "Task" },
  { key: "difficulty", label: "Difficulty" },
  { key: "score", label: "Score", numeric: true },
  { key: "precision", label: "Precision", numeric: true },
  { key: "recall", label: "Recall", numeric: true },
  { key: "f1", label: "F1", numeric: true },
];

// Static baseline data for display when API not connected
const BASELINE_DATA: LeaderboardEntry[] = [
  {
    id: "1",
    task_id: "easy",
    task_title: "Basic GDPR Audit",
    difficulty: "easy",
    model: "gpt-4o-mini",
    agent_type: "SinglePass",
    score: 0.87,
    precision: 0.91,
    recall: 0.84,
    f1: 0.87,
    date: "2024-01-01",
  },
  {
    id: "2",
    task_id: "easy",
    task_title: "Basic GDPR Audit",
    difficulty: "easy",
    model: "gpt-4o-mini",
    agent_type: "MultiPass",
    score: 0.94,
    precision: 0.96,
    recall: 0.92,
    f1: 0.94,
    date: "2024-01-01",
  },
  {
    id: "3",
    task_id: "medium",
    task_title: "Cross-Doc Review",
    difficulty: "medium",
    model: "gpt-4o-mini",
    agent_type: "SinglePass",
    score: 0.63,
    precision: 0.71,
    recall: 0.58,
    f1: 0.64,
    date: "2024-01-01",
  },
  {
    id: "4",
    task_id: "medium",
    task_title: "Cross-Doc Review",
    difficulty: "medium",
    model: "gpt-4o-mini",
    agent_type: "MultiPass",
    score: 0.71,
    precision: 0.79,
    recall: 0.65,
    f1: 0.71,
    date: "2024-01-01",
  },
  {
    id: "5",
    task_id: "hard",
    task_title: "Multi-Framework Conflict",
    difficulty: "hard",
    model: "gpt-4o-mini",
    agent_type: "SinglePass",
    score: 0.44,
    precision: 0.52,
    recall: 0.39,
    f1: 0.45,
    date: "2024-01-01",
  },
  {
    id: "6",
    task_id: "hard",
    task_title: "Multi-Framework Conflict",
    difficulty: "hard",
    model: "gpt-4o-mini",
    agent_type: "MultiPass",
    score: 0.52,
    precision: 0.61,
    recall: 0.46,
    f1: 0.52,
    date: "2024-01-01",
  },
  {
    id: "7",
    task_id: "expert",
    task_title: "Incident Response Suite",
    difficulty: "expert",
    model: "gpt-4o-mini",
    agent_type: "SinglePass",
    score: 0.28,
    precision: 0.38,
    recall: 0.24,
    f1: 0.29,
    date: "2024-01-01",
  },
  {
    id: "8",
    task_id: "expert",
    task_title: "Incident Response Suite",
    difficulty: "expert",
    model: "gpt-4o-mini",
    agent_type: "MultiPass",
    score: 0.33,
    precision: 0.44,
    recall: 0.28,
    f1: 0.34,
    date: "2024-01-01",
  },
];

export function Leaderboard() {
  const { entries, loading, error, fetchLeaderboard } = useARIALeaderboard();
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterDiff, setFilterDiff] = useState("all");

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const data = entries.length > 0 ? entries : BASELINE_DATA;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...data]
    .filter((e) => filterDiff === "all" || e.difficulty === filterDiff)
    .sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "desc" ? -cmp : cmp;
    });

  // Chart data: difficulty spread
  const diffChartData = ["easy", "medium", "hard", "expert"].map((d) => {
    const items = data.filter((e) => e.difficulty === d);
    const avg = items.length
      ? items.reduce((s, e) => s + e.score, 0) / items.length
      : 0;
    return { difficulty: d, score: avg };
  });

  const DIFF_COLORS: Record<string, string> = {
    easy: "#6ee7b7",
    medium: "#fbbf24",
    hard: "#f87171",
    expert: "#c084fc",
  };

  // Scatter data: precision vs recall
  const scatterData = data.map((e) => ({
    x: e.recall,
    y: e.precision,
    name: `${e.model} (${e.difficulty})`,
    difficulty: e.difficulty,
  }));

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <Minus size={9} className="opacity-20" />;
    return sortDir === "desc" ? <ArrowDown size={9} /> : <ArrowUp size={9} />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="font-display text-2xl font-light"
            style={{ color: "var(--color-lilac)" }}
          >
            Leaderboard
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "rgba(204,170,230,0.4)" }}
          >
            Agent performance across all tasks and difficulty tiers
          </p>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Difficulty spread bar */}
        <div className="card-glow p-4">
          <p className="section-label mb-3">Avg Score by Difficulty</p>
          <div style={{ height: "160px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={diffChartData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(204,170,230,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="difficulty"
                  tick={{
                    fill: "rgba(167,136,220,0.5)",
                    fontSize: 10,
                    fontFamily: "Fira Code",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{
                    fill: "rgba(167,136,220,0.5)",
                    fontSize: 10,
                    fontFamily: "Fira Code",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  labelStyle={{ color: "var(--color-lilac)" }}
                  itemStyle={{ color: "var(--color-lavender)" }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {diffChartData.map((entry) => (
                    <Cell
                      key={entry.difficulty}
                      fill={DIFF_COLORS[entry.difficulty] ?? "#9673D2"}
                      opacity={0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Precision vs Recall scatter */}
        <div className="card-glow p-4">
          <p className="section-label mb-3">Precision vs Recall</p>
          <div style={{ height: "160px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(204,170,230,0.04)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Recall"
                  domain={[0, 1]}
                  tick={{
                    fill: "rgba(167,136,220,0.5)",
                    fontSize: 10,
                    fontFamily: "Fira Code",
                  }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Recall",
                    position: "insideBottomRight",
                    fill: "rgba(167,136,220,0.4)",
                    fontSize: 9,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Precision"
                  domain={[0, 1]}
                  tick={{
                    fill: "rgba(167,136,220,0.5)",
                    fontSize: 10,
                    fontFamily: "Fira Code",
                  }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Prec",
                    angle: -90,
                    position: "insideLeft",
                    fill: "rgba(167,136,220,0.4)",
                    fontSize: 9,
                  }}
                />
                <Tooltip
                  cursor={{
                    strokeDasharray: "3 3",
                    stroke: "rgba(204,170,230,0.15)",
                  }}
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  labelStyle={{ color: "var(--color-lilac)" }}
                  formatter={(value: number | string, name: string) => [
                    typeof value === "number" ? value.toFixed(3) : value,
                    name,
                  ]}
                />
                <Scatter
                  data={scatterData}
                  fill="var(--color-wisteria)"
                  opacity={0.75}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["all", "easy", "medium", "hard", "expert"].map((d) => (
          <button
            key={d}
            onClick={() => setFilterDiff(d)}
            className={`text-[10px] font-body font-medium tracking-wider uppercase px-3 py-1.5 rounded-full transition-all duration-150 ${
              filterDiff === d ? "btn-primary" : "btn-ghost"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="ml-auto mono-text opacity-50">
          {sorted.length} entries
        </span>
      </div>

      {/* Table */}
      {error && entries.length === 0 && (
        <div className="card p-3 text-center">
          <p className="text-xs opacity-60">
            Showing cached baseline data — API unavailable
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="aria-table">
            <thead>
              <tr>
                <th className="w-8 text-center opacity-40">#</th>
                {COLUMNS.map((col) => (
                  <th key={col.key}>
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:opacity-100 transition-opacity"
                      style={{ color: "rgba(167,136,220,0.6)" }}
                    >
                      {col.label}
                      <SortIcon col={col.key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => (
                <tr key={entry.id} className="animate-fade-in">
                  <td className="text-center mono-text opacity-30">{i + 1}</td>
                  <td>
                    <span
                      className="font-medium text-xs"
                      style={{ color: "var(--color-lilac)" }}
                    >
                      {entry.model}
                    </span>
                  </td>
                  <td>
                    <span className="mono-text text-[11px]">
                      {entry.agent_type}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-xs"
                      style={{ color: "rgba(204,170,230,0.7)" }}
                    >
                      {entry.task_title}
                    </span>
                  </td>
                  <td>
                    <DiffBadge diff={entry.difficulty} />
                  </td>
                  <td className="w-32">
                    <ScoreBar value={entry.score} />
                  </td>
                  <td className="mono-text text-[11px]">
                    {entry.precision.toFixed(2)}
                  </td>
                  <td className="mono-text text-[11px]">
                    {entry.recall.toFixed(2)}
                  </td>
                  <td className="mono-text text-[11px]">
                    {entry.f1.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
