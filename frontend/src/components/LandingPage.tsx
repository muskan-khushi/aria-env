import { useState, useEffect } from 'react';
import { Activity, ChevronRight, Zap, Shield, Scale, Database, ArrowRight, ExternalLink, Star, TrendingUp } from 'lucide-react';

interface LandingPageProps {
  onEnterDashboard: () => void;
}

const TICKER_ITEMS = [
  'GDPR · Article 33 · 72-hour breach notification',
  'HIPAA · 45 CFR 164.314 · BAA required',
  'CCPA · 1798.135 · Do Not Sell link',
  'SOC2 · CC7 · IRP testing required',
  'GDPR · Article 17 · Right to erasure',
  'HIPAA · 45 CFR 164.502 · Minimum necessary',
  'CCPA · 1798.121 · Sensitive data limits',
  'GDPR · Article 5(1)(b) · Purpose limitation',
];

const STATS = [
  { value: '€2.1B', label: 'GDPR fines in 2023', color: '#DC2626' },
  { value: '$115M', label: 'HIPAA penalties in 2023', color: '#7C3AED' },
  { value: '35B', label: 'Compliance market (USD)', color: '#0891B2' },
  { value: '30%', label: 'Violations missed by manual audits', color: '#D97706' },
];

const TASKS = [
  {
    id: 'easy', label: 'Easy', color: '#059669', bg: '#F0FDF4',
    desc: 'Single-doc GDPR audit', gaps: 3, steps: 15, score: '0.734',
  },
  {
    id: 'medium', label: 'Medium', color: '#D97706', bg: '#FFFBEB',
    desc: 'Cross-doc DPA + Privacy Policy', gaps: 5, steps: 25, score: '0.625',
  },
  {
    id: 'hard', label: 'Hard', color: '#EA580C', bg: '#FFF7ED',
    desc: 'Multi-framework conflicts', gaps: 8, steps: 40, score: '0.627',
  },
  {
    id: 'expert', label: 'Expert', color: '#DC2626', bg: '#FEF2F2',
    desc: 'Live breach + full audit', gaps: 10, steps: 60, score: '0.628',
  },
];

const FRAMEWORKS = [
  { id: 'GDPR', name: 'GDPR', icon: '🇪🇺', desc: '72h breach · Erasure rights · DPO · SCCs', color: '#4F46E5' },
  { id: 'HIPAA', name: 'HIPAA', icon: '🏥', desc: 'PHI safeguards · BAA · Minimum necessary', color: '#DC2626' },
  { id: 'CCPA', name: 'CCPA', icon: '⚖️', desc: 'Opt-out · Do Not Sell · 45-day response', color: '#D97706' },
  { id: 'SOC2', name: 'SOC 2', icon: '🔐', desc: 'Availability SLA · CC7 · Audit logs', color: '#059669' },
];

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [tickerPos, setTickerPos] = useState(0);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 50);
    const interval = setInterval(() => {
      setTickerPos(p => (p + 1) % TICKER_ITEMS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0A1A',
        color: '#E8E0FF',
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* Ambient background glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '60vw', height: '60vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-5%',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(8,145,178,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(109,40,217,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(109,40,217,0.04) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Ticker bar */}
      <div style={{
        position: 'relative', zIndex: 10,
        background: 'rgba(109,40,217,0.15)',
        borderBottom: '1px solid rgba(109,40,217,0.3)',
        padding: '8px 0',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: 64, animation: 'none', whiteSpace: 'nowrap', padding: '0 24px' }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(200,180,255,0.7)', fontFamily: 'monospace' }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>

        {/* Nav */}
        <nav style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 48px', borderBottom: '1px solid rgba(109,40,217,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(124,58,237,0.5)',
            }}>
              <Activity style={{ width: 18, height: 18, color: 'white' }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: '#F0EBFF' }}>ARIA</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(160,130,255,0.7)', textTransform: 'uppercase', lineHeight: 1, marginTop: -1 }}>Compliance v1</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {['Frameworks', 'Tasks', 'API', 'Research'].map(item => (
              <a key={item} href="#" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(200,180,255,0.7)', textDecoration: 'none', letterSpacing: '0.02em', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#C4B5FD')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(200,180,255,0.7)')}
              >{item}</a>
            ))}
            <button
              onClick={onEnterDashboard}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '9px 20px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.02em',
                boxShadow: '0 4px 15px rgba(124,58,237,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(124,58,237,0.4)'; }}
            >
              Open Dashboard <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section style={{ padding: '96px 48px 80px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(109,40,217,0.4)',
            borderRadius: 99, padding: '5px 16px', marginBottom: 32,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#C4B5FD', letterSpacing: '0.08em' }}>
              META × HUGGING FACE OPENENV HACKATHON
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(48px, 7vw, 88px)',
            fontWeight: 900, lineHeight: 1.0,
            letterSpacing: '-3px',
            marginBottom: 28,
            background: 'linear-gradient(135deg, #F0EBFF 0%, #C4B5FD 50%, #A78BFA 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            The RL Environment<br/>for Compliance AI
          </h1>

          <p style={{
            fontSize: 20, lineHeight: 1.7, color: 'rgba(200,180,255,0.75)',
            maxWidth: 640, marginBottom: 48, fontWeight: 400,
          }}>
            ARIA is the first reinforcement learning environment for training agents
            on real-world multi-framework regulatory compliance auditing.
            GDPR · HIPAA · CCPA · SOC 2, simultaneously.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={onEnterDashboard}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                color: 'white', border: 'none', borderRadius: 12,
                padding: '14px 32px', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.01em',
                boxShadow: '0 8px 30px rgba(124,58,237,0.5)',
                transition: 'all 0.25s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,58,237,0.7)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(124,58,237,0.5)'; }}
            >
              <Activity style={{ width: 18, height: 18 }} />
              Launch Live Dashboard
            </button>
            <a
              href="https://huggingface.co/spaces/muskankhushi/aria-compliance-v1"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(109,40,217,0.15)',
                border: '1px solid rgba(109,40,217,0.4)',
                color: '#C4B5FD', borderRadius: 12,
                padding: '14px 28px', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,40,217,0.25)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,40,217,0.15)'; e.currentTarget.style.borderColor = 'rgba(109,40,217,0.4)'; }}
            >
              HuggingFace Space <ExternalLink style={{ width: 14, height: 14 }} />
            </a>
          </div>

          {/* Stats strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1, marginTop: 80,
            background: 'rgba(109,40,217,0.2)',
            border: '1px solid rgba(109,40,217,0.3)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {STATS.map((stat, i) => (
              <div key={i} style={{
                padding: '28px 32px',
                background: i % 2 === 0 ? 'rgba(13,10,26,0.8)' : 'rgba(20,12,36,0.8)',
                borderRight: i < 3 ? '1px solid rgba(109,40,217,0.2)' : 'none',
              }}>
                <div style={{ fontSize: 38, fontWeight: 800, color: stat.color, letterSpacing: '-2px', fontFamily: 'monospace' }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(200,180,255,0.55)', marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* The Problem Section */}
        <section style={{ padding: '80px 48px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(109,40,217,0.15) 0%, rgba(8,145,178,0.1) 100%)',
            border: '1px solid rgba(109,40,217,0.25)',
            borderRadius: 24, padding: '48px 56px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center',
          }}>
            <div>
              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 20, color: '#F0EBFF' }}>
                Why ARIA Exists
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: 'rgba(200,180,255,0.7)', marginBottom: 24 }}>
                Modern enterprises simultaneously operate under GDPR, HIPAA, CCPA, and SOC 2 —
                four frameworks that <strong style={{ color: '#C4B5FD' }}>actively contradict one another</strong>.
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: 'rgba(200,180,255,0.7)', marginBottom: 32 }}>
                GDPR requires 72-hour breach notification. HIPAA allows 60 days.
                GDPR demands opt-in consent. CCPA allows opt-out. Manual audits
                miss 15–30% of violations and can't scale.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Systematically scan novel documents against full regulatory rule sets',
                  'Identify violations where clauses exist but are insufficient',
                  'Detect cross-framework conflicts — where satisfying one law violates another',
                  'Respond to live breach incidents that reshape compliance posture mid-audit',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, background: 'rgba(124,58,237,0.3)',
                      border: '1px solid rgba(124,58,237,0.5)', flexShrink: 0, marginTop: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA' }} />
                    </div>
                    <span style={{ fontSize: 14, color: 'rgba(200,180,255,0.8)', lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'General LLM', items: ['❌ Systematic rule-set scanning', '❌ Insufficient clause detection', '❌ Cross-framework conflicts', '❌ Live incident response'], color: '#DC2626' },
                { label: 'ARIA-trained Agent', items: ['✅ Full regulatory article coverage', '✅ Evidence chain validation', '✅ Conflict escalation & resolution', '✅ Expert-tier incident simulation'], color: '#059669' },
              ].map((col, i) => (
                <div key={i} style={{
                  background: 'rgba(13,10,26,0.6)', border: `1px solid ${col.color}30`,
                  borderRadius: 16, padding: '24px 28px',
                  borderLeft: `3px solid ${col.color}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: col.color, marginBottom: 12, letterSpacing: '0.05em' }}>{col.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {col.items.map((item, j) => (
                      <div key={j} style={{ fontSize: 13, color: 'rgba(200,180,255,0.7)' }}>{item}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Task Tiers */}
        <section style={{ padding: '40px 48px 80px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#A78BFA', textTransform: 'uppercase', marginBottom: 12 }}>Difficulty Progression</div>
            <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.5px', color: '#F0EBFF', marginBottom: 16 }}>5 Task Tiers</h2>
            <p style={{ fontSize: 16, color: 'rgba(200,180,255,0.6)', maxWidth: 560 }}>
              From single-document GDPR audits to live data breach simulations mid-audit.
              Each tier is deterministically graded with a 5-component scoring system.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {TASKS.map((task) => (
              <div
                key={task.id}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                style={{
                  background: hoveredTask === task.id ? `${task.color}15` : 'rgba(20,12,40,0.7)',
                  border: `1px solid ${hoveredTask === task.id ? task.color + '60' : 'rgba(109,40,217,0.25)'}`,
                  borderRadius: 16, padding: '24px',
                  cursor: 'pointer', transition: 'all 0.25s',
                  transform: hoveredTask === task.id ? 'translateY(-4px)' : 'translateY(0)',
                  boxShadow: hoveredTask === task.id ? `0 12px 40px ${task.color}25` : 'none',
                }}
              >
                <div style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 99,
                  background: `${task.color}20`, border: `1px solid ${task.color}50`,
                  fontSize: 11, fontWeight: 700, color: task.color, letterSpacing: '0.08em',
                  textTransform: 'uppercase', marginBottom: 16,
                }}>
                  {task.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F0EBFF', marginBottom: 8 }}>{task.desc}</div>
                <div style={{ fontSize: 13, color: 'rgba(200,180,255,0.5)', marginBottom: 20 }}>
                  {task.gaps} gaps · {task.steps} steps max
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(200,180,255,0.4)', marginBottom: 2 }}>Baseline Score</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: task.color, fontFamily: 'monospace' }}>{task.score}</div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${task.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp style={{ width: 18, height: 18, color: task.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Blind task + Expert callout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: 16, padding: '24px 28px',
              display: 'flex', gap: 20, alignItems: 'center',
            }}>
              <div style={{ fontSize: 32 }}>🟣</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#C4B5FD', marginBottom: 4 }}>Blind Generalisation Task</div>
                <div style={{ fontSize: 13, color: 'rgba(200,180,255,0.6)' }}>
                  Paraphrased policy language — no trigger phrase matching.
                  Tests genuine regulatory reasoning. LLM fallback required. Score ~0.36.
                </div>
              </div>
            </div>
            <div style={{
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 16, padding: '24px 28px',
              display: 'flex', gap: 20, alignItems: 'center',
            }}>
              <div style={{ fontSize: 32 }}>🚨</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#FCA5A5', marginBottom: 4 }}>Expert: Live Breach at Step 25</div>
                <div style={{ fontSize: 13, color: 'rgba(255,160,160,0.6)' }}>
                  Mid-audit data breach fires. Agent must contain, document,
                  engage DPO, notify DPA within 8 steps. −0.25/step penalty for delay.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Frameworks Grid */}
        <section style={{ padding: '40px 48px 80px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#A78BFA', textTransform: 'uppercase', marginBottom: 12 }}>Regulatory Coverage</div>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.5px', color: '#F0EBFF', marginBottom: 48 }}>4 Frameworks, 1 Environment</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {FRAMEWORKS.map((fw) => (
              <div key={fw.id} style={{
                background: 'rgba(20,12,40,0.7)',
                border: '1px solid rgba(109,40,217,0.25)',
                borderRadius: 16, padding: '28px',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{fw.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#F0EBFF', marginBottom: 8 }}>{fw.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(200,180,255,0.5)', lineHeight: 1.8, fontFamily: 'monospace' }}>{fw.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Reward Architecture */}
        <section style={{ padding: '40px 48px 80px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            background: 'rgba(20,12,40,0.8)', border: '1px solid rgba(109,40,217,0.3)',
            borderRadius: 24, padding: '48px 56px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#A78BFA', textTransform: 'uppercase', marginBottom: 12 }}>Anti-Gaming v2</div>
                <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: '#F0EBFF', marginBottom: 20 }}>Dense Reward Architecture</h2>
                <p style={{ fontSize: 15, color: 'rgba(200,180,255,0.65)', lineHeight: 1.8, marginBottom: 24 }}>
                  18 distinct reward triggers with anti-gaming mechanisms that close known exploits.
                  Agents can't spam, copy-paste sections, or escalate empty conflicts for credit.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { attack: 'Spam every gap type', defense: 'Global FP budget: 5th+ FP costs −0.20' },
                    { attack: 'Copy full section as evidence', defense: 'Verbosity cap: passage > 70% section → 0.08 max' },
                    { attack: 'Flag everything, retract later', defense: 'Retract true finding costs −0.08' },
                    { attack: 'Empty conflict descriptions', defense: 'Description quality = 40% of conflict score' },
                    { attack: 'Early quit for efficiency bonus', defense: 'Bonus = tp/max_steps (coverage, not speed)' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.2)',
                      borderRadius: 10, padding: '12px 16px',
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                    }}>
                      <div style={{ fontSize: 12, color: '#FCA5A5' }}>⚠ {item.attack}</div>
                      <div style={{ fontSize: 12, color: '#86EFAC' }}>✓ {item.defense}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#A78BFA', textTransform: 'uppercase', marginBottom: 12 }}>Terminal Grader</div>
                <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: '#F0EBFF', marginBottom: 20 }}>5-Component Score</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Gap Detection F1', weight: 40, color: '#7C3AED' },
                    { label: 'Evidence Quality', weight: 25, color: '#0891B2' },
                    { label: 'Remediation Quality', weight: 20, color: '#059669' },
                    { label: 'Severity Accuracy', weight: 10, color: '#D97706' },
                    { label: 'Conflict Detection', weight: 5, color: '#DC2626' },
                  ].map((component) => (
                    <div key={component.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: 'rgba(200,180,255,0.8)', fontWeight: 500 }}>{component.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: component.color, fontFamily: 'monospace' }}>{component.weight}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(109,40,217,0.2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          width: `${component.weight * 2.5}%`,
                          height: '100%', borderRadius: 99,
                          background: `linear-gradient(90deg, ${component.color}, ${component.color}99)`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 28, background: 'rgba(109,40,217,0.15)',
                  border: '1px solid rgba(109,40,217,0.3)', borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(200,180,255,0.5)', marginBottom: 8, letterSpacing: '0.08em' }}>BASELINE (Qwen 2.5 7B MultiPass v8)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[['Easy', '0.734'], ['Medium', '0.625'], ['Hard', '0.627'], ['Expert', '0.628']].map(([t, s]) => (
                      <div key={t} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#A78BFA', fontFamily: 'monospace' }}>{s}</div>
                        <div style={{ fontSize: 10, color: 'rgba(200,180,255,0.4)', marginTop: 2 }}>{t}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* OpenEnv Compliance */}
        <section style={{ padding: '40px 48px 80px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#A78BFA', textTransform: 'uppercase', marginBottom: 12 }}>OpenEnv Spec</div>
              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: '#F0EBFF', marginBottom: 20 }}>Fully Compliant</h2>
              <p style={{ fontSize: 15, color: 'rgba(200,180,255,0.6)', lineHeight: 1.8 }}>
                All required endpoints, typed Pydantic v2 models, YAML manifest, Docker build, and baseline inference script.
              </p>
              <div style={{
                marginTop: 24, background: 'rgba(5,150,105,0.1)',
                border: '1px solid rgba(5,150,105,0.3)', borderRadius: 12, padding: '16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: 13, color: '#6EE7B7', fontWeight: 600 }}>openenv validate ✓ passing</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['POST /reset', 'Initialize episode'],
                ['POST /step', 'Submit agent action'],
                ['GET /state', 'Current observation'],
                ['GET /tasks', 'Task list + schema'],
                ['POST /grader', 'Deterministic scoring'],
                ['POST /baseline', 'Cached scores'],
                ['WebSocket /aria/ws/{id}', 'Real-time stream'],
                ['GET /health', '200 OK always'],
              ].map(([endpoint, desc]) => (
                <div key={endpoint} style={{
                  background: 'rgba(20,12,40,0.8)',
                  border: '1px solid rgba(109,40,217,0.2)',
                  borderRadius: 10, padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#A78BFA', marginBottom: 4 }}>{endpoint}</div>
                  <div style={{ fontSize: 11, color: 'rgba(200,180,255,0.45)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 48px 96px', maxWidth: 1280, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(109,40,217,0.25) 0%, rgba(8,145,178,0.15) 100%)',
            border: '1px solid rgba(109,40,217,0.4)',
            borderRadius: 24, padding: '64px 48px',
          }}>
            <h2 style={{
              fontSize: 52, fontWeight: 900, letterSpacing: '-2px',
              background: 'linear-gradient(135deg, #F0EBFF, #A78BFA)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', marginBottom: 20,
            }}>
              Ready to Train Compliance Agents?
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(200,180,255,0.65)', marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
              ARIA is live. Watch an agent conduct a real compliance audit end-to-end in the interactive dashboard.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={onEnterDashboard}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                  color: 'white', border: 'none', borderRadius: 12,
                  padding: '16px 36px', fontSize: 17, fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 30px rgba(124,58,237,0.5)',
                  transition: 'all 0.25s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,58,237,0.7)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(124,58,237,0.5)'; }}
              >
                <Activity style={{ width: 20, height: 20 }} />
                Launch Dashboard
              </button>
              <a
                href="https://github.com/muskan-khushi/aria-env"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#E8E0FF', borderRadius: 12,
                  padding: '16px 28px', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                View on GitHub <ExternalLink style={{ width: 14, height: 14 }} />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid rgba(109,40,217,0.2)',
          padding: '32px 48px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity style={{ width: 16, height: 16, color: '#7C3AED' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(200,180,255,0.6)' }}>ARIA Compliance v1.0.0</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(200,180,255,0.35)' }}>
            Built for Meta × Hugging Face OpenEnv Hackathon · MIT License
          </div>
        </footer>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}