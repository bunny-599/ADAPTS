import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { topicService } from '../services/topicService';
import { User } from '../types/auth';

interface AssessmentHistoryPageProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export const AssessmentHistoryPage: React.FC<AssessmentHistoryPageProps> = ({
  currentUser,
  onNavigate,
  onLogout,
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const recent = await topicService.getRecentAssessments().catch(() => []);
        const valid = (recent || []).filter((a: any) => {
          const status = (a.status || '').toLowerCase();
          if (status === 'abandoned') return false;
          if (status === 'timed_out' && !a.accuracy && !a.overallScore) return false;
          return true;
        });
        setHistory(valid);
      } catch (err) {
        console.error('Error loading assessment history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19', color: '#ffffff' }}>
      <Sidebar
        currentPage="history"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
        <TopUserHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          title="Assessment History"
          subtitle="Complete log of your previous attempts, test duration, accuracy, and status."
        />

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading your assessment history...
          </div>
        ) : history.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#111827', border: '1px solid #1f293d' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>📜</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
              No assessment history recorded yet
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#94a3b8', maxWidth: '440px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
              Your complete timeline of completed tests, accuracy scores, and timestamps will be stored here.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('assessments')}
              style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700 }}
            >
              Take an Assessment →
            </button>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#111827', border: '1px solid #1f293d' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '1.5rem', margin: 0 }}>
              All Assessment Attempts ({history.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map((item: any) => {
                const isCompleted = item.status === 'completed' || item.status === 'submitted';
                const rawAcc = item.accuracy ?? item.overallScore;
                const accPct = typeof rawAcc === 'number'
                  ? Math.round(rawAcc * 100)
                  : typeof rawAcc === 'string' && !isNaN(parseFloat(rawAcc))
                  ? Math.round(parseFloat(rawAcc) * 100)
                  : null;
                const scoreDisplay = accPct !== null ? `${accPct}%` : isCompleted ? 'Evaluated' : 'In Progress';
                const scoreColor = accPct !== null ? (accPct < 30 ? '#ef4444' : accPct < 70 ? '#fbbf24' : '#10b981') : (isCompleted ? '#10b981' : '#fbbf24');
                const dateStr = item.started_at || item.startedAt || item.created_at
                  ? new Date(item.started_at || item.startedAt || item.created_at).toLocaleString()
                  : 'Recent';

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1.25rem 1.75rem',
                      backgroundColor: '#0b0f19',
                      borderRadius: '10px',
                      border: '1px solid #1f293d',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        border: isCompleted ? '1px solid #10b981' : '1px solid #f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                      }}>
                        {isCompleted ? '✓' : '⏱️'}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '0.25rem' }}>
                          {item.topicTitle || item.topic || item.assessment_name || `Assessment #${item.id}`}
                        </h4>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                          Attempt #{item.id} • Started {dateStr}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: scoreColor }}>
                          {scoreDisplay}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                          {item.status}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={isCompleted ? 'btn-secondary' : 'btn-primary'}
                        onClick={() => {
                          if (isCompleted) {
                            (onNavigate as any)('results', { attemptId: item.id });
                          } else {
                            onNavigate('take_assessment');
                          }
                        }}
                        style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}
                      >
                        {isCompleted ? 'View Analysis' : 'Continue'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AssessmentHistoryPage;
