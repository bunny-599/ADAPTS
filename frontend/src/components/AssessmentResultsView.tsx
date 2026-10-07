import React, { useState, useEffect } from 'react';
import { PerformanceAnalysisResult } from '../types/analysis';
import { topicService } from '../services/topicService';
import { LearnerProgressView } from './LearnerProgressView';

interface AssessmentResultsViewProps {
  attemptId: number;
  topicId?: number;
  initialAnalysis?: PerformanceAnalysisResult | null;
  onExit?: () => void;
  onStartAdaptiveAssessment?: (newAssessmentId: number) => void;
  onNavigatePerformance?: () => void;
}

export const AssessmentResultsView: React.FC<AssessmentResultsViewProps> = ({
  attemptId,
  topicId,
  initialAnalysis,
  onExit,
  onStartAdaptiveAssessment,
  onNavigatePerformance,
}) => {
  const [analysis, setAnalysis] = useState<PerformanceAnalysisResult | null>(
    initialAnalysis || null
  );
  const [loading, setLoading] = useState<boolean>(!initialAnalysis);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showProgressView, setShowProgressView] = useState<boolean>(false);
  const [generatingAdaptive, setGeneratingAdaptive] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchAnalysis() {
      if (initialAnalysis) {
        setAnalysis(initialAnalysis);
        setLoading(false);
        return;
      }

      const targetId = attemptId || 1;

      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. First try instant fetch of pre-saved analysis from database (<50ms)
        let res: PerformanceAnalysisResult | null = null;
        try {
          res = await topicService.getAttemptAnalysis(targetId);
        } catch {
          // 2. If not analyzed yet, run the analysis
          res = await topicService.analyzeAttempt(targetId);
        }

        if (isMounted && res) {
          setAnalysis(res);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load performance analysis:', err);
          setErrorMessage(err.message || 'Failed to compute performance analysis.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAnalysis();

    return () => {
      isMounted = false;
    };
  }, [attemptId, initialAnalysis]);

  const handleContinueAssessment = async () => {
    try {
      setGeneratingAdaptive(true);
      const targetCount = Math.max(1, Math.min(analysis?.overall.totalQuestions || 5, 5));
      const res = await topicService.generateAdaptiveAssessment(
        topicId || 1,
        targetCount,
        attemptId
      );
      if (onStartAdaptiveAssessment && res.assessmentId) {
        onStartAdaptiveAssessment(res.assessmentId);
      }
    } catch (err: any) {
      console.error('Failed to generate adaptive assessment:', err);
    } finally {
      setGeneratingAdaptive(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#0b0f19', color: '#ffffff' }}>
        <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>Analyzing Performance & Evaluating Skills...</h3>
        <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginTop: '0.5rem' }}>
          Computing response accuracy, mistake counts, competency evidence, and topic skill profiles.
        </p>
      </div>
    );
  }

  if (errorMessage || !analysis) {
    return (
      <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f87171', marginBottom: '0.75rem' }}>
          ⚠️ Unable to Load Performance Analysis
        </h3>
        <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          {errorMessage || 'No analysis data found for this attempt.'}
        </p>
        {onExit && (
          <button type="button" className="btn-primary" onClick={onExit} style={{ padding: '0.75rem 1.5rem' }}>
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  if (showProgressView && topicId) {
    return (
      <LearnerProgressView
        topicId={topicId}
        onExit={() => setShowProgressView(false)}
        onStartAdaptive={handleContinueAssessment}
      />
    );
  }

  const { overall, subtopics, skills, cognitiveLevels, strengths, weaknesses } = analysis;
  const accuracyPct = Math.round(overall.accuracy * 100);
  const completionPct = Math.round(overall.completionRate * 100);
  const avgPaceSecs = overall.totalQuestions > 0 ? Math.round(overall.durationSeconds / overall.totalQuestions) : 0;
  const errorRatePct = overall.evaluatedQuestions > 0 ? Math.round((overall.incorrectAnswers / overall.evaluatedQuestions) * 100) : 0;

  const getEloRankName = (elo: number): string => {
    if (elo >= 1200) return '🏆 Master Adept';
    if (elo >= 800) return '⭐ Advanced Practitioner';
    if (elo >= 500) return '💠 Intermediate Explorer';
    if (elo >= 200) return '🌱 Apprentice Learner';
    return '🐣 Beginner';
  };

  const getScoreColor = (pct: number): string => {
    if (pct < 30) return '#ef4444';
    if (pct < 70) return '#fbbf24';
    return '#10b981';
  };

  return (
    <div style={{ backgroundColor: '#0b0f19', color: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: '3rem' }}>
      {/* Top Navigation Bar with High Contrast Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            ← Back to Dashboard
          </button>
        ) : <div />}

        {onNavigatePerformance && (
          <button
            type="button"
            onClick={onNavigatePerformance}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: '1px solid #3b82f6',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            }}
          >
            View Performance Analytics →
          </button>
        )}
      </div>

      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{
            background: 'rgba(37, 99, 235, 0.3)',
            border: '1px solid #3b82f6',
            color: '#38bdf8',
            padding: '0.3rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            PERFORMANCE ANALYSIS & SKILL PROFILE
          </span>
          {overall.eloScore !== undefined && (
            <span style={{
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid #f59e0b',
              color: '#fbbf24',
              padding: '0.3rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
            }}>
              ⚡ {overall.eloScore} ELO {overall.eloDelta ? `(+${overall.eloDelta})` : ''}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', margin: 0, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Assessment Competency Report
        </h1>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
          Evaluated across <strong style={{ color: '#ffffff' }}>{overall.totalQuestions} questions</strong> ({overall.evaluatedQuestions} auto-graded). Completed in <strong style={{ color: '#ffffff' }}>{Math.floor(overall.durationSeconds / 60)}m {overall.durationSeconds % 60}s</strong>.
        </p>
      </div>

      {/* 6 Distinct High-Contrast Stat Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {/* Card 1: ELO Rating */}
        <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>
              {overall.eloScore ?? 0}
            </span>
            {(overall.eloDelta !== undefined && overall.eloDelta > 0) && (
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399' }}>
                +{overall.eloDelta}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.6rem' }}>
            ELO Skill Rating
          </div>
          <div style={{ fontSize: '0.78rem', color: '#fde68a', marginTop: '0.25rem', fontWeight: 500 }}>
            {getEloRankName(overall.eloScore ?? 0)}
          </div>
        </div>

        {/* Card 2: Questions Attempted */}
        <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>
            {overall.answeredQuestions} / {overall.totalQuestions}
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.6rem' }}>
            Questions Attempted
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
            {completionPct}% Completion Rate
          </div>
        </div>

        {/* Card 3: Correct Answers */}
        <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
            {overall.correctAnswers} Correct
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.6rem' }}>
            Correct Score
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
            {overall.correctAnswers} of {overall.evaluatedQuestions} graded
          </div>
        </div>

        {/* Card 4: Wrong Answers / Mistakes */}
        <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f43f5e', lineHeight: 1 }}>
            {overall.incorrectAnswers} Mistakes
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.6rem' }}>
            Wrong Answers
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '0.25rem', fontWeight: 500 }}>
            {errorRatePct}% Error Rate
          </div>
        </div>

        {/* Card 5: Evaluated Accuracy */}
        <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: getScoreColor(accuracyPct), lineHeight: 1 }}>
            {accuracyPct}%
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.6rem' }}>
            Evaluated Accuracy
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
            Auto-graded overall
          </div>
        </div>

        {/* Card 6: Avg Pace per Question */}
        <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#c084fc', lineHeight: 1 }}>
            {avgPaceSecs}s
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '0.6rem' }}>
            Avg Pace / Question
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.25rem', fontWeight: 500 }}>
            {overall.durationSeconds}s total duration
          </div>
        </div>
      </div>

      {/* Mastered Strengths & Priority Growth Areas Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Mastered Strengths */}
        <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🌟 Mastered Strengths
            </h3>
            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
              {strengths.length} Areas
            </span>
          </div>

          {strengths.length === 0 ? (
            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
              Continue practicing to build verified mastery (requires ≥ 2 questions with ≥ 80% accuracy).
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {strengths.map((subtopicName, idx) => {
                const subData = subtopics[subtopicName];
                const acc = subData?.accuracy !== null && subData?.accuracy !== undefined ? Math.round(subData.accuracy * 100) : 100;
                const count = subData?.evaluated ?? 2;
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.1rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>{subtopicName}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: getScoreColor(acc) }}>{acc}% ({count} evaluated)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority Areas for Growth */}
        <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🎯 Priority Areas for Growth
            </h3>
            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.5)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
              {weaknesses.length} Areas
            </span>
          </div>

          {weaknesses.length === 0 ? (
            <p style={{ fontSize: '0.92rem', color: '#34d399', lineHeight: 1.6, margin: 0 }}>
              No significant weaknesses detected! Solid performance across all evaluated subtopics.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {weaknesses.map((subtopicName, idx) => {
                const subData = subtopics[subtopicName];
                const acc = subData?.accuracy !== null && subData?.accuracy !== undefined ? Math.round(subData.accuracy * 100) : 0;
                const count = subData?.evaluated ?? 2;
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.1rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>{subtopicName}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: getScoreColor(acc), backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                      {acc}% ({count} evaluated)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Persistent Topic Skill Profile */}
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '0.4rem' }}>
          🧠 Persistent Topic Skill Profile
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', margin: 0, marginBottom: '1.5rem' }}>
          Tracks long-term mastery by aggregating verified responses across assessments.
        </p>

        {Object.keys(skills).length === 0 ? (
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', margin: 0 }}>No skill mappings recorded for this topic yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
            {Object.entries(skills).map(([skillName, skillItem]) => {
              const scorePct = Math.round(skillItem.score * 100);
              const confPct = Math.round(skillItem.confidence * 100);
              const statusTag = skillItem.status.replace('_', ' ');
              return (
                <div key={skillName} style={{ padding: '1.25rem', backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>{skillName}</span>
                    <span style={{
                      backgroundColor: (skillItem.status as string) === 'strong' || (skillItem.status as string) === 'mastered' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.2)',
                      color: (skillItem.status as string) === 'strong' || (skillItem.status as string) === 'mastered' ? '#34d399' : '#38bdf8',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}>
                      {statusTag}
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.65rem' }}>
                    <div style={{
                      width: `${scorePct}%`,
                      height: '100%',
                      background: scorePct >= 70 ? 'linear-gradient(90deg, #10b981, #34d399)' : scorePct >= 30 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #ef4444)',
                      borderRadius: '9999px',
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 500 }}>
                    <span>Confidence: <strong style={{ color: '#ffffff' }}>{confPct}%</strong></span>
                    <span><strong style={{ color: '#ffffff' }}>{skillItem.correctCount || 0}</strong> / {skillItem.evidence} correct</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subtopics & Cognitive Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Cognitive Breakdown */}
        <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '1.25rem' }}>
            💡 Cognitive Level Mastery
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {Object.entries(cognitiveLevels).map(([level, data]) => {
              const pct = data.accuracy !== null ? Math.round(data.accuracy * 100) : 0;
              return (
                <div key={level}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>{level}</span>
                    <span style={{ fontWeight: 800, color: getScoreColor(pct) }}>{pct}% ({data.correct}/{data.evaluated})</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? '#10b981' : pct >= 30 ? '#f59e0b' : '#ef4444', borderRadius: '9999px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subtopic Performance */}
        <div className="glass-card" style={{ padding: '1.75rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '1.25rem' }}>
            📌 Subtopic Performance
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {Object.entries(subtopics).map(([subtopic, data]) => {
              const pct = data.accuracy !== null ? Math.round(data.accuracy * 100) : 0;
              return (
                <div key={subtopic}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>{subtopic}</span>
                    <span style={{ fontWeight: 800, color: getScoreColor(pct) }}>{pct}% ({data.correct}/{data.evaluated})</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? '#10b981' : pct >= 30 ? '#f59e0b' : '#ef4444', borderRadius: '9999px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question-by-Question Exam Written Paper & Solutions Section */}
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2.5rem', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              📝 Exam Paper & Question Solutions
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0.3rem 0 0 0' }}>
              Complete review showing your answered responses, correct answers, and grading explanations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
              {overall.correctAnswers} Correct
            </span>
            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
              {overall.incorrectAnswers} Incorrect
            </span>
          </div>
        </div>

        {(!analysis.evaluatedResponses || analysis.evaluatedResponses.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            No individual response records found for this assessment attempt.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {analysis.evaluatedResponses.map((item, idx) => {
              const qNum = item.order || idx + 1;
              const isCorrect = item.evaluationStatus === 'correct' || (item.score !== null && item.score >= 0.7);
              const isUnanswered = item.evaluationStatus === 'unanswered' || !item.answer;
              const statusColor = isCorrect ? '#10b981' : isUnanswered ? '#fbbf24' : '#ef4444';
              const statusBg = isCorrect ? 'rgba(16, 185, 129, 0.12)' : isUnanswered ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
              const statusBorder = isCorrect ? 'rgba(16, 185, 129, 0.3)' : isUnanswered ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)';
              const statusLabel = isCorrect ? '✓ Correct (1.0 / 1.0)' : isUnanswered ? '⚠️ Unanswered (0.0 / 1.0)' : '✗ Incorrect (0.0 / 1.0)';

              return (
                <div
                  key={item.questionId || idx}
                  style={{
                    backgroundColor: '#0f172a',
                    border: `1px solid ${statusBorder}`,
                    borderRadius: '10px',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', backgroundColor: '#1e293b', padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                        Question #{qNum}
                      </span>
                      {item.subtopic && (
                        <span style={{ fontSize: '0.78rem', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 600 }}>
                          {item.subtopic}
                        </span>
                      )}
                      {item.cognitiveLevel && (
                        <span style={{ fontSize: '0.78rem', color: '#cbd5e1', backgroundColor: '#1e293b', padding: '0.2rem 0.55rem', borderRadius: '4px', textTransform: 'capitalize' }}>
                          {item.cognitiveLevel}
                        </span>
                      )}
                    </div>
                    <div style={{
                      backgroundColor: statusBg,
                      border: `1px solid ${statusColor}`,
                      color: statusColor,
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                    }}>
                      {statusLabel}
                    </div>
                  </div>

                  {/* Question Text */}
                  <div style={{ fontSize: '1.02rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    {item.questionText || `Question #${qNum}`}
                  </div>

                  {/* Comparison: Your Answer vs Expected Answer */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    {/* User's Answer */}
                    <div style={{
                      backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isCorrect ? '#34d399' : '#f87171', marginBottom: '0.35rem' }}>
                        Your Written Answer
                      </div>
                      <div style={{ fontSize: '0.92rem', color: item.answer ? '#ffffff' : '#94a3b8', fontStyle: item.answer ? 'normal' : 'italic' }}>
                        {item.answer ? item.answer : '(No response provided)'}
                      </div>
                    </div>

                    {/* Expected Answer */}
                    <div style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#34d399', marginBottom: '0.35rem' }}>
                        Expected Correct Answer
                      </div>
                      <div style={{ fontSize: '0.92rem', color: '#ffffff', fontWeight: 600 }}>
                        {item.expectedAnswer || 'Authoritative Specification Answer'}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Explanation / Reasoning */}
                  {(item.evaluationDetails?.reasoning || (item as any).explanation) && (
                    <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, borderLeft: `3px solid ${statusColor}` }}>
                      <strong style={{ color: '#ffffff' }}>Explanation: </strong>
                      {item.evaluationDetails?.reasoning || (item as any).explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {onExit && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onExit}
              style={{
                backgroundColor: '#1e293b',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '0.8rem 1.6rem',
                borderRadius: '8px',
                fontWeight: 600,
              }}
            >
              ← Exit to Dashboard
            </button>
          )}

          {topicId && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowProgressView(true)}
              style={{
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #3b82f6',
                padding: '0.8rem 1.6rem',
                borderRadius: '8px',
                fontWeight: 600,
              }}
            >
              📈 View Learning Trends
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={generatingAdaptive}
          onClick={handleContinueAssessment}
          style={{
            padding: '0.9rem 2.2rem',
            fontSize: '1.02rem',
            fontWeight: 800,
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '8px',
            border: 'none',
            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
            cursor: generatingAdaptive ? 'not-allowed' : 'pointer',
          }}
        >
          {generatingAdaptive ? 'Preparing Next Assessment...' : '🚀 Start Next Adaptive Assessment'}
        </button>
      </div>
    </div>
  );
};

export default AssessmentResultsView;
