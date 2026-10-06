import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { topicService } from '../services/topicService';
import { User } from '../types/auth';

interface SkillProfilePageProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  onStartTopic: (topic: string) => void;
  onLogout: () => void;
}

export const SkillProfilePage: React.FC<SkillProfilePageProps> = ({
  currentUser,
  onNavigate,
  onStartTopic,
  onLogout,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [skillData, setSkillData] = useState<any | null>(null);

  useEffect(() => {
    async function loadSkills() {
      setLoading(true);
      try {
        const res = await topicService.getUserSkills().catch(() => null);
        setSkillData(res);
      } catch (err) {
        console.error('Error fetching user skills:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
  }, []);

  const skills: any[] = skillData?.skills || [];
  const recommendation = skillData?.recommendation || null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19', color: '#ffffff' }}>
      <Sidebar
        currentPage="skill_profile"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Top Header Bar matching Panel 12 */}
        <TopUserHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          title="Your Skill Profile"
          subtitle="Evidence-based skill metrics derived from evaluated assessment responses."
        />

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading your skill profile...
          </div>
        ) : skills.length === 0 ? (
          /* Empty Skill Profile State */
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#111827', border: '1px solid #1f293d' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>🎯</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
              No skill data recorded yet
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#94a3b8', maxWidth: '460px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
              Skill scores are calculated from actual evaluation evidence. Complete an assessment to evaluate your skills.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('dashboard')}
              style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}
            >
              Start Assessment →
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Skill Breakdown Card */}
            <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#111827', border: '1px solid #1f293d' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#ffffff' }}>
                Evaluated Competencies
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {skills.map((s: any, idx: number) => {
                  const scorePct = Math.round((s.score || 0) * 100);
                  const confidencePct = Math.round((s.confidence || 0) * 100);
                  return (
                    <div key={idx} style={{ padding: '1rem', borderRadius: '10px', backgroundColor: '#0b0f19', border: '1px solid #1f293d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>{s.skill}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.75rem' }}>
                            ({s.evidence || 0} evaluated questions)
                          </span>
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: scorePct >= 70 ? '#34d399' : '#fbbf24' }}>
                          {scorePct}%
                        </span>
                      </div>

                      <div style={{ width: '100%', height: '8px', background: '#111827', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                        <div style={{
                          width: `${scorePct}%`,
                          height: '100%',
                          background: scorePct >= 70 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #d97706, #fbbf24)',
                          borderRadius: '9999px',
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <span>Confidence: {confidencePct}%</span>
                        <span style={{ textTransform: 'capitalize', color: s.status === 'strong' ? '#34d399' : '#38bdf8' }}>
                          Status: {s.status || 'developing'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Next Adaptive Recommendation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {recommendation ? (
                <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#111827', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>💡</span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Adaptive Recommendation
                    </h3>
                  </div>

                  <div style={{
                    background: '#0b0f19',
                    border: '1px solid #1f293d',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    marginBottom: '1.25rem',
                  }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Focus: {recommendation.targetSkill || 'Core Concepts'}
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, marginTop: '0.4rem', lineHeight: 1.5 }}>
                      {recommendation.reason || 'Focusing on identified areas for adaptive improvement.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', justifyContent: 'center' }}
                    onClick={() => onStartTopic(recommendation.targetSkill || 'Algorithms')}
                  >
                    Start Adaptive Assessment →
                  </button>
                </div>
              ) : (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#111827', border: '1px solid #1f293d' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Adaptive Assessment Ready</h4>
                  <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Take more assessments to receive targeted adaptive recommendations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SkillProfilePage;
