import React, { useState } from 'react';
import { SignInButton, SignUpButton, UserButton, useUser, useClerk } from '@clerk/react';
import { Logo } from '../components/Logo';

interface LandingPageProps {
  onNavigate: (page: string, tab?: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { isSignedIn } = useUser();
  const clerk = useClerk();
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);

  const handleProfileClick = () => {
    if (clerk && clerk.openUserProfile) {
      clerk.openUserProfile();
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Navbar Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 3.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(9, 13, 22, 0.92)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Brand Logo */}
        <Logo size="medium" onClick={() => onNavigate('landing')} />

        {/* Center Nav Links */}
        <nav style={{ display: 'flex', gap: '2.5rem', fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>
          <span style={{ color: '#ffffff', cursor: 'pointer' }} onClick={() => onNavigate('landing')}>
            Overview
          </span>
          <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection('features')}>
            Architecture
          </span>
          <span style={{ cursor: 'pointer' }} onClick={() => scrollToSection('lifecycle')}>
            Mission Lifecycle
          </span>
          <span style={{ cursor: 'pointer' }} onClick={() => setShowDemoModal(true)}>
            Platform Specs
          </span>
        </nav>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isSignedIn ? (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onNavigate('dashboard')}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
              >
                Go to Dashboard →
              </button>
              <div onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
                <UserButton />
              </div>
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#e2e8f0',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '6px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Sign In
                </button>
              </SignInButton>

              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.55rem 1.35rem', fontSize: '0.88rem' }}
                >
                  Get Started
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '4.5rem 2rem 3rem 2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1.15fr',
            gap: '3.5rem',
            alignItems: 'center',
            marginBottom: '6rem',
          }}
        >
          {/* Hero Left Content */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '4px', backgroundColor: '#141b2d', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.25rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Production-Grade CS Adaptive Evaluation
              </span>
            </div>

            <h1
              style={{
                fontSize: '3.2rem',
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: '1.5rem',
                letterSpacing: '-0.025em',
                color: '#ffffff',
              }}
            >
              Don't just claim what you know.{' '}
              <span style={{ color: '#38bdf8' }}>
                Prove it.
              </span>
            </h1>

            <p
              style={{
                fontSize: '1.05rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                marginBottom: '2.5rem',
                maxWidth: '520px',
              }}
            >
              ADAPTS decomposes any Computer Science topic, performs web-grounded research, enforces complexity invariants, and benchmarks your technical competency in an automated adaptive loop.
            </p>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {isSignedIn ? (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.8rem 2rem', fontSize: '0.95rem', fontWeight: 700 }}
                  onClick={() => onNavigate('dashboard')}
                >
                  Enter Studio Dashboard →
                </button>
              ) : (
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '0.8rem 2rem', fontSize: '0.95rem', fontWeight: 700 }}
                  >
                    Start Adaptive Session →
                  </button>
                </SignUpButton>
              )}

              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                style={{
                  padding: '0.8rem 1.5rem',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  backgroundColor: '#141b2d',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Inspect Platform Specs
              </button>
            </div>
          </div>

          {/* Hero Right Visual: High-Craft Live Studio Terminal Mockup */}
          <div
            style={{
              backgroundColor: '#0c111d',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Terminal Window Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                backgroundColor: '#141b2d',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '0.5rem', fontFamily: 'monospace' }}>
                  ADAPTS Studio :: Session #402
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>
                09:42 REMAINING
              </span>
            </div>

            {/* Lifecycle Phase Track in Terminal */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', padding: '0.6rem 1.25rem', gap: '1rem', backgroundColor: '#090d16' }}>
              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600 }}>✓ 01 Scope</span>
              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600 }}>✓ 02 Grounding</span>
              <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>● 03 Cockpit</span>
              <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 500 }}>○ 04 Debrief</span>
            </div>

            {/* Terminal Content Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontWeight: 700 }}>
                  QUESTION 03 OF 05 • MEDIUM
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Bloom: Analyze | GA Fitness: 0.94
                </span>
              </div>

              <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.5 }}>
                Under binary partition intervals, explain why integer truncation `(low + high) / 2` causes arithmetic overflow for large bounds, and state the invariant-safe expression.
              </div>

              {/* Code IDE Snippet */}
              <div
                style={{
                  backgroundColor: '#070a12',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  color: '#cbd5e1',
                }}
              >
                <div><span style={{ color: '#64748b' }}>// Correct arithmetic calculation preventing 32-bit overflow</span></div>
                <div><span style={{ color: '#38bdf8' }}>int</span> mid = low + (high - low) / <span style={{ color: '#f59e0b' }}>2</span>;</div>
                <div style={{ marginTop: '0.5rem', color: '#10b981' }}>// Invariant: low &lt;= mid &lt; high guaranteed</div>
              </div>

              {/* Real-time telemetry footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>Autosave synched to PostgreSQL</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600 }}>
                  DDA Vector: Target Difficulty 0.62
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* FEATURES / ARCHITECTURE SECTION                          */}
        {/* ======================================================== */}
        <section id="features" style={{ paddingTop: '2rem', marginBottom: '5rem' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8', fontWeight: 700 }}>
              Engineering Architecture
            </span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '0.4rem' }}>
              Built Like a High-Reliability Engineering Engine
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                01. Semantic Guardrails
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
                Complexity Verification
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                Deterministic cross-validators verify algorithm mechanisms and time/space complexity invariants before questions ever reach the student.
              </p>
            </div>

            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                02. Genetic Algorithm
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
                Multi-Objective Optimization
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                A multi-objective GA optimizes cognitive diversity across Bloom’s Taxonomy, subtopic coverage, target difficulty, and minimizes redundancy.
              </p>
            </div>

            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                03. Isolated Sandbox
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
                Docker C++ Execution
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                Real code submissions are compiled and executed in non-networked Docker containers with hard limits on CPU, memory, and timeout bounds.
              </p>
            </div>

            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                04. Clamped DDA
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
                Adaptive Trend Profiling
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                Dynamic difficulty adjustments are bounded (0.20–0.85) with clamped step rates (&le; 0.08) to detect empirical trends without erratic oscillations.
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* MISSION LIFECYCLE SECTION                                */}
        {/* ======================================================== */}
        <section id="lifecycle" style={{ paddingTop: '2rem', marginBottom: '5rem' }}>
          <div style={{ backgroundColor: '#0c111d', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '2.5rem' }}>
            <div style={{ marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', fontWeight: 700 }}>
                Unbroken Continuous Flow
              </span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.4rem' }}>
                The 4 Continuous Stages of an Assessment Session
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#141b2d', padding: '1.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>01</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0.5rem 0' }}>Scope & Disambiguate</h4>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Ambiguous inputs like "Trees" are resolved in-context before burning LLM tokens.
                </p>
              </div>

              <div style={{ backgroundColor: '#141b2d', padding: '1.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>02</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0.5rem 0' }}>Grounded Briefing</h4>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Authoritative web grounding extracts 60-second refresher takeaways with complexity guarantees.
                </p>
              </div>

              <div style={{ backgroundColor: '#141b2d', padding: '1.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#a855f7' }}>03</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0.5rem 0' }}>Assessment Cockpit</h4>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Server-authoritative timer, real-time response autosave, and multi-format testing.
                </p>
              </div>

              <div style={{ backgroundColor: '#141b2d', padding: '1.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24' }}>04</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: '0.5rem 0' }}>Diagnostic Debrief</h4>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Live skill vector shifts, continuous accuracy calculation, and adaptive follow-up generation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Demo Modal */}
      {showDemoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDemoModal(false)}
        >
          <div
            style={{
              maxWidth: '620px',
              width: '90%',
              padding: '2.5rem',
              backgroundColor: '#0c111d',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <Logo size="small" />
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
              ADAPTS Enterprise Architecture Specifications
            </h3>
            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '2rem' }}>
              ADAPTS uses zero mock data. Every assessment is grounded via real-time search, validated through deterministic complexity checks, optimized using a Genetic Algorithm, and timed via PostgreSQL server sync.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDemoModal(false);
                  onNavigate('dashboard');
                }}
                className="btn-primary"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Enter Studio Workspace →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
