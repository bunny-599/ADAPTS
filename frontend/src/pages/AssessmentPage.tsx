import React, { useState, useEffect, FormEvent } from 'react';
import {
  Topic,
  TopicAnalysisResult,
  StructuredTopic,
  ClarificationRequired,
  InvalidTopic,
  isStructuredTopic,
  isClarification,
  isInvalidTopic,
} from '../types/topic';
import { topicService } from '../services/topicService';
import { authService } from '../services/authService';
import { User } from '../types/auth';
import { AssessmentTakingView } from '../components/AssessmentTakingView';
import { PublicAssessment } from '../types/attempt';

export const AssessmentPage: React.FC = () => {
  const [topicInput, setTopicInput] = useState<string>('');
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [isFetchingList, setIsFetchingList] = useState<boolean>(false);
  const [showAnswerKeys, setShowAnswerKeys] = useState<boolean>(false);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [authRole, setAuthRole] = useState<'student' | 'instructor'>('student');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<TopicAnalysisResult | null>(null);
  const [analyzedInputText, setAnalyzedInputText] = useState<string>('');

  // Persisted state
  const [savedTopic, setSavedTopic] = useState<Topic | null>(null);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Research state
  const [researching, setResearching] = useState<boolean>(false);
  const [researchResult, setResearchResult] = useState<import('../types/research').ResearchResult | null>(null);

  // Question generation state (Trial 5)
  const [generatingQuestions, setGeneratingQuestions] = useState<boolean>(false);
  const [questionResult, setQuestionResult] = useState<import('../types/question').GenerateQuestionsResponse | null>(null);

  // Question validation state (Trial 6)
  const [validatingQuestions, setValidatingQuestions] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<import('../types/validation').ValidateQuestionPoolResponse | null>(null);
  const [selectedValidationTab, setSelectedValidationTab] = useState<'VALID' | 'FLAGGED' | 'INVALID'>('VALID');

  // Assessment optimization state (Trial 7)
  const [optimizingAssessment, setOptimizingAssessment] = useState<boolean>(false);
  const [optimizedAssessment, setOptimizedAssessment] = useState<import('../types/assessment').OptimizeAssessmentResponse | null>(null);
  const [targetQuestionCount, setTargetQuestionCount] = useState<number>(5);
  const [targetDifficulty, setTargetDifficulty] = useState<number>(0.5);
  const [includeFlaggedInOptimizer, setIncludeFlaggedInOptimizer] = useState<boolean>(true);

  // Quick Revision state (Trial 13.1)
  const [quickRevisionResult, setQuickRevisionResult] = useState<import('../types/revision').QuickRevisionResult | null>(null);
  const [preparingAssessment, setPreparingAssessment] = useState<boolean>(false);
  const [showDebugMode, setShowDebugMode] = useState<boolean>(false);

  // Assessment taking state (Trial 8)
  const [activeTakingAssessmentId, setActiveTakingAssessmentId] = useState<number | null>(null);


  useEffect(() => {
    fetchTopicsList();
    authService.getMe().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authTab === 'login') {
        const res = await authService.login({ email: authEmail, password: authPassword });
        setCurrentUser(res.user);
        setShowAuthModal(false);
        setStatusMessage({ type: 'success', text: `Welcome back, ${res.user.name}!` });
      } else {
        const res = await authService.register({
          email: authEmail,
          password: authPassword,
          name: authName,
          role: authRole,
        });
        setCurrentUser(res.user);
        setShowAuthModal(false);
        setStatusMessage({ type: 'success', text: `Account created successfully! Welcome, ${res.user.name}.` });
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    authService.clearAuth();
    setCurrentUser(null);
    setStatusMessage({ type: 'success', text: 'You have been signed out.' });
  };



  const handleGenerateQuestions = async () => {
    if (!savedTopic && !researchResult) return;

    setGeneratingQuestions(true);
    setStatusMessage(null);
    setValidationResult(null);
    setOptimizedAssessment(null);

    try {
      const response = await topicService.generateQuestions({
        topicId: savedTopic?.id,
        researchRunId: researchResult?.sessionId,
        topicTitle: savedTopic?.topic || analyzedInputText || 'Computer Science Topic',
        knowledgeItems: researchResult?.knowledge,
        count: 10,
      });

      setQuestionResult(response);
      setStatusMessage({
        type: 'success',
        text: `Successfully generated ${response.generatedCount} candidate questions across ${Object.keys(response.distribution).length} types!`,
      });
    } catch (err: any) {
      console.error('Failed to generate questions:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to generate questions: ${err.message || 'LLM service unavailable'}`,
      });
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleValidateQuestions = async () => {
    if (!questionResult || questionResult.questions.length === 0) return;

    setValidatingQuestions(true);
    setStatusMessage(null);

    try {
      const response = await topicService.validateQuestions({
        topicId: savedTopic?.id,
        researchRunId: researchResult?.sessionId,
        questions: questionResult.questions,
      });

      setValidationResult(response);
      const totalAvailable = response.summary.validCount + response.summary.flaggedCount;
      if (totalAvailable > 0) {
        // Auto-set sensible default target count (5 or total available if fewer)
        setTargetQuestionCount(Math.min(10, Math.max(totalAvailable >= 5 ? 5 : 1, totalAvailable)));
      }
      setStatusMessage({
        type: 'success',
        text: `Validation Engine complete! ${response.summary.validCount} Valid, ${response.summary.flaggedCount} Flagged, ${response.summary.invalidCount} Invalid.`,
      });
    } catch (err: any) {
      console.error('Failed to validate questions:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to validate questions: ${err.message || 'Validation service error'}`,
      });
    } finally {
      setValidatingQuestions(false);
    }
  };

  const handleOptimizeAssessment = async () => {
    if (!validationResult) return;

    const pool = (includeFlaggedInOptimizer
      ? [...validationResult.validQuestions, ...validationResult.flaggedQuestions]
      : validationResult.validQuestions
    ).map((v) => v.question);

    if (pool.length === 0) return;

    setOptimizingAssessment(true);
    setStatusMessage(null);

    try {
      const response = await topicService.optimizeAssessment({
        topicId: savedTopic?.id,
        researchRunId: researchResult?.sessionId,
        targetQuestionCount,
        targetDifficulty,
        questions: pool,
      });

      setOptimizedAssessment(response);
      setStatusMessage({
        type: 'success',
        text: `Genetic Algorithm completed! Optimized ${response.questionCount}-question assessment created (Fitness: ${response.fitness.toFixed(2)}).`,
      });
    } catch (err: any) {
      console.error('Failed to optimize assessment:', err);
      setStatusMessage({
        type: 'error',
        text: `Optimization error: ${err.message || 'Error executing Genetic Algorithm'}`,
      });
    } finally {
      setOptimizingAssessment(false);
    }
  };


  const fetchTopicsList = async () => {
    setIsFetchingList(true);
    try {
      const data = await topicService.getTopics();
      setAllTopics(data);
    } catch (error: any) {
      console.error('Failed to load topic history:', error);
    } finally {
      setIsFetchingList(false);
    }
  };

  const handleAnalyze = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = topicInput.trim();
    if (!trimmed) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter what you learned before continuing.',
      });
      return;
    }

    setAnalyzing(true);
    setStatusMessage(null);
    setAnalysisResult(null);
    setResearchResult(null);

    try {
      const result = await topicService.analyzeTopic(trimmed);
      setAnalysisResult(result);
      setAnalyzedInputText(trimmed);
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'Failed to analyze topic.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectClarification = (optionText: string) => {
    const updatedInput = `I learned ${optionText}`;
    setTopicInput(updatedInput);
    setAnalysisResult(null);
    setResearchResult(null);
  };

  const handleConfirmTopic = async () => {
    if (!analysisResult || isClarification(analysisResult) || isInvalidTopic(analysisResult)) return;

    setSaving(true);
    setStatusMessage(null);
    setResearchResult(null);
    setQuestionResult(null);
    setValidationResult(null);
    setOptimizedAssessment(null);
    setQuickRevisionResult(null);

    const structured = analysisResult as StructuredTopic;

    try {
      // 1. Save Topic to PostgreSQL
      setStatusMessage({
        type: 'success',
        text: 'Understanding your topic...',
      });

      const created = await topicService.createTopic({
        input: analyzedInputText,
        field: structured.field,
        domain: structured.domain,
        topic: structured.topic,
        subtopics: structured.subtopics,
      });

      setSavedTopic(created);
      setTopicInput('');
      setAnalyzedInputText('');
      fetchTopicsList();

      // 2. Web Research
      setResearching(true);
      setStatusMessage({
        type: 'success',
        text: 'Researching reliable sources...',
      });

      let researchData: import('../types/research').ResearchResult | null = null;
      try {
        researchData = await topicService.researchTopic({
          id: created.id,
          field: structured.field,
          domain: structured.domain,
          topic: structured.topic,
          subtopics: structured.subtopics,
        });
        setResearchResult(researchData);
      } catch (researchErr: any) {
        console.warn('Web research step warning:', researchErr);
      } finally {
        setResearching(false);
      }

      // 3. Internal Assessment Preparation (Quick Revision + Candidate Generation + Validation + GA Optimization)
      setPreparingAssessment(true);
      setStatusMessage({
        type: 'success',
        text: 'Preparing your assessment...',
      });

      try {
        // 3a. Quick Revision
        const revRes = await topicService.getQuickRevision({
          topicId: created.id,
          topicTitle: structured.topic,
          knowledgeItems: researchData?.knowledge,
        });
        if (revRes && revRes.revision) {
          setQuickRevisionResult(revRes.revision);
        }

        // 3b. Internal Question Generation
        const genRes = await topicService.generateQuestions({
          topicId: created.id,
          researchRunId: researchData?.sessionId,
          topicTitle: structured.topic,
          knowledgeItems: researchData?.knowledge,
          count: 10,
        });
        setQuestionResult(genRes);

        // 3c. Internal Question Validation
        const valRes = await topicService.validateQuestions({
          topicId: created.id,
          researchRunId: researchData?.sessionId,
          questions: genRes.questions,
        });
        setValidationResult(valRes);

        // 3d. Internal Genetic Algorithm Assessment Optimization
        const usablePool = [...valRes.validQuestions, ...valRes.flaggedQuestions].map((v) => v.question);
        const optRes = await topicService.optimizeAssessment({
          topicId: created.id,
          researchRunId: researchData?.sessionId,
          targetQuestionCount: Math.min(5, Math.max(1, valRes.summary.validCount || 5)),
          targetDifficulty: 0.5,
          questions: usablePool.length > 0 ? usablePool : undefined,
        });
        setOptimizedAssessment(optRes);

        setStatusMessage({
          type: 'success',
          text: 'Assessment ready!',
        });
      } catch (prepErr: any) {
        console.error('Internal assessment preparation error:', prepErr);
        setStatusMessage({
          type: 'error',
          text: `Assessment preparation error: ${prepErr.message || 'Failed to prepare assessment'}`,
        });
      } finally {
        setPreparingAssessment(false);
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'An error occurred while confirming the topic.',
      });
    } finally {
      setSaving(false);
    }
  };


  if (activeTakingAssessmentId) {
    const initialAssessmentData: PublicAssessment | null = optimizedAssessment ? {
      id: optimizedAssessment.assessmentId || activeTakingAssessmentId,
      topicId: optimizedAssessment.topicId || 1,
      topicName: 'Computer Science Assessment',
      questionCount: optimizedAssessment.questions.length,
      targetDifficulty: optimizedAssessment.targetDifficulty,
      questions: optimizedAssessment.questions.map((q, idx) => ({
        id: q.id || idx + 1,
        order: q.order || idx + 1,
        type: q.type as any,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        subtopic: q.subtopic,
        concept: q.concept,
        codeSnippet: q.codeSnippet,
        scenarioText: q.scenarioText,
        estimatedTimeSeconds: q.estimatedTimeSeconds || 60,
        language: q.type === 'CODING' ? 'cpp' : undefined,
        starterCode: (q as any).starterCode,
        constraints: (q as any).constraints,
        sampleTestCases: (q as any).sampleTestCases,
      })),
    } : null;

    return (
      <div className="container" style={{ maxWidth: '840px' }}>
        <AssessmentTakingView
          assessmentId={activeTakingAssessmentId}
          initialAssessment={initialAssessmentData}
          onExit={() => setActiveTakingAssessmentId(null)}
        />
      </div>
    );
  }

  return (
    <div className="container">
      {/* Top Header Bar with Auth & Production Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0',
        marginBottom: '1.25rem',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            background: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #bae6fd'
          }}>
            ⚡ Production Grade
          </span>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Adaptive Assessment Platform</span>
        </div>

        <div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.88rem', color: '#1e293b', fontWeight: 600 }}>
                👤 {currentUser.name}{' '}
                <span style={{
                  fontSize: '0.72rem',
                  color: '#0284c7',
                  background: '#f0f9ff',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  border: '1px solid #e0f2fe',
                  textTransform: 'capitalize'
                }}>
                  {currentUser.role}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.75rem',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              style={{
                fontSize: '0.85rem',
                padding: '0.45rem 1rem',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
          padding: '1rem',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            maxWidth: '420px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            color: '#0f172a',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setAuthError(null); }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: authTab === 'login' ? '#2563eb' : '#f1f5f9',
                    color: authTab === 'login' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setAuthError(null); }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: authTab === 'register' ? '#2563eb' : '#f1f5f9',
                    color: authTab === 'register' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Create Account
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.2rem'
                }}
              >
                ✕
              </button>
            </div>

            {authError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {authTab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#475569', marginBottom: '0.3rem', fontWeight: 500 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Ada Lovelace"
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#475569', marginBottom: '0.3rem', fontWeight: 500 }}>Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="ada@example.com"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#475569', marginBottom: '0.3rem', fontWeight: 500 }}>Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {authTab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#475569', marginBottom: '0.3rem', fontWeight: 500 }}>Role</label>
                  <select
                    value={authRole}
                    onChange={(e) => setAuthRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="student">Student / Learner</option>
                    <option value="instructor">Instructor / Evaluator</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: authLoading ? 'not-allowed' : 'pointer',
                  opacity: authLoading ? 0.7 : 1,
                }}
              >
                {authLoading ? 'Authenticating...' : (authTab === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>
          </div>
        </div>
      )}

      <h1>Learn It. Test It. Prove It.</h1>
      <h2>What did you learn?</h2>

      {statusMessage && (
        <div className={`message ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Input and Analyze Form */}
      <form onSubmit={handleAnalyze} className="form-group">
        <input
          type="text"
          className="input-field"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder="I learned Binary Search Trees"
          disabled={analyzing || saving}
        />
        <button
          type="submit"
          className="submit-btn"
          disabled={analyzing || saving}
        >
          {analyzing ? 'Understanding your topic...' : 'Analyze Topic'}
        </button>
      </form>

      {/* Invalid / Non-CS Topic View */}
      {analysisResult && isInvalidTopic(analysisResult) && (
        <div className="message error">
          <strong>Non-Computer Science Topic:</strong> {(analysisResult as InvalidTopic).message}
        </div>
      )}

      {/* Clarification Required View */}
      {analysisResult && isClarification(analysisResult) && (
        <div className="clarification-card">
          <h3 className="clarification-title">Clarification Needed</h3>
          <p>{(analysisResult as ClarificationRequired).message}</p>
          <div className="clarification-options">
            {(analysisResult as ClarificationRequired).options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                className="option-chip"
                onClick={() => handleSelectClarification(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Structured Topic Analysis Result */}
      {analysisResult && isStructuredTopic(analysisResult) && (
        <div className="analysis-card">
          <div className="analysis-header">We understood your topic as:</div>

          <div className="analysis-meta-grid">
            <div className="meta-item">
              <div className="meta-label">Field</div>
              <div className="meta-val">{(analysisResult as StructuredTopic).field}</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">Domain</div>
              <div className="meta-val">{(analysisResult as StructuredTopic).domain}</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">Topic</div>
              <div className="meta-val">{(analysisResult as StructuredTopic).topic}</div>
            </div>
          </div>

          <div className="subtopics-title">Subtopics</div>
          <ul className="subtopics-list">
            {(analysisResult as StructuredTopic).subtopics.map((sub, idx) => (
              <li key={idx} className="subtopic-badge">
                <span className="check">✓</span>
                <span>{sub}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="confirm-btn"
            onClick={handleConfirmTopic}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Confirm Topic'}
          </button>
        </div>
      )}

      {/* Researching / Preparing progress indicator */}
      {(researching || preparingAssessment) && (
        <div className="message" style={{ backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
          <strong>{researching ? 'Researching reliable sources...' : 'Preparing your assessment...'}</strong> Gathering verified knowledge and optimizing your adaptive assessment.
        </div>
      )}

      {/* Normal Learner Flow Card (Trial 13.1) */}
      {(quickRevisionResult || optimizedAssessment) && (
        <div style={{
          marginTop: '1.5rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
            Adaptive Assessment
          </h2>

          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#2563eb', marginBottom: '1.25rem' }}>
            Topic: {savedTopic?.topic || (analysisResult as StructuredTopic)?.topic || researchResult?.topic || 'Computer Science Topic'}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.5rem'
          }}>
            <div style={{ color: '#166534', fontWeight: 600, fontSize: '0.95rem' }}>✓ Topic understood</div>
            <div style={{ color: '#166534', fontWeight: 600, fontSize: '0.95rem' }}>✓ Research completed</div>
            <div style={{ color: '#166534', fontWeight: 600, fontSize: '0.95rem' }}>✓ Assessment prepared</div>
          </div>

          {/* Quick Revision Section */}
          {quickRevisionResult && quickRevisionResult.points.length > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: 700 }}>
                Quick Revision
              </h3>
              <ul style={{ listStyleType: 'none', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: 0 }}>
                {quickRevisionResult.points.map((pt, idx) => (
                  <li key={idx} style={{
                    background: '#ffffff',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}>
                    • {pt.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Start Assessment Button */}
          {optimizedAssessment && (
            <button
              type="button"
              className="confirm-btn"
              onClick={() => setActiveTakingAssessmentId(optimizedAssessment.assessmentId || Date.now())}
              style={{
                width: '100%',
                padding: '0.95rem',
                fontSize: '1.1rem',
                fontWeight: 700,
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              Start Assessment
            </button>
          )}
        </div>
      )}

      {/* Developer / Instructor Debug View Toggle */}
      {(questionResult || validationResult || optimizedAssessment) && (
        <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setShowDebugMode(!showDebugMode)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.82rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
          >
            {showDebugMode ? '🔒 Hide Internal Candidate Pool & GA Diagnostics' : '🛠️ Instructor / Developer Debug View'}
          </button>
        </div>
      )}

      {/* Internal Candidate Pool & GA Diagnostics (Developer-only) */}
      {showDebugMode && (
        <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>🛠️ Developer / Instructor Debug Control Panel</h3>
            <button
              type="button"
              onClick={() => setShowAnswerKeys(!showAnswerKeys)}
              style={{
                fontSize: '0.82rem',
                padding: '0.35rem 0.75rem',
                background: showAnswerKeys ? '#fef3c7' : '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: showAnswerKeys ? '#92400e' : '#475569',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showAnswerKeys ? '🔒 Hide Answers' : '👁️ Show Answer Keys'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="submit-btn"
              onClick={handleGenerateQuestions}
              disabled={generatingQuestions || (!savedTopic && !researchResult)}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              {generatingQuestions ? 'Generating...' : 'Re-generate Candidate Pool'}
            </button>
            <button
              type="button"
              className="confirm-btn"
              onClick={handleValidateQuestions}
              disabled={validatingQuestions || !questionResult}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', backgroundColor: '#4f46e5' }}
            >
              {validatingQuestions ? 'Validating...' : 'Re-run Question Validation'}
            </button>
            <button
              type="button"
              className="confirm-btn"
              onClick={handleOptimizeAssessment}
              disabled={optimizingAssessment || !validationResult}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', backgroundColor: '#7c3aed' }}
            >
              {optimizingAssessment ? 'Optimizing...' : 'Re-run GA Optimization'}
            </button>
          </div>

          {/* Target Difficulty & Flagged Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600, display: 'block' }}>
                Target Difficulty: {targetDifficulty.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={targetDifficulty}
                onChange={(e) => setTargetDifficulty(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '0.4rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeFlaggedInOptimizer}
                  onChange={(e) => setIncludeFlaggedInOptimizer(e.target.checked)}
                />
                Include Flagged Questions in GA Pool
              </label>
            </div>
          </div>

          {questionResult && (
            <div className="questions-card" style={{ marginTop: '1rem' }}>
              <div className="research-header">
                <h4>Candidate Pool Distribution</h4>
                <span className="research-status-badge">{questionResult.generatedCount} Questions</span>
              </div>
              <div className="distribution-grid">
                <div className="dist-badge">MCQ: <strong>{questionResult.distribution.MCQ || 0}</strong></div>
                <div className="dist-badge">Conceptual: <strong>{questionResult.distribution.CONCEPTUAL || 0}</strong></div>
                <div className="dist-badge">Output Prediction: <strong>{questionResult.distribution.OUTPUT_PREDICTION || 0}</strong></div>
                <div className="dist-badge">Debugging: <strong>{questionResult.distribution.DEBUGGING || 0}</strong></div>
                <div className="dist-badge">Scenario: <strong>{questionResult.distribution.SCENARIO || 0}</strong></div>
              </div>
            </div>
          )}

          {validationResult && (
            <div className="validation-card" style={{ marginTop: '1rem' }}>
              <div className="research-header">
                <h4>Validation Diagnostics</h4>
                <span className="research-status-badge">Score: {(validationResult.summary.averageQualityScore * 100).toFixed(0)}%</span>
              </div>

              <div className="val-tabs" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className={`val-tab-btn ${selectedValidationTab === 'VALID' ? 'active' : ''}`}
                  onClick={() => setSelectedValidationTab('VALID')}
                >
                  Valid ({validationResult.validQuestions.length})
                </button>
                <button
                  type="button"
                  className={`val-tab-btn ${selectedValidationTab === 'FLAGGED' ? 'active' : ''}`}
                  onClick={() => setSelectedValidationTab('FLAGGED')}
                >
                  Flagged ({validationResult.flaggedQuestions.length})
                </button>
                <button
                  type="button"
                  className={`val-tab-btn ${selectedValidationTab === 'INVALID' ? 'active' : ''}`}
                  onClick={() => setSelectedValidationTab('INVALID')}
                >
                  Invalid ({validationResult.invalidQuestions.length})
                </button>
              </div>

              <div className="questions-list" style={{ marginTop: '0.75rem' }}>
                {(selectedValidationTab === 'VALID'
                  ? validationResult.validQuestions
                  : selectedValidationTab === 'FLAGGED'
                  ? validationResult.flaggedQuestions
                  : validationResult.invalidQuestions
                ).map((item, idx) => (
                  <div key={idx} className="question-card">
                    <div className="question-card-header">
                      <span>{item.question.type}</span>
                      <span>Quality: {(item.qualityScore * 100).toFixed(0)}%</span>
                    </div>
                    <div className="question-text">{idx + 1}. {item.question.question}</div>
                    {showAnswerKeys && (
                      <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '0.4rem' }}>
                        <strong>Correct Answer:</strong> {item.question.correctAnswer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}




      {/* Display Most Recently Saved Topic */}
      {savedTopic && (
        <div className="saved-topic-banner">
          <h3>Recently Confirmed & Saved Topic:</h3>
          <div>
            <strong>ID:</strong> {savedTopic.id}
          </div>
          <div>
            <strong>Input:</strong> {savedTopic.input}
          </div>
          {savedTopic.topic && (
            <div>
              <strong>Structured Topic:</strong> {savedTopic.topic} ({savedTopic.domain})
            </div>
          )}
          {savedTopic.subtopics && (
            <div>
              <strong>Subtopics:</strong>{' '}
              {Array.isArray(savedTopic.subtopics)
                ? savedTopic.subtopics.join(', ')
                : JSON.stringify(savedTopic.subtopics)}
            </div>
          )}
          <div>
            <strong>Saved At:</strong> {new Date(savedTopic.created_at).toLocaleString()}
          </div>
        </div>
      )}

      {/* Previously saved topics history */}
      <div className="topic-list-section">
        <h3>Saved Topics History ({allTopics.length})</h3>
        {isFetchingList && <p>Loading history...</p>}
        {!isFetchingList && allTopics.length === 0 && (
          <p style={{ color: '#64748b' }}>No topics saved yet. Enter a topic above to begin!</p>
        )}
        {!isFetchingList && allTopics.length > 0 && (
          <ul className="topic-list">
            {allTopics.map((topic) => (
              <li key={topic.id} className="topic-item">
                <div className="topic-item-header">
                  <span className="topic-text">
                    #{topic.id}: {topic.input}
                  </span>
                  <span className="topic-date">
                    {new Date(topic.created_at).toLocaleDateString()} {new Date(topic.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {topic.topic && (
                  <div className="topic-item-meta">
                    <span className="topic-item-tag">🎯 {topic.topic}</span>
                    {topic.domain && <span className="topic-item-tag">📂 {topic.domain}</span>}
                    {topic.subtopics && Array.isArray(topic.subtopics) && (
                      <span className="topic-item-tag">
                        📌 {topic.subtopics.length} subtopics
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
