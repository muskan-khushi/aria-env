import { useEffect, useState } from 'react';
import { RefreshCw, Zap, Layers, Shield, Cpu } from 'lucide-react';
import { useARIATasks, useARIAGenerate } from '../hooks/useARIAEnv';
import type { Task, Difficulty, Framework } from '../types/aria.types';

const DIFFICULTY_ICONS: Record<string, React.ReactNode> = {
  easy: <Shield size={14} />,
  medium: <Layers size={14} />,
  hard: <Zap size={14} />,
  expert: <Cpu size={14} />,
  generated: <Cpu size={14} />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#6ee7b7',
  medium: '#fbbf24',
  hard: '#f87171',
  expert: '#c084fc',
  generated: 'var(--color-lavender)',
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const color = DIFFICULTY_COLORS[difficulty] ?? 'var(--color-lavender)';
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium font-body tracking-wide px-2 py-0.5 rounded-full uppercase"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}33`,
      }}
    >
      {DIFFICULTY_ICONS[difficulty]}
      {difficulty}
    </span>
  );
}

function FrameworkTag({ f }: { f: Framework }) {
  const cls =
    f === 'GDPR'
      ? 'badge badge-gdpr'
      : f === 'HIPAA'
      ? 'badge badge-hipaa'
      : f === 'CCPA'
      ? 'badge badge-ccpa'
      : 'badge badge-soc2';
  return <span className={cls}>{f}</span>;
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="card p-4 space-y-3 hover:scale-[1.01] transition-transform duration-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-lilac)' }}>
            {task.title}
          </p>
          <p className="mono-text text-[10px] mt-0.5 opacity-60">{task.task_id}</p>
        </div>
        <DifficultyBadge difficulty={task.difficulty} />
      </div>

      <div className="flex gap-1 flex-wrap">
        {task.frameworks_in_scope.map((f) => (
          <FrameworkTag key={f} f={f} />
        ))}
        {task.is_generated && (
          <span className="badge" style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.2)' }}>
            ⚙ Generated
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <p className="text-sm font-display font-light" style={{ color: 'var(--color-lavender)' }}>
            {task.company_profile.industry}
          </p>
          <p className="section-label text-[9px]">Industry</p>
        </div>
        <div>
          <p className="text-sm font-display font-light" style={{ color: 'var(--color-lavender)' }}>
            {task.max_steps}
          </p>
          <p className="section-label text-[9px]">Max Steps</p>
        </div>
        <div>
          <p className="text-sm font-display font-light" style={{ color: 'var(--color-lavender)' }}>
            {task.company_profile.size}
          </p>
          <p className="section-label text-[9px]">Size</p>
        </div>
      </div>

      {task.company_profile.operates_in.length > 0 && (
        <p className="text-[11px]" style={{ color: 'rgba(204,170,230,0.5)' }}>
          Jurisdictions: {task.company_profile.operates_in.join(', ')}
        </p>
      )}
    </div>
  );
}

const FRAMEWORK_OPTIONS: Framework[] = ['GDPR', 'HIPAA', 'CCPA', 'SOC2'];

export function TaskExplorer() {
  const { tasks, loading, error, fetchTasks } = useARIATasks();
  const { generate, loading: generating, error: genError } = useARIAGenerate();

  const [filter, setFilter] = useState<string>('all');
  const [genDifficulty, setGenDifficulty] = useState('medium');
  const [genSeed, setGenSeed] = useState('42');
  const [genFrameworks, setGenFrameworks] = useState<Framework[]>(['GDPR', 'CCPA']);
  const [generatedTask, setGeneratedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleGenerate = async () => {
    const task = await generate({
      difficulty: genDifficulty,
      seed: parseInt(genSeed) || 42,
      frameworks: genFrameworks.join(','),
    });
    if (task) setGeneratedTask(task);
  };

  const toggleFramework = (f: Framework) => {
    setGenFrameworks((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.difficulty === filter);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-light" style={{ color: 'var(--color-lilac)' }}>
            Task Explorer
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(204,170,230,0.4)' }}>
            Browse, filter, and procedurally generate compliance scenarios
          </p>
        </div>
        <button onClick={fetchTasks} disabled={loading} className="btn-ghost flex items-center gap-2">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Difficulty filters */}
      <div className="flex items-center gap-2">
        {['all', 'easy', 'medium', 'hard', 'expert', 'generated'].map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`text-[10px] font-body font-medium tracking-wider uppercase px-3 py-1.5 rounded-full transition-all duration-150 ${
              filter === d ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            {d}
          </button>
        ))}
        <span className="ml-auto mono-text opacity-50">{filtered.length} tasks</span>
      </div>

      {/* Two-column: task grid + generator */}
      <div className="grid grid-cols-3 gap-6">
        {/* Task grid */}
        <div className="col-span-2">
          {error && (
            <div className="card p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={fetchTasks} className="btn-ghost mt-2">Retry</button>
            </div>
          )}

          {loading && !tasks.length && (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card p-4 h-44 shimmer" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <p className="section-label">No tasks found</p>
              <p className="text-xs mt-1 opacity-50">Try a different filter or generate one</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {filtered.map((task) => (
              <TaskCard key={task.task_id} task={task} />
            ))}
            {generatedTask && filter === 'all' && (
              <div className="animate-fade-up">
                <TaskCard task={generatedTask} />
              </div>
            )}
          </div>
        </div>

        {/* Procedural generator */}
        <div className="space-y-4">
          <div className="card-glow p-4 space-y-4">
            <div>
              <p className="section-label mb-1">Procedural Generator</p>
              <p className="text-xs" style={{ color: 'rgba(204,170,230,0.45)' }}>
                Synthesize a novel compliance scenario using GPT-4o-mini
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="section-label text-[10px] block mb-1.5">Difficulty</label>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value)}
                  className="select-field text-xs"
                >
                  {['easy', 'medium', 'hard', 'expert'].map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="section-label text-[10px] block mb-1.5">Seed</label>
                <input
                  type="number"
                  value={genSeed}
                  onChange={(e) => setGenSeed(e.target.value)}
                  className="input-field text-xs"
                  placeholder="42"
                />
              </div>

              <div>
                <label className="section-label text-[10px] block mb-1.5">Frameworks</label>
                <div className="flex flex-wrap gap-1.5">
                  {FRAMEWORK_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => toggleFramework(f)}
                      className={`badge transition-all duration-150 cursor-pointer ${
                        genFrameworks.includes(f)
                          ? `badge-${f.toLowerCase()}`
                          : 'badge-pending opacity-50 hover:opacity-75'
                      }`}
                    >
                      {genFrameworks.includes(f) && '✓ '}{f}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || genFrameworks.length === 0}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Cpu size={11} />
                    Generate Scenario
                  </>
                )}
              </button>

              {genError && (
                <p className="text-xs text-red-400">{genError}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="card p-4 space-y-3">
            <p className="section-label text-[10px]">Expected Scores (GPT-4o-mini)</p>
            {[
              { tier: 'Easy', score: 0.87, color: '#6ee7b7' },
              { tier: 'Medium', score: 0.63, color: '#fbbf24' },
              { tier: 'Hard', score: 0.44, color: '#f87171' },
              { tier: 'Expert', score: 0.28, color: '#c084fc' },
            ].map(({ tier, score, color }) => (
              <div key={tier}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'rgba(204,170,230,0.6)' }}>{tier}</span>
                  <span className="font-mono" style={{ color }}>{score.toFixed(2)}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(204,170,230,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${score * 100}%`, background: color, opacity: 0.7 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}