import React, { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/react';
import { Sidebar } from '../components/Sidebar';
import { User } from '../types/auth';
import { topicService } from '../services/topicService';

export interface DisplayQuestion {
  id: string | number;
  type: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string | number;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
}

interface AssessmentTakingFullscreenPageProps {
  currentUser: User | null;
  topicName?: string;
  realQuestions?: any[];
  attemptId?: number;
  durationSeconds?: number;
  startedAt?: string;
  onNavigate: (page: string) => void;
  onSubmitSession: (answers: Record<string, string>) => void;
  onLogout: () => void;
}

export const AssessmentTakingFullscreenPage: React.FC<AssessmentTakingFullscreenPageProps> = ({
  currentUser,
  topicName = 'Searching Algorithms',
  realQuestions,
  attemptId = 1,
  durationSeconds = 600, // 10 minutes default
  startedAt,
  onNavigate,
  onSubmitSession,
  onLogout,
}) => {
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const displayName = clerkUser?.firstName || clerkUser?.fullName || currentUser?.name || 'Learner';
  const avatarUrl = clerkUser?.imageUrl || currentUser?.avatarUrl;

  const handleProfileClick = () => {
    if (clerk && clerk.openUserProfile) {
      clerk.openUserProfile();
    }
  };

  const getGroundedFallbackQuestions = (topic: string): DisplayQuestion[] => {
    const isRest = /rest|api|http|endpoint|web\s*service/i.test(topic);
    if (isRest) {
      return [
        {
          id: 1,
          type: 'MCQ',
          topic,
          subtopic: 'HTTP Methods',
          difficulty: 'Medium',
          prompt: 'According to RFC 7231 HTTP specifications, which of the following HTTP methods is guaranteed to be idempotent?',
          options: [
            'POST',
            'PUT',
            'PATCH (without conditional headers)',
            'CONNECT',
          ],
        },
        {
          id: 2,
          type: 'CONCEPTUAL',
          topic,
          subtopic: 'REST Principles',
          difficulty: 'Medium',
          prompt: 'Explain why REST architecture mandates stateless communication between client and server, and analyze how this statelessness property enhances system scalability.',
          options: [],
        },
        {
          id: 3,
          type: 'MCQ',
          topic,
          subtopic: 'HTTP Status Codes',
          difficulty: 'Easy',
          prompt: 'Which HTTP status code should be returned by a REST API when a POST request successfully creates a new resource and includes a Location header pointing to it?',
          options: [
            '200 OK',
            '201 Created',
            '202 Accepted',
            '204 No Content',
          ],
        },
        {
          id: 4,
          type: 'DEBUGGING',
          topic,
          subtopic: 'Endpoint Design',
          difficulty: 'Medium',
          prompt: 'An API route is declared as "GET /api/users/delete?id=42". What key architectural violation exists in this route, and how should it be corrected to adhere to REST conventions?',
          options: [],
        },
      ];
    }

    const isSearch = /search|binary|linear/i.test(topic);
    if (isSearch) {
      return [
        {
          id: 1,
          type: 'MCQ',
          topic,
          subtopic: 'Linear Search',
          difficulty: 'Medium',
          prompt: 'What is the primary operational mechanism of a linear search algorithm when looking for a target value in a collection?',
          options: [
            'It checks each element in the collection sequentially from beginning to end until a match is found or the collection is exhausted.',
            'It divides the collection in half repeatedly until the target is isolated.',
            'It sorts the collection first and then performs a logarithmic probe.',
            'It hashes the elements to directly access the target memory location.',
          ],
        },
        {
          id: 2,
          type: 'CONCEPTUAL',
          topic,
          subtopic: 'Binary Search',
          difficulty: 'Medium',
          prompt: 'Explain why binary search requires array elements to be sorted beforehand and discuss its time complexity compared to linear search.',
          options: [],
        },
        {
          id: 3,
          type: 'MCQ',
          topic,
          subtopic: 'Time Complexity',
          difficulty: 'Easy',
          prompt: 'What is the best-case time complexity of Linear Search on an array of size N when the target is at the first index?',
          options: [
            'O(1)',
            'O(log N)',
            'O(N)',
            'O(N log N)',
          ],
        },
      ];
    }

    return [
      {
        id: 1,
        type: 'MCQ',
        topic,
        subtopic: 'Core Theory',
        difficulty: 'Medium',
        prompt: `What is the fundamental theoretical principle underlying ${topic}?`,
        options: [
          `Deterministic abstraction and standard algorithmic guarantees defined for ${topic}`,
          `Randomized nondeterministic execution without structural guarantees`,
          `Hardware-exclusive execution requiring kernel-level ring 0 permissions`,
          `Unbounded linear space scaling without asymptotic complexity bounds`,
        ],
      },
      {
        id: 2,
        type: 'CONCEPTUAL',
        topic,
        subtopic: 'System Architecture',
        difficulty: 'Medium',
        prompt: `Analyze the primary architectural and performance trade-offs encountered when deploying ${topic} in production systems.`,
        options: [],
      },
      {
        id: 3,
        type: 'SCENARIO',
        topic,
        subtopic: 'Diagnostics & Operations',
        difficulty: 'Hard',
        prompt: `In a high-throughput environment utilizing ${topic}, an engineer detects an unexpected bottleneck under peak load. What is the recommended diagnosis strategy?`,
        options: [
          'Inspect profiling metrics, analyze critical path complexity, and verify caching and concurrency boundaries',
          'Immediately restart all server clusters without reviewing telemetry',
          'Disable security middleware and remove request logging',
          'Switch to single-threaded sequential execution without benchmarking',
        ],
      },
    ];
  };

  const questions: DisplayQuestion[] = (realQuestions && realQuestions.length > 0)
    ? realQuestions.map((q, index) => ({
        id: q.id !== undefined ? q.id : index + 1,
        type: (q.type || 'MCQ').toUpperCase(),
        topic: topicName,
        subtopic: q.subtopic || 'General',
        difficulty: typeof q.difficulty === 'number'
          ? (q.difficulty > 0.7 ? 'Hard' : q.difficulty > 0.4 ? 'Medium' : 'Easy')
          : (q.difficulty || 'Medium'),
        prompt: q.question || q.prompt || 'Question prompt missing',
        options: Array.isArray(q.options) ? q.options : [],
      }))
    : getGroundedFallbackQuestions(topicName);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [autosaveStatus, setAutosaveStatus] = useState<string>('All changes saved');

  // REAL SERVER-SYNCHRONIZED TIMER
  const [remainingTime, setRemainingTime] = useState<number>(durationSeconds);
  const autosaveTimeoutRef = useRef<any>(null);

  // Restore attempt state on mount (Section 17 & 18: survive refresh)
  useEffect(() => {
    let isMounted = true;
    if (attemptId) {
      topicService.getAttempt(attemptId).then((data) => {
        if (!isMounted || !data || !data.attempt) return;
        const att = data.attempt;
        if (typeof att.remainingSeconds === 'number') {
          setRemainingTime(att.remainingSeconds);
        }
        if (att.savedAnswers && typeof att.savedAnswers === 'object') {
          setUserAnswers((prev) => ({ ...att.savedAnswers, ...prev }));
        }
      }).catch((err) => {
        console.warn('[AssessmentTaking] Could not restore server attempt state:', err);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  useEffect(() => {
    const startMs = startedAt ? new Date(startedAt).getTime() : Date.now();
    const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
    const initialRemaining = Math.max(0, durationSeconds - elapsedSeconds);
    setRemainingTime((prev) => (prev > initialRemaining ? initialRemaining : prev));

    const timerInterval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [startedAt, durationSeconds]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex] || questions[0];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isMcq = (currentQuestion.type || '').toUpperCase() === 'MCQ';
  const currentQIdStr = String(currentQuestion.id);
  const isCurrentFlagged = flaggedQuestions.has(currentQIdStr);

  const answeredCount = questions.filter(q => {
    const a = userAnswers[String(q.id)];
    return a && a.trim().length > 0;
  }).length;
  const unansweredCount = questions.length - answeredCount;
  const completionPercentage = Math.round((answeredCount / questions.length) * 100);

  // Autosave response helper (Section 18)
  const triggerAutosave = (questionId: string | number, answer: string) => {
    setAutosaveStatus('Saving...');
    topicService.saveResponse(attemptId || 1, questionId, answer)
      .then(() => setAutosaveStatus('All changes saved'))
      .catch((err) => {
        console.warn('Autosave server sync note:', err);
        setAutosaveStatus('All changes saved (local)');
      });
  };

  const handleOptionSelect = (optionText: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQIdStr]: optionText,
    }));
    triggerAutosave(currentQuestion.id, optionText);
  };

  const handleDescriptiveChange = (text: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQIdStr]: text,
    }));

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = setTimeout(() => {
      triggerAutosave(currentQuestion.id, text);
    }, 800);
  };

  const toggleFlagCurrent = () => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(currentQIdStr)) {
        next.delete(currentQIdStr);
      } else {
        next.add(currentQIdStr);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowSubmitConfirmModal(true);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleFinalSubmit = () => {
    setShowSubmitConfirmModal(false);
    setIsSubmitting(true);
    onSubmitSession(userAnswers);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19', color: '#ffffff' }}>
      <Sidebar
        currentPage="take_assessment"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1f293d', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                Attempt #{attemptId}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>•</span>
              <span style={{ fontSize: '0.82rem', color: autosaveStatus === 'Saving...' ? '#fbbf24' : '#10b981' }}>
                {autosaveStatus === 'Saving...' ? '⟳ Saving answer...' : '✓ ' + autosaveStatus}
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.3rem 0 0 0', color: '#ffffff' }}>
              {topicName} Assessment
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              onClick={handleProfileClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: '#111827',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #1f293d',
                cursor: 'pointer',
              }}
              title="View Clerk Profile"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div className="avatar-circle" style={{ width: '26px', height: '26px', fontSize: '0.8rem' }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>{displayName}</span>
            </div>
          </div>
        </div>

        {/* 3-Column Grid Layout (Section 16) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr) 280px',
          gap: '1.5rem',
          alignItems: 'start',
        }}>
          {/* LEFT: Question Navigator */}
          <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Question Navigator
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {questions.map((q, idx) => {
                const qIdStr = String(q.id);
                const isAns = Boolean(userAnswers[qIdStr] && userAnswers[qIdStr].trim().length > 0);
                const isCur = idx === currentIndex;
                const isFlag = flaggedQuestions.has(qIdStr);

                let bg = '#0b0f19';
                let borderColor = '#1f293d';
                let textColor = '#94a3b8';

                if (isCur) {
                  bg = 'rgba(56, 189, 248, 0.2)';
                  borderColor = '#38bdf8';
                  textColor = '#38bdf8';
                } else if (isFlag) {
                  bg = 'rgba(245, 158, 11, 0.2)';
                  borderColor = '#f59e0b';
                  textColor = '#fbbf24';
                } else if (isAns) {
                  bg = 'rgba(16, 185, 129, 0.2)';
                  borderColor = '#10b981';
                  textColor = '#34d399';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: `1.5px solid ${borderColor}`,
                      backgroundColor: bg,
                      color: textColor,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {idx + 1}
                    {isFlag && (
                      <span style={{ position: 'absolute', top: '-3px', right: '-2px', fontSize: '0.65rem' }}>🚩</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* States Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem', color: '#94a3b8', borderTop: '1px solid #1f293d', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                <span>Current</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                <span>Answered ({answeredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }} />
                <span>Unanswered ({unansweredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span>Flagged ({flaggedQuestions.size})</span>
              </div>
            </div>
          </div>

          {/* CENTER: Question Prompt & Answer Area */}
          <div className="glass-card" style={{ padding: '2rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px', minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #1f293d', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                  {currentQuestion.type}
                </span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>•</span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                  {currentQuestion.subtopic}
                </span>
              </div>

              <span style={{
                background: '#0b0f19',
                color: '#cbd5e1',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid #1f293d',
              }}>
                Difficulty: {String(currentQuestion.difficulty)}
              </span>
            </div>

            {/* Question Text */}
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.6, color: '#f8fafc', marginBottom: '1.75rem' }}>
              {currentQuestion.prompt}
            </h2>

            {/* Answer Area */}
            <div style={{ flex: 1 }}>
              {isMcq && currentQuestion.options && currentQuestion.options.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentQuestion.options.map((optText: string, idx: number) => {
                    const curAns = userAnswers[currentQIdStr];
                    const selected = curAns === optText;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleOptionSelect(optText)}
                        style={{
                          padding: '0.9rem 1.15rem',
                          borderRadius: '8px',
                          border: selected ? '2px solid #38bdf8' : '1px solid #1f293d',
                          backgroundColor: selected ? 'rgba(56, 189, 248, 0.12)' : '#0b0f19',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: selected ? '2px solid #38bdf8' : '2px solid #475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: selected ? '#38bdf8' : '#94a3b8',
                          flexShrink: 0,
                          backgroundColor: selected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        }}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: selected ? '#ffffff' : '#cbd5e1', lineHeight: 1.45 }}>
                          {optText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Enter your response below (autosaved to database):
                  </label>
                  <textarea
                    rows={8}
                    placeholder="Provide your solution or explanation in detail..."
                    value={userAnswers[currentQIdStr] || ''}
                    onChange={(e) => handleDescriptiveChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      borderRadius: '8px',
                      backgroundColor: '#0b0f19',
                      border: '1px solid #1f293d',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Assessment Information, Timer, Progress & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Timer Card */}
            <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Time Remaining
              </div>
              <div style={{
                background: remainingTime <= 60 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.1)',
                border: remainingTime <= 60 ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.3)',
                color: remainingTime <= 60 ? '#f87171' : '#38bdf8',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '1.4rem',
                fontWeight: 800,
                textAlign: 'center',
                letterSpacing: '0.05em',
              }}>
                ⏱️ {formatTime(remainingTime)}
              </div>
              {remainingTime <= 60 && (
                <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.4rem', textAlign: 'center', fontWeight: 600 }}>
                  ⚠️ Less than 1 minute remaining!
                </div>
              )}
            </div>

            {/* Progress Card */}
            <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>
                <span>Progress</span>
                <span style={{ color: '#38bdf8' }}>Question {currentIndex + 1} of {questions.length}</span>
              </div>
              <div style={{ height: '8px', width: '100%', backgroundColor: '#0b0f19', borderRadius: '4px', overflow: 'hidden', border: '1px solid #1f293d', marginBottom: '0.75rem' }}>
                <div style={{ height: '100%', width: `${completionPercentage}%`, backgroundColor: '#38bdf8', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                <span>{answeredCount} answered</span>
                <span>{completionPercentage}% complete</span>
              </div>
            </div>

            {/* Action Controls Card (Section 16: Previous, Next, Flag, Submit) */}
            <div className="glass-card" style={{ padding: '1.25rem', backgroundColor: '#111827', border: '1px solid #1f293d', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={currentIndex === 0}
                  onClick={handlePrev}
                  style={{
                    padding: '0.65rem',
                    fontSize: '0.85rem',
                    opacity: currentIndex === 0 ? 0.4 : 1,
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={currentIndex === questions.length - 1}
                  onClick={handleNext}
                  style={{
                    padding: '0.65rem',
                    fontSize: '0.85rem',
                    opacity: currentIndex === questions.length - 1 ? 0.4 : 1,
                    cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next →
                </button>
              </div>

              {/* Flag button */}
              <button
                type="button"
                onClick={toggleFlagCurrent}
                style={{
                  padding: '0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: isCurrentFlagged ? '1px solid #f59e0b' : '1px solid #1f293d',
                  backgroundColor: isCurrentFlagged ? 'rgba(245, 158, 11, 0.15)' : '#0b0f19',
                  color: isCurrentFlagged ? '#fbbf24' : '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                {isCurrentFlagged ? '🚩 Flagged for Review' : '⚐ Flag Question'}
              </button>

              {/* Submit Assessment Button */}
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowSubmitConfirmModal(true)}
                style={{
                  padding: '0.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                }}
              >
                Submit Assessment ✓
              </button>
            </div>
          </div>
        </div>

        {/* Submission Confirmation Modal (Section 19) */}
        {showSubmitConfirmModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div className="glass-card" style={{ maxWidth: '460px', width: '90%', padding: '2rem', backgroundColor: '#0f172a', border: '1px solid #1f293d', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, marginBottom: '0.75rem', color: '#ffffff' }}>
                Submit Assessment?
              </h3>
              <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                You answered <strong>{answeredCount} of {questions.length}</strong> questions.
              </p>
              {unansweredCount > 0 ? (
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '0.75rem', color: '#fbbf24', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  ⚠️ {unansweredCount} question{unansweredCount > 1 ? 's' : ''} remain unanswered. Unanswered questions will receive zero credit.
                </div>
              ) : (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '0.75rem', color: '#34d399', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  ✓ All {questions.length} questions have been answered.
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowSubmitConfirmModal(false)}
                >
                  Continue Assessment
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
                >
                  {isSubmitting ? 'Evaluating...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AssessmentTakingFullscreenPage;
