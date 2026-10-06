import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { User } from '../types/auth';

interface TopicPreparationPageProps {
  currentUser: User | null;
  topic: string;
  subtopics: string[];
  revisionPoints: string[];
  loading: boolean;
  onNavigate: (page: string) => void;
  onStartAssessment: () => void;
  onLogout: () => void;
}

export const TopicPreparationPage: React.FC<TopicPreparationPageProps> = ({
  currentUser,
  topic,
  subtopics,
  revisionPoints,
  loading,
  onNavigate,
  onStartAssessment,
  onLogout,
}) => {
  const displayTopic = topic || 'Searching Algorithms';
  const displaySubtopics = subtopics.length > 0 ? subtopics : [
    'Linear Search',
    'Binary Search',
    'Time Complexity',
    'Applications',
  ];
  const displayPoints = revisionPoints.length > 0 ? revisionPoints : [
    'Linear search checks elements sequentially in O(N) time.',
    'Binary search repeatedly divides sorted search space in O(log N) time.',
    'Binary search requires sorted input data to function correctly.',
    'Linear search provides O(1) best-case complexity when target is at index 0.',
    'Linear search requires O(1) auxiliary space, making it memory optimal.',
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#070a12', color: '#ffffff' }}>
      <Sidebar
        currentPage="prepare"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1320px', margin: '0 auto', position: 'relative' }}>
        {/* Top Header with Stepper */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Stepper */}
          <div className="stepper-bar">
            <div className="stepper-step step-completed">
              <span className="step-circle">✓</span>
              <span>Topic Decomposition</span>
            </div>
            <div className="step-connector completed" />

            <div className="stepper-step step-completed">
              <span className="step-circle">✓</span>
              <span>AI Research</span>
            </div>
            <div className="step-connector completed" />

            <div className="stepper-step step-active">
              <span className="step-circle">3</span>
              <span>Quick Revision</span>
            </div>
            <div className="step-connector" />

            <div className="stepper-step">
              <span className="step-circle">4</span>
              <span>Assessment Launch</span>
            </div>
          </div>

          <TopUserHeader currentUser={currentUser} onNavigate={onNavigate} />
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: '4.5rem', textAlign: 'center', backgroundColor: '#0c101d', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>Decomposing Topic & Generating AI Insights...</h2>
            <p style={{ color: '#94a3b8' }}>Synthesizing web-grounded research & quick revision points for <strong>{displayTopic}</strong>.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left Box: Topic Analysis Complete */}
            <div className="glass-card" style={{ padding: '2.25rem', backgroundColor: '#0c101d', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.18)', border: '1px solid rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', fontWeight: 'bold' }}>
                    ✓
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                      Topic Analysis Complete
                    </h3>
                    <span className="pill-badge pill-green" style={{ marginTop: '0.25rem' }}>Grounded in Research</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.92rem', color: '#94a3b8', marginBottom: '2rem', lineHeight: 1.5 }}>
                  We've verified your topic and compiled a concise conceptual refresher before your assessment.
                </p>

                <div style={{ marginBottom: '1.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.5rem', fontWeight: 700 }}>
                    Learned Topic
                  </label>
                  <div style={{ background: '#070a12', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '0.95rem 1.25rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
                    {displayTopic}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.85rem', fontWeight: 700 }}>
                    Target Focus Areas
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                    {displaySubtopics.map((sub, idx) => (
                      <span key={idx} className="pill-badge pill-blue" style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}>
                        🎯 {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2.5rem', background: '#070a12', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem' }}>
                  Ready to prove what you know?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                  Your personalized, server-timed adaptive assessment is prepared and ready.
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.95rem', fontSize: '1.05rem', justifyContent: 'center', fontWeight: 700, background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
                  onClick={onStartAssessment}
                >
                  Start Assessment →
                </button>
              </div>
            </div>

            {/* Right Box: Quick Revision Points */}
            <div className="glass-card" style={{ padding: '2.25rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  Quick Revision Takeaways
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.85rem' }}>
                  Review these 5 core concepts before starting the timed evaluation:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {displayPoints.map((point, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      background: '#070a12',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '0.95rem 1.1rem',
                      borderRadius: '12px',
                    }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.5, paddingTop: '0.15rem' }}>
                        {point}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🛡️</span>
                <span>Verified against multi-stage factual checking & sandbox execution benchmarks.</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
