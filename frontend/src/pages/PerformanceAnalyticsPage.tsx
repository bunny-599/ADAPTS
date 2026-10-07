import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { topicService } from '../services/topicService';
import { User } from '../types/auth';

interface PerformanceAnalyticsPageProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export const PerformanceAnalyticsPage: React.FC<PerformanceAnalyticsPageProps> = ({
  currentUser,
  onNavigate,
  onLogout,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [performanceData, setPerformanceData] = useState<any | null>(null);

  useEffect(() => {
    async function loadPerformance() {
      setLoading(true);
      try {
        const res = await topicService.getUserPerformance().catch(() => null);
        setPerformanceData(res);
      } catch (err) {
        console.error('Error fetching performance analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPerformance();
  }, []);

  const totalAssessments = performanceData?.totalAssessments ?? performanceData?.totalAttempts ?? 0;
  const totalQuestions = performanceData?.totalQuestionsAttempted ?? 0;
  const averageAccuracy = Math.round(
    performanceData?.averageAccuracy ?? (performanceData?.overallAccuracy ? performanceData.overallAccuracy * 100 : 0)
  );
  const avgPace = performanceData?.avgResponseTimeSeconds ?? 0;
  const subjects = performanceData?.subjects || [];
  const historyList = performanceData?.history || performanceData?.trendHistory || [];
  const weakAreas = performanceData?.weakAreas || [];
  const strongAreas = performanceData?.strongAreas || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19', color: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar
        currentPage="performance"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Top Header Bar */}
        <TopUserHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          title="Performance Analytics"
          subtitle="Real-time performance analytics calculated directly from your evaluated assessments."
        />

        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Loading your performance records from PostgreSQL...</p>
          </div>
        ) : totalAssessments === 0 ? (
          /* Empty Performance State */
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>📊</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
              No performance data yet
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#94a3b8', maxWidth: '460px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
              Complete your first adaptive assessment to start building your skill profile, topic breakdown, and accuracy metrics.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('dashboard')}
              style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700 }}
            >
              Start Assessment →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Top 4 Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
              <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>
                  {totalAssessments}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
                  Total Assessments
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Completed and evaluated
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: averageAccuracy >= 70 ? '#34d399' : averageAccuracy >= 30 ? '#fbbf24' : '#ef4444', lineHeight: 1 }}>
                  {averageAccuracy}%
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
                  Average Accuracy
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Across all questions
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#c084fc', lineHeight: 1 }}>
                  {totalQuestions}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
                  Questions Answered
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Verified response count
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
                  {avgPace}s
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.5rem' }}>
                  Avg Pace per Question
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Speed & efficiency
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Strong Areas */}
              <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🌟 Strong Mastered Topics
                  </h3>
                  <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                    {strongAreas.length} Topics
                  </span>
                </div>
                {strongAreas.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0 }}>
                    Complete more questions with ≥70% accuracy to log strong topics.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {strongAreas.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#0b0f19', borderRadius: '8px', border: '1px solid #1f293d' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>{item.topic}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399' }}>{item.accuracy}% ({item.attempts} attempts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Areas for Growth */}
              <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🎯 Priority Growth Areas
                  </h3>
                  <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}>
                    {weakAreas.length} Topics
                  </span>
                </div>
                {weakAreas.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: '#34d399', margin: 0 }}>
                    No weak areas detected! Excellent overall accuracy across all topics.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {weakAreas.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#0b0f19', borderRadius: '8px', border: '1px solid #1f293d' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>{item.topic}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24' }}>{item.accuracy}% ({item.attempts} attempts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subject Performance Bars */}
            {subjects.length > 0 && (
              <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#ffffff' }}>
                  📌 Topic Mastery & Performance Breakdown
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {subjects.map((sub: any, idx: number) => {
                    const pct = Math.round(sub.percentage);
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>{sub.name}</span>
                          <span style={{ fontWeight: 700, color: pct >= 70 ? '#34d399' : pct >= 30 ? '#fbbf24' : '#ef4444' }}>
                            {pct}% ({sub.attemptsCount} attempt{sub.attemptsCount !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: '#0b0f19', borderRadius: '9999px', overflow: 'hidden', border: '1px solid #1f293d' }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct >= 70 ? 'linear-gradient(90deg, #10b981, #34d399)' : pct >= 30 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #ef4444)',
                            borderRadius: '9999px',
                            transition: 'width 0.8s ease-in-out',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* History Table / Timeline */}
            <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#ffffff' }}>
                📜 Assessment Attempt History
              </h3>

              {historyList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {historyList.map((item: any, idx: number) => {
                    const score = Math.round(item.score ?? (item.accuracy ? item.accuracy * 100 : 0));
                    const dateStr = item.createdAt || item.date ? new Date(item.createdAt || item.date).toLocaleDateString() : 'Recent';
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        backgroundColor: '#0b0f19',
                        border: '1px solid #1f293d',
                      }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.95rem' }}>
                            {item.topicName || item.topic || `Assessment #${item.attemptId || item.id}`}
                          </span>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                            Evaluated on {dateStr}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: score >= 70 ? '#34d399' : score >= 30 ? '#fbbf24' : '#ef4444',
                          backgroundColor: score >= 70 ? 'rgba(16, 185, 129, 0.15)' : score >= 30 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '6px',
                        }}>
                          {score}% Accuracy
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  Complete assessments to build a chronological performance timeline.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PerformanceAnalyticsPage;
