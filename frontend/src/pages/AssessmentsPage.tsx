import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { User } from '../types/auth';
import { topicService } from '../services/topicService';

interface AssessmentsPageProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  onStartTopic: (topic: string) => void;
  onLogout: () => void;
}

export const AssessmentsPage: React.FC<AssessmentsPageProps> = ({
  currentUser,
  onNavigate,
  onStartTopic,
  onLogout,
}) => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    topicService.getRecentAssessments()
      .then((data) => {
        if (!isMounted) return;
        setAssessments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load user assessments:', err);
        setError('Failed to load your assessments. Please check your connection.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const filteredAssessments = assessments.filter((a) => {
    const status = (a.status || 'in_progress').toLowerCase();
    const isCompleted = status === 'submitted' || status === 'completed';
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'in_progress' && status === 'in_progress') ||
      (statusFilter === 'completed' && isCompleted);

    const title = (a.topicTitle || 'Computer Science Assessment').toLowerCase();
    const matchesSearch = searchFilter === '' || title.includes(searchFilter.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#070a12', color: '#ffffff' }}>
      <Sidebar
        currentPage="assessments"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1320px', margin: '0 auto', position: 'relative' }}>
        <TopUserHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          title="Your Assessments"
          subtitle="Real-time record of your evaluated computer science assessments and active attempts."
        />

        {/* Filter & Search Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            {[
              { id: 'all', label: `All (${assessments.length})` },
              { id: 'in_progress', label: `In Progress (${assessments.filter(a => a.status === 'in_progress').length})` },
              { id: 'completed', label: `Completed (${assessments.filter(a => a.status === 'submitted' || a.status === 'completed').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                style={{
                  background: statusFilter === tab.id ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#0c101d',
                  color: statusFilter === tab.id ? '#ffffff' : '#94a3b8',
                  border: statusFilter === tab.id ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Field */}
          <div style={{ position: 'relative', width: '280px' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>🔍</span>
            <input
              type="text"
              placeholder="Filter by topic..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '2.5rem',
                paddingRight: '1rem',
                paddingTop: '0.55rem',
                paddingBottom: '0.55rem',
                fontSize: '0.88rem',
                backgroundColor: '#0c101d',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#ffffff',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}>
            <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }} />
            <div style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 600 }}>Loading your assessment records...</div>
          </div>
        ) : error ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#0c101d', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px' }}>
            <div style={{ color: '#f87171', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Unable to load assessments</div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{error}</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : filteredAssessments.length === 0 ? (
          /* Elegant Empty State (Section 39 & 56) */
          <div className="glass-card" style={{ padding: '4.5rem 2rem', textAlign: 'center', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              fontSize: '1.5rem',
            }}>
              📋
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
              {assessments.length === 0 ? 'No assessments yet' : 'No matching assessments'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 2rem auto', lineHeight: 1.5 }}>
              {assessments.length === 0
                ? 'Start your first assessment to prove what you know and begin building your verifiable skill profile.'
                : 'No assessments match the current filter or search criteria.'}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (onStartTopic) {
                  onStartTopic('Binary Search Trees');
                } else {
                  onNavigate('dashboard');
                }
              }}
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
            >
              Analyze a Topic
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {filteredAssessments.map((item) => {
              const isCompleted = item.status === 'submitted' || item.status === 'completed';
              const accuracy = typeof item.accuracy === 'number'
                ? Math.round(item.accuracy * 100)
                : typeof item.overallScore === 'number'
                ? Math.round(item.overallScore * 100)
                : null;

              return (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    padding: '1.75rem',
                    backgroundColor: '#0c101d',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: isCompleted ? '#34d399' : '#38bdf8',
                        border: isCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                      }}>
                        {isCompleted ? 'Completed' : 'In Progress'}
                      </span>

                      {accuracy !== null && (
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: accuracy >= 70 ? '#34d399' : accuracy >= 30 ? '#fbbf24' : '#ef4444' }}>
                          {accuracy}%
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                      {item.topicTitle || 'Computer Science Assessment'}
                    </h3>

                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
                      {item.startedAt ? new Date(item.startedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : 'Recent Attempt'}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      className={isCompleted ? 'btn-secondary' : 'btn-primary'}
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 600 }}
                      onClick={() => {
                        if (isCompleted) {
                          (onNavigate as any)('results', { attemptId: item.id });
                        } else {
                          onNavigate('take_assessment');
                        }
                      }}
                    >
                      {isCompleted ? 'View Performance Analysis →' : 'Resume Assessment →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AssessmentsPage;
