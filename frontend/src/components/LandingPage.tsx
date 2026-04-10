import { useState, useEffect, useRef } from 'react';
import { Activity, Zap, Shield, ExternalLink, TrendingUp, CheckCircle2, AlertCircle, Sparkles, ArrowRight, Star } from 'lucide-react';

interface LandingPageProps {
  onEnterDashboard: () => void;
}

const FRAMEWORKS = [
  { id: 'GDPR', icon: '🇪🇺', desc: '72h breach · Erasure rights · DPO · SCCs', color: '#8B5CF6', bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', border: '#C4B5FD' },
  { id: 'HIPAA', icon: '🏥', desc: 'PHI safeguards · BAA · Minimum necessary', color: '#EC4899', bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', border: '#F9A8D4' },
  { id: 'CCPA', icon: '⚖️', desc: 'Opt-out · Do Not Sell · 45-day response', color: '#F59E0B', bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', border: '#FCD34D' },
  { id: 'SOC2', icon: '🔐', desc: 'Availability SLA · CC7 · Audit logs', color: '#10B981', bg: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', border: '#6EE7B7' },
];

const TASKS = [
  { id: 'easy', label: 'Easy', emoji: '🌱', color: '#10B981', pastel: '#D1FAE5', border: '#6EE7B7', desc: 'Single-doc GDPR consistency audit', gaps: 3, steps: 15, score: '0.734' },
  { id: 'medium', label: 'Medium', emoji: '🌸', color: '#8B5CF6', pastel: '#EDE9FE', border: '#C4B5FD', desc: 'Cross-doc DPA + Privacy Policy', gaps: 5, steps: 25, score: '0.625' },
  { id: 'hard', label: 'Hard', emoji: '🔥', color: '#F97316', pastel: '#FFEDD5', border: '#FED7AA', desc: 'Multi-framework conflict resolution', gaps: 8, steps: 40, score: '0.627' },
  { id: 'expert', label: 'Expert', emoji: '⚡', color: '#EC4899', pastel: '#FCE7F3', border: '#F9A8D4', desc: 'Live breach incident mid-audit', gaps: 10, steps: 60, score: '0.628' },
];

const ANTI_GAMING = [
  { attack: 'Spam every gap type', defense: 'Global FP budget: 5th+ FP costs −0.20', attackColor: '#EC4899', defenseColor: '#10B981' },
  { attack: 'Copy full section as evidence', defense: 'Verbosity cap: passage > 70% section → 0.08 max', attackColor: '#F97316', defenseColor: '#8B5CF6' },
  { attack: 'Flag everything, retract later', defense: 'Retract true finding costs −0.08', attackColor: '#EF4444', defenseColor: '#0EA5E9' },
  { attack: 'Empty conflict descriptions', defense: 'Description quality = 40% of conflict score', attackColor: '#DC2626', defenseColor: '#10B981' },
];

const SCORE_COMPONENTS = [
  { label: 'Gap Detection F1', weight: 40, color: '#8B5CF6', light: '#EDE9FE' },
  { label: 'Evidence Quality', weight: 25, color: '#EC4899', light: '#FCE7F3' },
  { label: 'Remediation Quality', weight: 20, color: '#10B981', light: '#D1FAE5' },
  { label: 'Severity Accuracy', weight: 10, color: '#F59E0B', light: '#FEF3C7' },
  { label: 'Conflict Detection', weight: 5, color: '#0EA5E9', light: '#E0F2FE' },
];

// const TICKER_ITEMS = [
//   '✦ GDPR · Article 17 · Right to erasure',
//   '✦ HIPAA · 45 CFR 164.502 · Minimum necessary',
//   '✦ CCPA · 1798.121 · Sensitive data limits',
//   '✦ GDPR · Article 5(1)(b) · Purpose limitation',
//   '✦ SOC 2 · CC6.1 · Logical access security',
//   '✦ ISO 27001 · A.8.1.1 · Asset inventory',
// ];

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 80);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF7FF',
      color: '#1a0a2e',
      fontFamily: "'Instrument Serif', 'Georgia', serif",
      overflowX: 'hidden',
    }}>

      {/* ══════════ GLOBAL STYLES ══════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,500;12..96,700;12..96,800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --lavender-50: #FAF7FF;
          --lavender-100: #F3EEFF;
          --lavender-200: #E9DFFE;
          --lavender-300: #D4BBFD;
          --lavender-400: #B794FA;
          --lavender-500: #9561F4;
          --lavender-600: #7C3AED;
          --lavender-700: #6D28D9;
          --lavender-800: #5B21B6;
          --lavender-900: #3B0764;
          --pink-soft: #FCE7F3;
          --peach-soft: #FFEDD5;
          --mint-soft: #D1FAE5;
          --sky-soft: #E0F2FE;
          --butter-soft: #FEF3C7;
          --rose-soft: #FFE4E6;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--lavender-50);
        }

        // /* Ticker animation */
        // @keyframes ticker {
        //   0% { transform: translateX(0); }
        //   100% { transform: translateX(-50%); }
        // }

        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-18px) rotate(1.5deg); }
          66% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-24px) rotate(-2deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          40% { transform: translateY(-12px) rotate(2.5deg); }
          80% { transform: translateY(-20px) rotate(-1.5deg); }
        }
        @keyframes bloom {
          0% { opacity: 0; transform: scale(0.6) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0px); }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(60px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .bloom-in { animation: bloom 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .slide-up { animation: slideUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

        .grotesque { font-family: 'Bricolage Grotesque', 'DM Sans', sans-serif; }
        .serif { font-family: 'Instrument Serif', Georgia, serif; }

        .glass-card {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.9);
        }

        .petal-card {
          background: white;
          border-radius: 28px;
          border: 1.5px solid rgba(214, 188, 255, 0.4);
          box-shadow: 0 8px 40px -8px rgba(109, 40, 217, 0.08), 0 2px 8px -2px rgba(109, 40, 217, 0.04);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .petal-card:hover {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 24px 60px -12px rgba(109, 40, 217, 0.16), 0 8px 20px -4px rgba(109, 40, 217, 0.08);
          border-color: rgba(167, 139, 250, 0.6);
        }

        .cta-btn {
          font-family: 'Bricolage Grotesque', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #9561F4, #7C3AED, #6D28D9);
          color: white;
          border: none;
          border-radius: 100px;
          padding: 16px 36px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 8px 32px -4px rgba(109, 40, 217, 0.5), inset 0 1px 0 rgba(255,255,255,0.2);
          animation: pulse-ring 2.5s infinite;
          letter-spacing: 0.02em;
          text-decoration: none;
        }
        .cta-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent 50%, rgba(255,255,255,0.05));
          transition: opacity 0.3s;
        }
        .cta-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 16px 48px -8px rgba(109, 40, 217, 0.6);
        }
        .cta-btn-ghost {
          font-family: 'Bricolage Grotesque', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: white;
          color: #6D28D9;
          border: 2px solid rgba(167, 139, 250, 0.5);
          border-radius: 100px;
          padding: 14px 32px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          letter-spacing: 0.02em;
        }
        .cta-btn-ghost:hover {
          background: var(--lavender-100);
          border-color: #8B5CF6;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -4px rgba(109, 40, 217, 0.15);
        }

        .nav-link {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #5B4E7A;
          text-decoration: none;
          letter-spacing: 0.02em;
          transition: color 0.2s;
          position: relative;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #9561F4, #EC4899);
          border-radius: 2px;
          transition: width 0.3s;
        }
        .nav-link:hover { color: #6D28D9; }
        .nav-link:hover::after { width: 100%; }

        .orb {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
          z-index: 0;
        }

        .stat-pill {
          font-family: 'Bricolage Grotesque', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
        }

        .section-eyebrow {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8B5CF6;
          margin-bottom: 12px;
        }

        .section-title {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: clamp(32px, 4vw, 48px);
          font-weight: 800;
          letter-spacing: -1.5px;
          line-height: 1.1;
          color: #1a0a2e;
        }
      `}</style>

      {/* ══════════ AMBIENT ORBS ══════════ */}
      <div className="orb" style={{ top: '-15%', left: '-8%', width: '55vw', height: '55vw', background: 'radial-gradient(circle, rgba(196,165,253,0.35) 0%, transparent 65%)' }} />
      <div className="orb" style={{ top: '30%', right: '-10%', width: '45vw', height: '45vw', background: 'radial-gradient(circle, rgba(249,168,212,0.25) 0%, transparent 65%)' }} />
      <div className="orb" style={{ bottom: '0%', left: '30%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(167,243,208,0.2) 0%, transparent 65%)' }} />
      <div className="orb" style={{ top: '60%', left: '0%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(253,230,138,0.2) 0%, transparent 65%)' }} />

      {/* ══════════ BACKGROUND NOISE/TEXTURE ══════════ */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.04, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundSize: '200px 200px' }} />

      {/* ══════════ DOT GRID ══════════ */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(167, 139, 250, 0.2) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.6 }} />

      <div style={{ position: 'relative', zIndex: 10 }}>

        {/* ══════════ TICKER ══════════
        <div style={{ background: 'linear-gradient(90deg, #7C3AED, #9561F4, #A855F7, #7C3AED)', padding: '10px 0', overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 0, animation: 'ticker 30s linear infinite', whiteSpace: 'nowrap' }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="grotesque" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.9)', padding: '0 32px' }}>
                {item}
              </span>
            ))}
          </div>
        </div> */}

        {/* ══════════ NAV ══════════ */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 40px',
          background: 'rgba(250, 247, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(196, 181, 253, 0.25)',
          boxShadow: '0 1px 0 rgba(196, 181, 253, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div style={{
              width: 38, height: 38,
              background: 'linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 50%, #6D28D9 100%)',
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(109, 40, 217, 0.35)',
            }}>
              <Activity style={{ width: 20, height: 20, color: 'white' }} />
            </div>
            <div>
              <div className="grotesque" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: '#3B0764', lineHeight: 1 }}>ARIA</div>
              <div className="grotesque" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#9561F4', textTransform: 'uppercase', lineHeight: 1, marginTop: 3 }}>Compliance Intelligence</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {[['Why ARIA', 'problem'], ['Task Tiers', 'tasks'], ['Frameworks', 'frameworks'], ['Architecture', 'architecture']].map(([label, id]) => (
              <a key={id} href={`#${id}`} className="nav-link" onClick={(e) => handleNavClick(e, id)}>{label}</a>
            ))}
          </div>
          <button className="cta-btn" onClick={onEnterDashboard} style={{ padding: '10px 24px', fontSize: 14, animation: 'none', boxShadow: '0 4px 16px -2px rgba(109, 40, 217, 0.4)' }}>
            <Zap style={{ width: 15, height: 15 }} /> Open Dashboard
          </button>
        </nav>

        {/* ══════════ HERO ══════════ */}
        <section ref={heroRef} style={{ padding: '80px 48px 60px', maxWidth: 1360, margin: '0 auto', textAlign: 'center', opacity: animateIn ? 1 : 0, transition: 'opacity 1s ease' }}>

          {/* Floating pastel blobs behind hero */}
          <div style={{ position: 'absolute', left: '8%', top: '180px', width: 220, height: 220, borderRadius: '60% 40% 70% 30% / 50% 60% 40% 60%', background: 'linear-gradient(135deg, #DDD6FE, #C4B5FD)', opacity: 0.6, animation: 'float1 7s ease-in-out infinite', zIndex: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: '6%', top: '220px', width: 180, height: 180, borderRadius: '40% 60% 30% 70% / 60% 40% 70% 30%', background: 'linear-gradient(135deg, #FBCFE8, #F9A8D4)', opacity: 0.55, animation: 'float2 9s ease-in-out infinite', zIndex: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: '20%', top: '400px', width: 110, height: 110, borderRadius: '70% 30% 50% 50% / 40% 60% 40% 60%', background: 'linear-gradient(135deg, #A7F3D0, #6EE7B7)', opacity: 0.5, animation: 'float3 8s ease-in-out infinite', zIndex: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: '18%', top: '350px', width: 130, height: 130, borderRadius: '50% 50% 30% 70% / 70% 30% 60% 40%', background: 'linear-gradient(135deg, #FDE68A, #FCD34D)', opacity: 0.45, animation: 'float1 10s ease-in-out infinite reverse', zIndex: 1, pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #EDE9FE, #FCE7F3)',
              border: '1.5px solid rgba(196, 181, 253, 0.7)',
              borderRadius: 100, padding: '8px 20px', marginBottom: 36,
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.12)',
            }}>
              <Sparkles style={{ width: 14, height: 14, color: '#8B5CF6' }} />
              <span className="grotesque" style={{ fontSize: 12, fontWeight: 800, color: '#6D28D9', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                OpenEnv · Multi-Framework · RL Environment
              </span>
              <Star style={{ width: 12, height: 12, color: '#EC4899', fill: '#EC4899' }} />
            </div>

            <h1 style={{
              fontSize: 'clamp(56px, 7vw, 92px)',
              fontWeight: 400,
              lineHeight: 1.06,
              letterSpacing: '-3px',
              color: '#1a0a2e',
              marginBottom: 28,
              fontFamily: 'Instrument Serif, Georgia, serif',
            }}>
              The RL Environment<br />
              <span style={{
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 40%, #EC4899 75%, #F97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% auto',
                animation: 'shimmer 4s linear infinite',
              }}>
                for Compliance AI
              </span>
            </h1>

            <p className="grotesque" style={{ fontSize: 20, lineHeight: 1.65, color: '#5B4E7A', maxWidth: 680, margin: '0 auto 20px', fontWeight: 400 }}>
              Train agents to master GDPR, HIPAA, CCPA, and SOC 2 — simultaneously.
              With evidence-chain validation, cross-framework conflict detection, and live incident response.
            </p>
            <p className="grotesque" style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 52, fontWeight: 500, letterSpacing: '0.02em' }}>
              <strong style={{ color: '#7C3AED' }}></strong> Compliance auditing is a <strong style={{ color: '#EC4899' }}>$35B market</strong>
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 80 }}>
              <button className="cta-btn" onClick={onEnterDashboard} style={{ fontSize: 17, padding: '18px 40px' }}>
                <Activity style={{ width: 20, height: 20 }} />
                Launch Live Dashboard
              </button>
              <a className="cta-btn-ghost" href="https://huggingface.co/spaces/muskankhushi/aria-compliance-v1" target="_blank" rel="noopener noreferrer" style={{ fontSize: 17, padding: '16px 36px' }}>
                HuggingFace Space <ExternalLink style={{ width: 16, height: 16 }} />
              </a>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
              {[
                { val: '€2.1B', label: 'GDPR fines in 2023', color: '#8B5CF6', bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', border: '#C4B5FD', icon: '⚖️' },
                { val: '$115M', label: 'HIPAA penalties in 2023', color: '#EC4899', bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', border: '#F9A8D4', icon: '🏥' },
                { val: '$35B', label: 'Compliance market size', color: '#F59E0B', bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', border: '#FCD34D', icon: '💰' },
                { val: '30%', label: 'Violations missed manually', color: '#10B981', bg: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', border: '#6EE7B7', icon: '🎯' },
              ].map((s, i) => (
                <div key={i} className="petal-card" style={{ padding: '28px 24px', textAlign: 'left', background: 'white', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: s.bg, borderRadius: '0 28px 0 100%', opacity: 0.7 }} />
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
                  <div className="grotesque" style={{ fontSize: 38, fontWeight: 800, color: s.color, letterSpacing: '-1.5px', lineHeight: 1 }}>{s.val}</div>
                  <div className="grotesque" style={{ fontSize: 13, color: '#6B7280', marginTop: 6, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ THE PROBLEM ══════════ */}
        <section id="problem" style={{ padding: '80px 48px', maxWidth: 1360, margin: '0 auto', scrollMarginTop: '80px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #FAF7FF 0%, #F3EEFF 40%, #FDF2FF 100%)',
            border: '1.5px solid rgba(196, 181, 253, 0.35)',
            borderRadius: 48,
            padding: '72px 64px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 72,
            alignItems: 'center',
            boxShadow: '0 32px 80px -20px rgba(109, 40, 217, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative corner bloom */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,212,0.3), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,243,208,0.3), transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              <div className="section-eyebrow">✦ The Challenge</div>
              <h2 className="section-title" style={{ marginBottom: 24 }}>
                Why ARIA<br />
                <span style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, color: '#8B5CF6' }}>Exists</span>
              </h2>
              <p className="grotesque" style={{ fontSize: 17, lineHeight: 1.7, color: '#5B4E7A', marginBottom: 20 }}>
                Modern enterprises simultaneously operate under GDPR, HIPAA, CCPA, and SOC 2 —
                four frameworks that <strong style={{ color: '#7C3AED' }}>actively contradict one another</strong>.
              </p>
              <p className="grotesque" style={{ fontSize: 16, lineHeight: 1.7, color: '#7C6E9C', marginBottom: 36 }}>
                GDPR demands 72-hour breach notification. HIPAA allows 60 days.
                GDPR requires opt-in. CCPA allows opt-out. Manual audits miss 15–30% of violations and can't scale.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { text: 'Systematically scan novel documents against full rule sets', color: '#8B5CF6', bg: '#EDE9FE' },
                  { text: 'Identify violations where clauses exist but are insufficient', color: '#EC4899', bg: '#FCE7F3' },
                  { text: 'Detect cross-framework conflicts — where satisfying one law violates another', color: '#10B981', bg: '#D1FAE5' },
                  { text: 'Respond to live breach incidents that reshape compliance posture', color: '#F59E0B', bg: '#FEF3C7' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${item.color}30` }}>
                      <CheckCircle2 style={{ width: 15, height: 15, color: item.color }} />
                    </div>
                    <span className="grotesque" style={{ fontSize: 15, color: '#3B2F5E', lineHeight: 1.55, fontWeight: 500, paddingTop: 4 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
              {[
                {
                  label: 'General LLM Approach', emoji: '😓',
                  items: ['Misses systematic rule-set scanning', 'Can\'t detect insufficient clauses', 'No cross-framework conflict model', 'No live incident response'],
                  bg: 'linear-gradient(135deg, #FFF0F3, #FFE4E8)',
                  border: '#FECDD3', titleColor: '#BE123C', dotColor: '#FB7185',
                },
                {
                  label: 'ARIA-Trained Agent', emoji: '✨',
                  items: ['Full regulatory article coverage', 'Evidence chain validation', 'Conflict escalation & resolution', 'Expert-tier incident simulation'],
                  bg: 'linear-gradient(135deg, #F0FDF4, #D1FAE5)',
                  border: '#86EFAC', titleColor: '#065F46', dotColor: '#34D399',
                },
              ].map((col, i) => (
                <div key={i} style={{ background: col.bg, border: `1.5px solid ${col.border}`, borderRadius: 24, padding: '32px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 24 }}>{col.emoji}</span>
                    <span className="grotesque" style={{ fontSize: 16, fontWeight: 800, color: col.titleColor }}>{col.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {col.items.map((item, j) => (
                      <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.dotColor, flexShrink: 0 }} />
                        <span className="grotesque" style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ TASK TIERS ══════════ */}
        <section id="tasks" style={{ padding: '60px 48px', maxWidth: 1360, margin: '0 auto', scrollMarginTop: '80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="section-eyebrow">✦ Difficulty Progression</div>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Four Task Tiers</h2>
            <p className="grotesque" style={{ fontSize: 18, color: '#7C6E9C', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
              From single-document GDPR audits to live breach simulations mid-audit.
              Each tier is deterministically graded with five score components.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 24 }}>
            {TASKS.map((task) => (
              <div key={task.id} className="petal-card"
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                style={{
                  padding: '36px 28px',
                  cursor: 'default',
                  background: hoveredTask === task.id ? `linear-gradient(160deg, white, ${task.pastel}80)` : 'white',
                  borderColor: hoveredTask === task.id ? task.border : 'rgba(214, 188, 255, 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                {/* Top color stripe */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${task.color}80, ${task.color})`, borderRadius: '28px 28px 0 0' }} />

                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: task.pastel, border: `1px solid ${task.border}`,
                  borderRadius: 100, padding: '5px 12px', marginBottom: 20,
                }}>
                  <span style={{ fontSize: 14 }}>{task.emoji}</span>
                  <span className="grotesque" style={{ fontSize: 11, fontWeight: 800, color: task.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{task.label}</span>
                </div>

                <div className="grotesque" style={{ fontSize: 16, fontWeight: 700, color: '#1a0a2e', marginBottom: 10, lineHeight: 1.4 }}>{task.desc}</div>
                <div className="grotesque" style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 28, fontWeight: 500 }}>
                  {task.gaps} compliance gaps · {task.steps} max steps
                </div>

                <div style={{ borderTop: `1px dashed ${task.border}`, paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="grotesque" style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Baseline</div>
                    <div className="grotesque" style={{ fontSize: 34, fontWeight: 800, color: task.color, letterSpacing: '-1px', lineHeight: 1 }}>{task.score}</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: task.pastel, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${task.border}` }}>
                    <TrendingUp style={{ width: 20, height: 20, color: task.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Expert callouts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="petal-card" style={{ padding: '32px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{ width: 56, height: 56, borderRadius: 20, background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid #C4B5FD' }}>
                <Shield style={{ color: '#7C3AED', width: 26, height: 26 }} />
              </div>
              <div>
                <div className="grotesque" style={{ fontSize: 16, fontWeight: 800, color: '#3B0764', marginBottom: 8 }}>🕶️ Blind Generalisation Task</div>
                <div className="grotesque" style={{ fontSize: 14, color: '#7C6E9C', lineHeight: 1.6 }}>Paraphrased policy language — no trigger phrase matching. Tests genuine regulatory reasoning, not memorization. Baseline score ~0.36.</div>
              </div>
            </div>
            <div className="petal-card" style={{ padding: '32px', display: 'flex', gap: 24, alignItems: 'flex-start', background: 'linear-gradient(135deg, white, #FFF0F3)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 20, background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid #F9A8D4' }}>
                <AlertCircle style={{ color: '#EC4899', width: 26, height: 26 }} />
              </div>
              <div>
                <div className="grotesque" style={{ fontSize: 16, fontWeight: 800, color: '#831843', marginBottom: 8 }}>⚡ Expert: Live Breach at Step 25</div>
                <div className="grotesque" style={{ fontSize: 14, color: '#9D174D', lineHeight: 1.6 }}>Mid-audit data breach fires. Agent must contain, document, engage DPO, notify supervisory authority within 8 steps or face −0.25/step decay.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ FRAMEWORKS ══════════ */}
        <section id="frameworks" style={{ padding: '80px 48px', maxWidth: 1360, margin: '0 auto', scrollMarginTop: '80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="section-eyebrow">✦ Regulatory Coverage</div>
            <h2 className="section-title" style={{ marginBottom: 16 }}>
              4 Frameworks,{' '}
              <span style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, color: '#EC4899' }}>1 Environment</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {FRAMEWORKS.map((fw) => (
              <div key={fw.id} className="petal-card" style={{ padding: '44px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 20, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))', lineHeight: 1 }}>{fw.icon}</div>
                <div className="grotesque" style={{ fontSize: 22, fontWeight: 800, color: fw.color, marginBottom: 12, letterSpacing: '-0.5px' }}>{fw.id}</div>
                <div className="grotesque" style={{ fontSize: 14, color: '#5B4E7A', lineHeight: 1.65, fontWeight: 500 }}>{fw.desc}</div>
                <div style={{ marginTop: 24, height: 4, borderRadius: 100, background: `${fw.bg}` }} />
              </div>
            ))}
          </div>
        </section>

        {/* ══════════ ARCHITECTURE ══════════ */}
        <section id="architecture" style={{ padding: '80px 48px', maxWidth: 1360, margin: '0 auto', scrollMarginTop: '80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
            {/* Anti-Gaming */}
            <div>
              <div className="section-eyebrow">✦ Anti-Gaming v2</div>
              <h2 className="section-title" style={{ marginBottom: 16 }}>Dense Reward<br /><span style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, color: '#8B5CF6' }}>Architecture</span></h2>
              <p className="grotesque" style={{ fontSize: 16, color: '#7C6E9C', lineHeight: 1.7, marginBottom: 36 }}>
                18 distinct reward triggers with anti-gaming mechanisms that close known exploits. Every attempt to game the system is met with a specific counter-measure.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {ANTI_GAMING.map((item, i) => (
                  <div key={i} style={{
                    background: 'white',
                    border: '1.5px solid rgba(196, 181, 253, 0.3)',
                    borderRadius: 20, padding: '20px 24px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
                    boxShadow: '0 4px 16px -4px rgba(109, 40, 217, 0.06)',
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196, 181, 253, 0.6)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196, 181, 253, 0.3)'; }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14 }}>💀</span>
                      <span className="grotesque" style={{ fontSize: 13, color: item.attackColor, fontWeight: 600, lineHeight: 1.4 }}>{item.attack}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14 }}>🛡️</span>
                      <span className="grotesque" style={{ fontSize: 13, color: item.defenseColor, fontWeight: 600, lineHeight: 1.4 }}>{item.defense}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="petal-card" style={{ padding: '48px 40px', background: 'linear-gradient(160deg, white 60%, #FAF7FF)' }}>
              <div className="section-eyebrow">✦ Terminal Grader</div>
              <h2 className="grotesque" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a0a2e', marginBottom: 8 }}>5-Component Score</h2>
              <p className="grotesque" style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 36, fontWeight: 500 }}>Deterministic · Identical inputs = identical output</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {SCORE_COMPONENTS.map((c) => (
                  <div key={c.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span className="grotesque" style={{ fontSize: 14, color: '#374151', fontWeight: 700 }}>{c.label}</span>
                      <span className="grotesque" style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.weight}%</span>
                    </div>
                    <div style={{ height: 10, background: c.light, borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{ width: `${c.weight * 2.5}%`, height: '100%', borderRadius: 100, background: `linear-gradient(90deg, ${c.color}80, ${c.color})`, transition: 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 40, padding: '28px', background: 'linear-gradient(135deg, #FAF7FF, #F3EEFF)', borderRadius: 20, border: '1.5px solid rgba(196, 181, 253, 0.4)' }}>
                <div className="grotesque" style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Baseline · Qwen 2.5 7B MultiPass v8
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[['Easy', '0.734', '#10B981', '#D1FAE5'], ['Medium', '0.625', '#8B5CF6', '#EDE9FE'], ['Hard', '0.627', '#F97316', '#FFEDD5'], ['Expert', '0.628', '#EC4899', '#FCE7F3']].map(([t, s, c, bg]) => (
                    <div key={t} style={{ textAlign: 'center', background: bg, borderRadius: 14, padding: '14px 8px' }}>
                      <div className="grotesque" style={{ fontSize: 22, fontWeight: 800, color: c, letterSpacing: '-0.5px' }}>{s}</div>
                      <div className="grotesque" style={{ fontSize: 12, color: c, marginTop: 4, fontWeight: 700, opacity: 0.7 }}>{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ CTA ══════════ */}
        <section style={{ padding: '40px 48px 100px', maxWidth: 1360, margin: '0 auto' }}>
          <div style={{
            borderRadius: 48,
            padding: '96px 64px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #F3E8FF 0%, #EDE9FE 30%, #F0FDF4 60%, #FCE7F3 100%)',
            border: '1.5px solid rgba(196, 181, 253, 0.5)',
            boxShadow: '0 40px 100px -20px rgba(109, 40, 217, 0.12)',
          }}>
            {/* Decorative blobs */}
            <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,165,253,0.4), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,212,0.35), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '40%', right: '15%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,243,208,0.35), transparent 70%)', pointerEvents: 'none' }} />

            {/* Spinning decorative ring */}
            <div style={{ position: 'absolute', top: 40, right: 100, width: 100, height: 100, border: '2px dashed rgba(196, 181, 253, 0.5)', borderRadius: '50%', animation: 'spin-slow 20s linear infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 60, left: 120, width: 70, height: 70, border: '2px dashed rgba(249,168,212, 0.5)', borderRadius: '50%', animation: 'spin-slow 15s linear infinite reverse', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid rgba(196, 181, 253, 0.5)', borderRadius: 100, padding: '8px 18px', marginBottom: 28 }}>
                <span style={{ fontSize: 14 }}>🚀</span>
                <span className="grotesque" style={{ fontSize: 12, fontWeight: 800, color: '#6D28D9', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live on HuggingFace Spaces</span>
              </div>

              <h2 style={{ fontFamily: 'Instrument Serif', fontWeight: 400, fontSize: 'clamp(44px, 5vw, 68px)', letterSpacing: '-2px', color: '#3B0764', marginBottom: 20, lineHeight: 1.1 }}>
                Ready to Train<br />
                <span style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, #7C3AED, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Compliance Agents?</span>
              </h2>
              <p className="grotesque" style={{ fontSize: 18, color: '#5B4E7A', marginBottom: 48, maxWidth: 600, margin: '0 auto 48px', fontWeight: 400, lineHeight: 1.6 }}>
                ARIA is live. Watch an agent conduct a real-time GDPR audit end-to-end.
                The dashboard surfaces document sections, renders findings, and streams reasoning traces.
              </p>

              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="cta-btn" onClick={onEnterDashboard} style={{ fontSize: 18, padding: '20px 44px' }}>
                  <Activity style={{ width: 22, height: 22 }} /> Launch Dashboard
                </button>
                <a className="cta-btn-ghost" href="https://github.com/muskan-khushi/aria-env" target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, padding: '18px 40px' }}>
                  View on GitHub <ArrowRight style={{ width: 18, height: 18 }} />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer style={{
          borderTop: '1px solid rgba(196, 181, 253, 0.25)',
          background: 'white',
          padding: '36px 48px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #C4B5FD, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity style={{ width: 16, height: 16, color: 'white' }} />
            </div>
            <span className="grotesque" style={{ fontSize: 14, fontWeight: 700, color: '#5B4E7A' }}>ARIA Compliance v1.0.0</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['GDPR', 'HIPAA', 'CCPA', 'SOC 2'].map((f, i) => (
              <span key={f} className="stat-pill" style={{ background: [' #EDE9FE', '#FCE7F3', '#FEF3C7', '#D1FAE5'][i], color: ['#6D28D9', '#BE185D', '#92400E', '#065F46'][i], fontSize: 11, padding: '4px 12px' }}>{f}</span>
            ))}
          </div>
          <div className="grotesque" style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>
          
          </div>
        </footer>

      </div>
    </div>
  );
}