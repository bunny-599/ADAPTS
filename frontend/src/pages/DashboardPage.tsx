import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { topicService } from '../services/topicService';
import { User } from '../types/auth';

interface DashboardPageProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  onStartTopic: (topic: string) => void;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  onNavigate,
  onStartTopic,
  onLogout,
}) => {
  const { user: clerkUser } = useUser();
  const [topicInput, setTopicInput] = useState('');
  const [recentAssessments, setRecentAssessments] = useState<any[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<any | null>(null);
  const [performanceData, setPerformanceData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const displayName = clerkUser?.firstName || clerkUser?.fullName || currentUser?.name || 'Learner';

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [recent, perf] = await Promise.all([
          topicService.getRecentAssessments().catch(() => []),
          topicService.getUserPerformance().catch(() => null),
        ]);

        setRecentAssessments(recent || []);
        setPerformanceData(perf);

        // Check for active in_progress attempt
        const inProgress = (recent || []).find((a: any) => a.status === 'in_progress');
        if (inProgress) {
          setActiveAttempt(inProgress);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    onStartTopic(topicInput.trim());
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const totalAssessments = performanceData?.totalAssessments || 0;
  const totalQuestions = performanceData?.totalQuestionsAttempted || 0;
  const overallAccuracy = performanceData?.averageAccuracy || 0;
  const avgRespTime = performanceData?.avgResponseTimeSeconds || 0;
  const subjects: any[] = performanceData?.subjects || [];
  const weakAreas: any[] = performanceData?.weakAreas || [];
  const strongAreas: any[] = performanceData?.strongAreas || [];
  const recommendations: any[] = performanceData?.recommendations || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#070a12', color: '#ffffff' }}>
      <Sidebar
        currentPage="dashboard"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1320px', margin: '0 auto', position: 'relative' }}>
        {/* Top Header Bar */}
        <TopUserHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          title={`${getGreeting()}, ${displayName} 👋`}
          subtitle="Intelligent adaptive CS assessment, weak-area detection, & code execution."
        />

        {/* Active Attempt Banner */}
        {activeAttempt && (
          <div
            className="glass-card glass-card-glow"
            style={{
              padding: '1.65rem 2.25rem',
              marginBottom: '2rem',
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(16, 185, 129, 0.18))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <span className="pill-badge pill-amber">IN PROGRESS</span>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Attempt #{activeAttempt.id}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
                {activeAttempt.topic || 'Adaptive CS Assessment'}
              </h3>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('take_assessment')}
              style={{ padding: '0.8rem 1.75rem', fontSize: '0.95rem' }}
            >
              Resume Assessment →
            </button>
          </div>
        )}

        {/* Start a New Assessment Primary Card (Section 6 & 23) */}
        <div className="glass-card" style={{ padding: '2.25rem', marginBottom: '2.5rem', backgroundColor: '#0c101d', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.2rem', color: '#38bdf8' }}>⚡</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                  Start a New Assessment
                </h2>
              </div>
              <p style={{ fontSize: '0.92rem', color: '#94a3b8', margin: 0 }}>
                Tell ADAPTS what you learned. We'll research the topic, prepare a concise revision, and generate a grounded adaptive assessment.
              </p>
            </div>
            <span className="pill-badge pill-blue">Adaptive Evaluation</span>
          </div>

          <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', color: '#38bdf8' }}>
                ✍️
              </span>
              <input
                type="text"
                className="form-field"
                style={{ paddingLeft: '3.25rem', fontSize: '1.02rem', backgroundColor: '#070a12', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                placeholder="What did you learn? (e.g. Binary Search Trees, React Hooks, SQL Joins, REST APIs)..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '0.9rem 2.25rem', fontSize: '1rem', whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
            >
              Analyze Topic
            </button>
          </form>

          {/* Quick Preset Badges (Section 6) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Examples:</span>
            {[
              'Binary Search Trees',
              'React Hooks',
              'Python Decorators',
              'REST APIs',
              'Operating Systems',
              'SQL Joins',
              'Dynamic Programming',
            ].map((name, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setTopicInput(name);
                  onStartTopic(name);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            <div>Loading verified performance data...</div>
          </div>
        ) : totalAssessments === 0 ? (
          /* High Impact Initial State (Section 22 & 74: No fake data) */
          <div className="glass-card" style={{ padding: '4.5rem 2rem', textAlign: 'center', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              fontSize: '1.5rem',
            }}>
              📊
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
              No assessments yet
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#94a3b8', maxWidth: '480px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
              Start your first assessment to begin building your skill profile. We adapt future assessments based on your real evaluated performance.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const el = document.querySelector('input[placeholder*="What did you learn"]');
                if (el) (el as HTMLElement).focus();
              }}
              style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700, background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
            >
              Analyze a Topic
            </button>
          </div>
        ) : (
          <div>
            {/* Executive Performance Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
              <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                <div style={{ fontSize: '0.78rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  ELO Skill Rating
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  {currentUser?.eloScore ?? 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#fde68a', marginTop: '0.25rem' }}>
                  {(currentUser?.eloScore ?? 0) >= 800 ? '⭐ Advanced' : (currentUser?.eloScore ?? 0) >= 300 ? '💠 Intermediate' : '🌱 Beginner'}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Assessments Completed
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', marginTop: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  {totalAssessments}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>↑ Active Learner</span>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Questions Attempted
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  {totalQuestions}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  MCQ & Code Sandbox
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Overall Accuracy
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: overallAccuracy >= 70 ? '#34d399' : '#fbbf24', marginTop: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  {overallAccuracy}%
                </div>
                <div style={{ fontSize: '0.78rem', color: overallAccuracy >= 70 ? '#34d399' : '#fbbf24', marginTop: '0.25rem' }}>
                  {overallAccuracy >= 80 ? 'Mastery Level' : 'Developing'}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Avg Response Time
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#c084fc', marginTop: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  {avgRespTime > 0 ? `${avgRespTime}s` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Per Question Pace
                </div>
              </div>
            </div>

            {/* Analytics & Weak/Strong Areas Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginBottom: '2.5rem' }}>
              {/* Subject Performance Bars */}
              <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                      Topic Competency Breakdown
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>Evaluated across past adaptive assessments</p>
                  </div>
                  <span
                    onClick={() => onNavigate('performance')}
                    style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View Full Profile →
                  </span>
                </div>

                {subjects.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                    {subjects.map((sub: any, idx: number) => {
                      const pct = Math.round(sub.percentage);
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.45rem' }}>
                            <span style={{ fontWeight: 600, color: '#ffffff' }}>{sub.name}</span>
                            <span style={{ fontWeight: 700, color: pct >= 70 ? '#34d399' : '#fbbf24' }}>{pct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#070a12', borderRadius: '9999px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: pct >= 70 ? 'linear-gradient(90deg, #0284c7, #34d399)' : 'linear-gradient(90deg, #d97706, #fbbf24)',
                              borderRadius: '9999px',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
                    No topic statistics recorded yet. Start an assessment to generate your radar.
                  </div>
                )}
              </div>

              {/* Weak & Strong Areas Overview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fb7185', margin: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
                    ⚠️ Growth Opportunities (Weak Areas)
                  </h4>

                  {weakAreas.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {weakAreas.map((w: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.95rem', backgroundColor: '#070a12', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>{w.topic}</div>
                            <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{w.attempts} attempt(s)</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onStartTopic(w.topic)}
                            style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#fb7185', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Practice ({w.accuracy}%) →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.88rem', color: '#34d399', fontWeight: 600 }}>✓ No critical weak areas detected! Excellent performance across topics.</div>
                  )}
                </div>

                <div className="glass-card" style={{ padding: '1.65rem', backgroundColor: '#0c101d', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399', margin: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
                    ✓ Mastered Strengths
                  </h4>

                  {strongAreas.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                      {strongAreas.map((s: any, idx: number) => (
                        <span key={idx} className="pill-badge pill-green">
                          ✓ {s.topic} ({s.accuracy}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Complete more assessments to showcase topic mastery.</div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
              <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
                  Recommended Adaptive Next Assessments
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                  {recommendations.map((rec: any, idx: number) => (
                    <div key={idx} className="glass-card" style={{ padding: '1.85rem', backgroundColor: '#0c101d', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                            {rec.topic}
                          </h4>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                            <span className="pill-badge pill-blue">{rec.questionCount} Questions</span>
                            <span className="pill-badge pill-purple">~{rec.estimatedMinutes} mins</span>
                            <span className="pill-badge pill-amber">{rec.difficulty}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '1.5rem' }}>🎯</span>
                      </div>

                      <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                        {rec.reason}
                      </p>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onStartTopic(rec.topic)}
                        style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', justifyContent: 'center' }}
                      >
                        Start Adaptive Assessment →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Assessments Feed */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                  Recent Activity & History
                </h3>
                <span
                  onClick={() => onNavigate('history')}
                  style={{ fontSize: '0.88rem', color: '#38bdf8', fontWeight: 600, cursor: 'pointer' }}
                >
                  View full history →
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {recentAssessments.slice(0, 5).map((item: any) => {
                  const isCompleted = item.status === 'completed' || item.status === 'submitted';
                  const scoreDisplay = item.accuracy !== undefined ? `${Math.round(item.accuracy * 100)}% Accuracy` : isCompleted ? 'Evaluated' : 'In Progress';
                  const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

                  return (
                    <div
                      key={item.id}
                      className="glass-card"
                      onClick={() => {
                        if (isCompleted) {
                          (onNavigate as any)('results', { attemptId: item.id });
                        } else {
                          onNavigate('take_assessment');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1.2rem 1.75rem',
                        cursor: 'pointer',
                        backgroundColor: '#0c101d',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                        }}>
                          ⚡
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '0.2rem' }}>
                            {item.topic || item.assessment_name || `Assessment #${item.id}`}
                          </h4>
                          <span style={{ fontSize: '0.85rem', color: isCompleted ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                            {isCompleted ? `Completed • ${scoreDisplay}` : 'In Progress'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                          {dateStr}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 700 }}>
                          View →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
