import React, { useState, useEffect } from 'react';
import { PublicAssessment, PublicAssessmentQuestion } from '../types/attempt';
import { topicService } from '../services/topicService';
import { AssessmentResultsView } from './AssessmentResultsView';
import { CodeEditorIde } from './CodeEditorIde';

interface AssessmentTakingViewProps {
  assessmentId: number;
  initialAssessment?: PublicAssessment | null;
  onExit?: () => void;
}

export const AssessmentTakingView: React.FC<AssessmentTakingViewProps> = ({
  assessmentId,
  initialAssessment,
  onExit,
}) => {
  const [currentAssessmentId, setCurrentAssessmentId] = useState<number>(assessmentId);
  const [assessment, setAssessment] = useState<PublicAssessment | null>(initialAssessment || null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(!initialAssessment);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showResultsView, setShowResultsView] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunningCode, setIsRunningCode] = useState<boolean>(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState<boolean>(false);
  const [codeExecutionResults, setCodeExecutionResults] = useState<Record<string, any>>({});

  useEffect(() => {
    setCurrentAssessmentId(assessmentId);
  }, [assessmentId]);

  // Initialize assessment and attempt
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. Fetch assessment
        let loadedAssessment = initialAssessment || assessment;
        if (!loadedAssessment || !loadedAssessment.questions || loadedAssessment.questions.length === 0 || loadedAssessment.id !== currentAssessmentId) {
          try {
            const res = await topicService.getAssessment(currentAssessmentId);
            if (res.assessment && res.assessment.questions && res.assessment.questions.length > 0) {
              loadedAssessment = res.assessment;
              if (isMounted) setAssessment(loadedAssessment);
            }
          } catch (fetchErr: any) {
            console.warn('Backend fetch assessment failed, using local/initial assessment:', fetchErr);
            if (!loadedAssessment) {
              throw fetchErr;
            }
          }
        }
        if (isMounted && loadedAssessment) {
          setAssessment(loadedAssessment);
        }

        // 2. Start attempt
        try {
          const startRes = await topicService.startAttempt(currentAssessmentId);
          if (isMounted) setAttemptId(startRes.attemptId);
        } catch (startErr: any) {
          console.warn('Backend startAttempt failed, using local attempt session:', startErr);
          if (isMounted) setAttemptId(Date.now());
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to initialize assessment:', err);
          setErrorMessage(err.message || 'Failed to load assessment.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [currentAssessmentId]);

  if (loading) {
    return (
      <div className="taking-container">
        <div className="taking-loading">
          <div className="spinner" />
          <p>Loading assessment questions and initializing session...</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !assessment) {
    return (
      <div className="taking-container">
        <div className="taking-error-card">
          <h3>⚠️ Unable to Load Assessment</h3>
          <p>{errorMessage}</p>
          {onExit && (
            <button type="button" className="submit-btn" onClick={onExit} style={{ marginTop: '1rem' }}>
              Return to Assessments
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!assessment || assessment.questions.length === 0) {
    return (
      <div className="taking-container">
        <p>No questions found for this assessment.</p>
        {onExit && (
          <button type="button" className="submit-btn" onClick={onExit}>
            Go Back
          </button>
        )}
      </div>
    );
  }

  const currentQ: PublicAssessmentQuestion = assessment.questions[currentIndex];
  const totalQuestions = assessment.questions.length;
  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] !== undefined && answers[k].trim() !== ''
  ).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handleAnswerChange = (qId: string | number, value: string) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({
      ...prev,
      [String(qId)]: value,
    }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handlePaletteClick = (idx: number) => {
    setCurrentIndex(idx);
  };

  const handleSubmit = async () => {
    if (!attemptId) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formattedResponses = assessment.questions.map((q) => ({
        questionId: q.id,
        answer: answers[String(q.id)]?.trim() || null,
      }));

      await topicService.submitAttempt(attemptId, formattedResponses);
      setIsSubmitted(true);
      setShowConfirmModal(false);
    } catch (err: any) {
      console.error('Failed to submit assessment:', err);
      setErrorMessage(err.message || 'Failed to submit responses.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunCode = async (questionId: number | string, code: string) => {
    if (!attemptId) return;
    setIsRunningCode(true);
    setErrorMessage(null);
    try {
      const result = await topicService.runCode(attemptId, {
        questionId,
        language: 'cpp',
        code,
      });
      setCodeExecutionResults((prev) => ({
        ...prev,
        [String(questionId)]: { mode: 'run', ...result },
      }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to run code in sandbox.');
    } finally {
      setIsRunningCode(false);
    }
  };

  const handleSubmitCodeSolution = async (questionId: number | string, code: string) => {
    if (!attemptId) return;
    setIsSubmittingCode(true);
    setErrorMessage(null);
    try {
      const result = await topicService.submitCode(attemptId, {
        questionId,
        language: 'cpp',
        code,
      });
      setCodeExecutionResults((prev) => ({
        ...prev,
        [String(questionId)]: { mode: 'submit', ...result },
      }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit code for evaluation.');
    } finally {
      setIsSubmittingCode(false);
    }
  };

  const handleStartAdaptiveAssessment = (newId: number) => {
    setCurrentAssessmentId(newId);
    setAssessment(null);
    setAttemptId(null);
    setIsSubmitted(false);
    setShowResultsView(false);
    setAnswers({});
    setCurrentIndex(0);
  };

  // Render Submission Confirmation View (Post-Submission)
  if (isSubmitted) {
    if (showResultsView && attemptId) {
      return (
        <AssessmentResultsView
          attemptId={attemptId}
          topicId={assessment?.topicId}
          onStartAdaptiveAssessment={handleStartAdaptiveAssessment}
          onExit={onExit}
        />
      );
    }

    return (
      <div className="taking-container">
        <div className="submission-success-card">
          <div className="success-icon">🎉</div>
          <h2>Assessment Submitted!</h2>
          <p className="success-lead">
            Your responses have been securely recorded.
          </p>
          <div className="submission-summary-box">
            <div className="summary-row">
              <span>Assessment Topic:</span>
              <strong>{assessment.topicName || 'Computer Science'}</strong>
            </div>
            <div className="summary-row">
              <span>Questions Answered:</span>
              <strong>{answeredCount} of {totalQuestions}</strong>
            </div>
            <div className="summary-row">
              <span>Attempt Reference:</span>
              <code>Attempt #{attemptId}</code>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '420px', margin: '1.5rem auto 0 auto' }}>
            <button
              type="button"
              className="confirm-btn"
              onClick={() => setShowResultsView(true)}
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: '1.05rem',
                backgroundColor: '#7c3aed',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
                cursor: 'pointer',
              }}
            >
              📊 View Performance Analysis & Skill Profile
            </button>

            {onExit && (
              <button
                type="button"
                className="submit-btn"
                onClick={onExit}
                style={{ width: '100%', backgroundColor: '#64748b' }}
              >
                Return to Pipeline Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }


  const currentAnswer = answers[String(currentQ.id)] || '';
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="taking-container">
      {/* Assessment Header */}
      <div className="taking-header">
        <div className="taking-header-meta">
          <h2 className="taking-topic-title">
            📝 {assessment.topicName || 'Assessment'}
          </h2>
          <span className="taking-counter">
            Question <strong>{currentIndex + 1}</strong> of <strong>{totalQuestions}</strong>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="taking-progress-wrapper">
          <div className="taking-progress-info">
            <span>Progress: {answeredCount} / {totalQuestions} answered</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="taking-progress-track">
            <div
              className="taking-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="taking-error-banner">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Main Question Workspace */}
      <div className="taking-workspace">
        <div className="question-card active-question-card">
          <div className="question-header">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="order-badge">Question {currentIndex + 1}</span>
              <span className={`question-type-badge ${currentQ.type.toLowerCase()}`}>
                {currentQ.type.replace('_', ' ')}
              </span>
              <span className="subtopic-tag">{currentQ.subtopic}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="difficulty-badge">Diff: {currentQ.difficulty.toFixed(2)}</span>
              {currentQ.estimatedTimeSeconds && (
                <span className="time-badge">⏱ ~{currentQ.estimatedTimeSeconds}s</span>
              )}
            </div>
          </div>

          <div className="taking-question-prompt">
            {currentQ.question}
          </div>

          {currentQ.scenarioText && (
            <div className="taking-scenario-box">
              <strong>Scenario:</strong> {currentQ.scenarioText}
            </div>
          )}

          {currentQ.codeSnippet && (
            <div className="taking-code-box">
              <pre>
                <code>{currentQ.codeSnippet}</code>
              </pre>
            </div>
          )}

          {/* Answer Input depending on Question Type */}
          <div className="taking-answer-section">
            <label className="answer-section-label">
              <strong>Your Answer:</strong>
            </label>

            {/* MCQ Input */}
            {currentQ.type === 'MCQ' && currentQ.options && (
              <div className="mcq-options-container">
                {currentQ.options.map((option, optIdx) => {
                  const isSelected = currentAnswer === option;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      className={`mcq-option-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAnswerChange(currentQ.id, option)}
                    >
                      <span className="mcq-radio-circle">
                        {isSelected && <span className="mcq-radio-dot" />}
                      </span>
                      <span className="mcq-option-text">{option}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Conceptual Input */}
            {currentQ.type === 'CONCEPTUAL' && (
              <textarea
                className="taking-textarea"
                rows={5}
                placeholder="Explain your understanding and conceptual reasoning..."
                value={currentAnswer}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
              />
            )}

            {/* Output Prediction Input */}
            {currentQ.type === 'OUTPUT_PREDICTION' && (
              <textarea
                className="taking-textarea"
                rows={4}
                placeholder="Type the exact output or log emitted by the snippet above..."
                value={currentAnswer}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
              />
            )}

            {/* Debugging Input */}
            {currentQ.type === 'DEBUGGING' && (
              <textarea
                className="taking-textarea"
                rows={5}
                placeholder="Describe the bug or bug cause, and propose a concise fix..."
                value={currentAnswer}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
              />
            )}

            {/* Scenario Input */}
            {currentQ.type === 'SCENARIO' && (
              <textarea
                className="taking-textarea"
                rows={5}
                placeholder="Describe your design or solution for this scenario..."
                value={currentAnswer}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
              />
            )}

            {/* Coding Input (Trial 13 & Interactive Code IDE Upgrade) */}
            {currentQ.type === 'CODING' && (
              <CodeEditorIde
                questionId={currentQ.id}
                initialCode={currentQ.starterCode}
                starterCode={currentQ.starterCode}
                constraints={currentQ.constraints}
                sampleTestCases={currentQ.sampleTestCases}
                currentAnswer={currentAnswer}
                executionResult={codeExecutionResults[String(currentQ.id)]}
                isRunning={isRunningCode}
                isSubmitting={isSubmittingCode}
                onCodeChange={(newCode) => handleAnswerChange(currentQ.id, newCode)}
                onRunCode={(codeToRun) => handleRunCode(currentQ.id, codeToRun)}
                onSubmitCode={(codeToSubmit) => handleSubmitCodeSolution(currentQ.id, codeToSubmit)}
              />
            )}
          </div>
        </div>

        {/* Question Palette Navigator */}
        <div className="taking-palette-card">
          <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.95rem' }}>
            Question Navigator
          </h4>
          <div className="palette-grid">
            {assessment.questions.map((q, idx) => {
              const hasAnswer = answers[String(q.id)] && answers[String(q.id)].trim() !== '';
              const isCurrent = idx === currentIndex;
              let stateClass = 'unanswered';
              if (hasAnswer) stateClass = 'answered';
              if (isCurrent) stateClass = 'current';

              return (
                <button
                  key={q.id}
                  type="button"
                  className={`palette-btn ${stateClass}`}
                  onClick={() => handlePaletteClick(idx)}
                  title={`Question ${idx + 1}: ${hasAnswer ? 'Answered' : 'Unanswered'}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="palette-legend">
            <div className="legend-item">
              <span className="legend-swatch current" />
              <span>Current</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch answered" />
              <span>Answered</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch unanswered" />
              <span>Unanswered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation Controls */}
      <div className="taking-nav-footer">
        <button
          type="button"
          className="submit-btn"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{ backgroundColor: '#64748b' }}
        >
          ← Previous
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="submit-btn"
            onClick={() => setShowConfirmModal(true)}
            style={{ backgroundColor: '#10b981' }}
          >
            Submit Assessment
          </button>

          <button
            type="button"
            className="submit-btn"
            onClick={handleNext}
            disabled={currentIndex === totalQuestions - 1}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Submission Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="confirm-dialog-card">
            <h3>Submit Assessment</h3>

            {unansweredCount > 0 ? (
              <p>
                You have answered <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong> questions.
                <br />
                <span style={{ color: '#dc2626' }}>
                  ⚠️ {unansweredCount} {unansweredCount === 1 ? 'question is' : 'questions are'} unanswered.
                </span>
                <br />
                Are you sure you want to submit?
              </p>
            ) : (
              <p>
                You have answered all <strong>{totalQuestions}</strong> questions.
                <br />
                Ready to submit your assessment?
              </p>
            )}

            <div className="confirm-actions">
              <button
                type="button"
                className="submit-btn"
                style={{ backgroundColor: '#94a3b8' }}
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-btn"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ backgroundColor: '#10b981' }}
              >
                {submitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
