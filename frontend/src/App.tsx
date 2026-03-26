import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { TaskExplorer } from './components/TaskExplorer';
import { EpisodeViewer } from './components/EpisodeViewer';
import { Leaderboard } from './components/Leaderboard';

type View = 'monitor' | 'tasks' | 'replay' | 'leaderboard';

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: 'monitor', label: 'Live Monitor' },
  { id: 'tasks', label: 'Task Explorer' },
  { id: 'replay', label: 'Episode Replay' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

function ARIALogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Geometric logo mark */}
      <div className="relative w-7 h-7 flex items-center justify-center">
        <svg viewBox="0 0 28 28" className="w-7 h-7">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A788DC" />
              <stop offset="100%" stopColor="#4F1176" />
            </linearGradient>
          </defs>
          <polygon
            points="14,3 25,20 14,17 3,20"
            fill="url(#logoGrad)"
            opacity="0.9"
          />
          <circle cx="14" cy="13" r="2.5" fill="#E2CEF3" opacity="0.8" />
        </svg>
      </div>

      <div>
        <h1
          className="font-display font-medium tracking-[0.25em] text-sm uppercase"
          style={{ color: 'var(--color-lavender)', letterSpacing: '0.3em' }}
        >
          ARIA
        </h1>
        <p
          className="font-body text-[9px] tracking-widest uppercase"
          style={{ color: 'rgba(167,136,220,0.4)', letterSpacing: '0.2em', lineHeight: '1.2', marginTop: '1px' }}
        >
          Regulatory Intelligence
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('monitor');

  return (
    <div className="bg-mesh min-h-screen">
      {/* Top navigation */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          background: 'rgba(14, 8, 24, 0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <ARIALogo />

          {/* Nav links */}
          <div className="flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`nav-link ${view === item.id ? 'active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right side badges */}
          <div className="flex items-center gap-3">
            <span
              className="text-[9px] font-mono tracking-widest uppercase px-2 py-1 rounded-full"
              style={{
                background: 'rgba(150,115,210,0.1)',
                color: 'rgba(167,136,220,0.5)',
                border: '1px solid rgba(150,115,210,0.15)',
              }}
            >
              v1.0.0
            </span>
            <span
              className="text-[9px] font-mono tracking-widest uppercase px-2 py-1 rounded-full"
              style={{
                background: 'rgba(52,211,153,0.08)',
                color: 'rgba(110,231,183,0.6)',
                border: '1px solid rgba(52,211,153,0.15)',
              }}
            >
              OpenEnv ✓
            </span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === 'monitor' && <Dashboard />}
        {view === 'tasks' && <TaskExplorer />}
        {view === 'replay' && <EpisodeViewer />}
        {view === 'leaderboard' && <Leaderboard />}
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-12 py-6"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p
            className="font-body text-xs tracking-wide"
            style={{ color: 'rgba(167,136,220,0.3)' }}
          >
            ARIA — Agentic Regulatory Intelligence Architecture
          </p>
          <div className="flex items-center gap-4">
            <span
              className="text-[10px] font-mono"
              style={{ color: 'rgba(167,136,220,0.25)' }}
            >
              Meta × Hugging Face · OpenEnv Hackathon
            </span>
            <div className="flex gap-2">
              {['GDPR', 'HIPAA', 'CCPA', 'SOC 2'].map((f) => (
                <span
                  key={f}
                  className="text-[9px] font-mono"
                  style={{ color: 'rgba(167,136,220,0.2)' }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}