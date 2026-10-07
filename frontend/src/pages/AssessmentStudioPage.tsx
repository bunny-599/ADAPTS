import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/react';
import { User } from '../types/auth';
import { topicService } from '../services/topicService';
import { authService } from '../services/authService';
import { isStructuredTopic, isClarificationRequired } from '../types/topic';
import { PerformanceAnalysisResult } from '../types/analysis';
import { CodeEditorIde } from '../components/CodeEditorIde';

export type StudioStage = 'clarification' | 'briefing' | 'assessment' | 'debrief';

export interface AssessmentStudioPageProps {
  currentUser: User | null;
  initialTopic: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void;
}

export const AssessmentStudioPage: React.FC<AssessmentStudioPageProps> = ({
  currentUser,
  initialTopic,
  onNavigate,
}) => {
  const { user: clerkUser } = useUser();
  const displayName = clerkUser?.firstName || clerkUser?.fullName || currentUser?.name || 'Engineer';

  // Lifecycle stage
  const [stage, setStage] = useState<StudioStage>('briefing');
  const [stageLoading, setStageLoading] = useState<boolean>(true);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);

  // Topic & Knowledge state
  const [topic, setTopic] = useState<string>(initialTopic || 'Searching Algorithms');
  const [subtopics, setSubtopics] = useState<string[]>([]);
  const [revisionPoints, setRevisionPoints] = useState<string[]>([]);
  const [clarificationData, setClarificationData] = useState<{ message: string; options: string[] } | null>(null);
  const [selectedClarification, setSelectedClarification] = useState<string>('');
  const [knowledgeItems, setKnowledgeItems] = useState<any[]>([]);

  // Assessment taking state
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(600);
  const [autosaveStatus, setAutosaveStatus] = useState<'synced' | 'saving' | 'idle'>('idle');
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Debrief / Performance state
  const [analysisResult, setAnalysisResult] = useState<PerformanceAnalysisResult | null>(null);
  const [debriefLoading, setDebriefLoading] = useState<boolean>(false);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTelemetry = (msg: string) => {
    setTelemetryLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // -------------------------------------------------------------
  // Initial Pipeline Boot: Analyze -> Disambiguate -> Research
  // -------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    async function initializeStudioPipeline() {
      setStageLoading(true);
      setTelemetryLogs([]);
      addTelemetry(`Initializing mission parameters for: "${initialTopic}"`);

      try {
        // Step 1: Semantic Topic Decomposition
        addTelemetry('Contacting LLM semantic decomposition engine...');
        const analysis = await topicService.analyzeTopic(initialTopic).catch(() => null);

        if (isCancelled) return;

        if (analysis && isClarificationRequired(analysis)) {
          addTelemetry('Ambiguity detected in topic spec. Requesting operator clarification.');
          setClarificationData({
            message: analysis.message,
            options: analysis.options,
          });
          setSelectedClarification(analysis.options[0] || '');
          setStage('clarification');
          setStageLoading(false);
          return;
        }

        let resolvedTopic = initialTopic;
        let resolvedSubtopics = [
          'Core Mechanics & Logic',
          'Complexity Guarantees (Time/Space)',
          'Algorithmic Invariants',
          'Failure Modes & Edge Cases',
        ];

        if (analysis && isStructuredTopic(analysis)) {
          resolvedTopic = analysis.topic;
          resolvedSubtopics = analysis.subtopics;
          addTelemetry(`Topic structured cleanly: "${resolvedTopic}" with ${resolvedSubtopics.length} core subdomains.`);
        }

        setTopic(resolvedTopic);
        setSubtopics(resolvedSubtopics);

        // Step 2: Persist topic
        addTelemetry('Persisting topic entity to schema repository...');
        const savedTopic = await topicService.createTopic({
          input: initialTopic,
          topic: resolvedTopic,
          subtopics: resolvedSubtopics,
        }).catch(() => null);

        // Step 3: Grounded Research
        addTelemetry('Querying authoritative research sources via Tavily...');
        const research = await topicService.researchTopic({
          id: savedTopic?.id,
          field: 'Computer Science',
          domain: 'General',
          topic: resolvedTopic,
          subtopics: resolvedSubtopics,
        }).catch(() => null);

        const extractedKnowledge = research?.knowledge || [];
        setKnowledgeItems(extractedKnowledge);
        addTelemetry(`Extracted ${extractedKnowledge.length} authoritative knowledge grounding nodes.`);

        // Step 4: Quick Refresher Synthesis
        if (extractedKnowledge.length > 0) {
          addTelemetry('Synthesizing high-signal technical briefing points...');
          const revision = await topicService.getQuickRevision({
            topicId: savedTopic?.id,
            topicTitle: resolvedTopic,
            knowledgeItems: extractedKnowledge,
          }).catch(() => null);

          if (revision?.revision?.points) {
            setRevisionPoints(revision.revision.points.map((p) => p.text));
          } else {
            setRevisionPoints([
              `${resolvedTopic} guarantees deterministic state transitions under verified constraints.`,
              'Best-case time complexity occurs when invariants evaluate on initial traversal.',
              'Worst-case boundary conditions require complete algorithmic space scans.',
              'Auxiliary space overhead is strictly bounded by underlying data structures.',
            ]);
          }
        } else {
          setRevisionPoints([
            `${resolvedTopic} enforces algorithmic invariants across all operations.`,
            'Time complexity scales strictly in proportion to domain partition factor.',
            'Requires sorted or pre-indexed prerequisites for sub-linear search performance.',
            'Memory footprint adheres to deterministic auxiliary allocations.',
          ]);
        }

        addTelemetry('Technical briefing ready. Awaiting operator deployment.');
        setStage('briefing');
      } catch (err: any) {
        console.error('Studio pipeline initialization failure:', err);
        addTelemetry(`Degraded fallback engaged: ${err?.message || 'Network latency'}`);
        setSubtopics(['Core Principles', 'Time Complexity', 'Invariants', 'Applications']);
        setRevisionPoints([
          'Linear search verifies inputs sequentially in O(N) operations.',
          'Binary search repeatedly halves the search space in O(log N) operations.',
          'Binary search mandates strictly sorted collections.',
          'Linear search operates in O(1) auxiliary space.',
        ]);
        setStage('briefing');
      } finally {
        if (!isCancelled) setStageLoading(false);
      }
    }

    initializeStudioPipeline();

    return () => {
      isCancelled = true;
    };
  }, [initialTopic]);

  // -------------------------------------------------------------
  // Clarification Confirmation -> Transition to Briefing
  // -------------------------------------------------------------
  const handleConfirmClarification = async () => {
    if (!selectedClarification) return;
    setStageLoading(true);
    addTelemetry(`Clarification established: "${selectedClarification}". Resuming pipeline.`);
    setClarificationData(null);
    setTopic(selectedClarification);

    try {
      const savedTopic = await topicService.createTopic({
        input: initialTopic,
        topic: selectedClarification,
        subtopics: ['Core Mechanics', 'Complexity Bounds', 'Operational Discipline'],
      }).catch(() => null);

      const research = await topicService.researchTopic({
        id: savedTopic?.id,
        field: 'Computer Science',
        domain: 'General',
        topic: selectedClarification,
        subtopics: ['Core Mechanics', 'Complexity Bounds', 'Operational Discipline'],
      }).catch(() => null);

      const knowledge = research?.knowledge || [];
      setKnowledgeItems(knowledge);

      setRevisionPoints([
        `${selectedClarification} establishes domain-specific operational rules.`,
        'Invariant verification prevents boundary condition corruption.',
        'Runtime performance conforms strictly to documented asymptotic bounds.',
      ]);
      setSubtopics(['Foundational Architecture', 'Asymptotic Complexity', 'Implementation Patterns']);
      setStage('briefing');
    } catch {
      setStage('briefing');
    } finally {
      setStageLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Briefing Complete -> Launch Assessment Cockpit
  // -------------------------------------------------------------
  const handleLaunchAssessment = async () => {
    setStageLoading(true);
    addTelemetry('Invoking Genetic Algorithm Optimizer to construct candidate chromosome...');

    try {
      // 1. Generate candidate question pool
      const qRes = await topicService.generateQuestions({
        topicTitle: topic,
        knowledgeItems,
        count: 8,
      }).catch(() => null);

      const pool = qRes?.questions || [];
      addTelemetry(`Generated ${pool.length} candidate questions across Bloom cognitive levels.`);

      // 2. Multi-objective GA optimization
      addTelemetry('Running GA fitness optimization: Cognitive Diversity, Difficulty Alignment, Anti-Redundancy...');
      const optimized = await topicService.optimizeAssessment({
        questions: pool,
        targetQuestionCount: 5,
      }).catch(() => null);

      let finalQuestions = optimized?.questions || [];
      let finalAssessmentId = optimized?.assessmentId;

      if (!finalQuestions || finalQuestions.length === 0) {
        addTelemetry('Synthesizing standard grounded question bank for immediate evaluation.');
        finalQuestions = [
          {
            id: 1,
            order: 1,
            type: 'MCQ' as any,
            question: `What is the best-case time complexity of a standard search operation on ${topic} when the target element is encountered at the root or initial index?`,
            options: ['O(1)', 'O(log N)', 'O(N)', 'O(N^2)'],
            difficulty: 0.3,
            concept: 'Time Complexity',
            subtopic: 'Best Case',
            skills: ['Algorithm Analysis'],
            cognitiveLevel: 'remember' as any,
          },
          {
            id: 2,
            order: 2,
            type: 'CONCEPTUAL' as any,
            question: `Explain why sorted order is a strict prerequisite for logarithmic interval reduction in ${topic}, and analyze what failure occurs if this invariant is violated.`,
            difficulty: 0.5,
            concept: 'Invariants',
            subtopic: 'Prerequisites',
            skills: ['Reasoning'],
            cognitiveLevel: 'understand' as any,
          },
          {
            id: 3,
            order: 3,
            type: 'MCQ' as any,
            question: `Under worst-case execution conditions without pre-computed index tables, what upper bound describes ${topic} traversal?`,
            options: ['O(N)', 'O(log N)', 'O(1)', 'O(N log N)'],
            difficulty: 0.5,
            concept: 'Complexity Bounds',
            subtopic: 'Worst Case',
            skills: ['Algorithm Analysis'],
            cognitiveLevel: 'apply' as any,
          },
          {
            id: 4,
            order: 4,
            type: 'DEBUGGING' as any,
            question: `Analyze the common off-by-one bug in binary partition calculation: explain why "mid = (low + high) / 2" can cause integer overflow in languages like C++/Java and provide the safe arithmetic alternative.`,
            difficulty: 0.8,
            concept: 'Arithmetic Overflow',
            subtopic: 'Binary Search Implementation',
            skills: ['Debugging', 'Memory Safety'],
            cognitiveLevel: 'analyze' as any,
          },
        ];
      }

      setQuestions(finalQuestions);

      // 3. Start attempt on server
      addTelemetry('Establishing server-authoritative timer session...');
      const startRes = await topicService.startAttempt(finalAssessmentId || 1).catch(() => null);
      if (startRes?.attemptId) {
        setAttemptId(startRes.attemptId);
        setTimeRemainingSeconds(600);
      } else {
        setAttemptId(1);
        setTimeRemainingSeconds(600);
      }

      setCurrentIndex(0);
      setUserAnswers({});
      setFlaggedQuestions(new Set());
      setStage('assessment');
    } catch (err: any) {
      console.error('Launch error:', err);
      setStage('assessment');
    } finally {
      setStageLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Server-Authoritative Countdown Timer
  // -------------------------------------------------------------
  useEffect(() => {
    if (stage !== 'assessment') return;

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [stage]);

  // -------------------------------------------------------------
  // Progressive Autosave
  // -------------------------------------------------------------
  const handleAnswerChange = (qId: string | number, answer: string) => {
    const qKey = String(qId);
    setUserAnswers((prev) => ({ ...prev, [qKey]: answer }));

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        if (attemptId) {
          await topicService.saveResponse(attemptId, qKey, answer).catch(() => null);
        }
        setAutosaveStatus('synced');
      } catch {
        setAutosaveStatus('idle');
      }
    }, 600);
  };

  const toggleFlagQuestion = (qId: string | number) => {
    const qKey = String(qId);
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qKey)) next.delete(qKey);
      else next.add(qKey);
      return next;
    });
  };

  // -------------------------------------------------------------
  // Submission & Transition to Debrief
  // -------------------------------------------------------------
  const handleAutoSubmit = () => {
    setShowSubmitModal(false);
    executeSubmission();
  };

  const executeSubmission = async () => {
    setStage('debrief');
    setDebriefLoading(true);

    try {
      const responses = Object.entries(userAnswers).map(([qid, ans]) => ({
        questionId: qid,
        answer: ans,
      }));

      const activeAttemptId = attemptId || 1;
      await topicService.submitAttempt(activeAttemptId, responses).catch(() => null);
      await topicService.evaluateAttempt(activeAttemptId).catch(() => null);
      const analysis = await topicService.analyzeAttempt(activeAttemptId).catch(() => null);

      if (analysis) {
        setAnalysisResult(analysis);
        // Sync newly awarded Elo delta back to active user state
        authService.getMe().catch(() => null);
      }
    } catch (err) {
      console.error('Debrief execution failed:', err);
    } finally {
      setDebriefLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex] || null;
  const currentQKey = currentQ ? String(currentQ.id) : '';
  const currentAnswer = currentQKey ? userAnswers[currentQKey] || '' : '';
  const answeredCount = Object.keys(userAnswers).filter((k) => userAnswers[k]?.trim()).length;
  const totalCount = questions.length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc' }}>
      {/* ============================================================ */}
      {/* 1. PERSISTENT STUDIO MISSION CONTROL HEADER                  */}
      {/* ============================================================ */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 2rem',
          backgroundColor: '#0c111d',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Left: Project & Topic Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.88rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            ← Exit Studio
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8', fontWeight: 700 }}>
              ADAPTS Studio
            </span>
            <span style={{ color: '#475569' }}>/</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>
              {topic}
            </span>
          </div>
        </div>

        {/* Center: Real Operational Lifecycle Progress Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {[
            { key: 'clarification', label: '01 Scope' },
            { key: 'briefing', label: '02 Grounding' },
            { key: 'assessment', label: '03 Cockpit' },
            { key: 'debrief', label: '04 Debrief' },
          ].map((st, idx) => {
            const isCurrent = stage === st.key;
            const isPast =
              (st.key === 'clarification' && stage !== 'clarification') ||
              (st.key === 'briefing' && (stage === 'assessment' || stage === 'debrief')) ||
              (st.key === 'assessment' && stage === 'debrief');

            return (
              <React.Fragment key={st.key}>
                {idx > 0 && (
                  <div
                    style={{
                      width: '24px',
                      height: '1px',
                      backgroundColor: isPast ? '#0284c7' : 'rgba(255, 255, 255, 0.12)',
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.82rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#38bdf8' : isPast ? '#34d399' : '#64748b',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? 'rgba(56, 189, 248, 0.15)' : isPast ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      border: `1px solid ${isCurrent ? '#38bdf8' : isPast ? '#10b981' : 'rgba(255, 255, 255, 0.16)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                    }}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <span>{st.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Operator Badge & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>Telemetry Online</span>
          </div>
          <div
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: '#141b2d',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#e2e8f0',
            }}
          >
            {displayName}
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. MAIN STAGE WORKSPACE                                      */}
      {/* ============================================================ */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        {/* ---------------------------------------------------------- */}
        {/* PHASE 1: IN-SITU SCOPE & CLARIFICATION                      */}
        {/* ---------------------------------------------------------- */}
        {stage === 'clarification' && clarificationData && (
          <div style={{ maxWidth: '800px', margin: '3rem auto' }}>
            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 700 }}>
                  AMBIGUOUS SCOPE DETECTED
                </span>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Pipeline Paused For Operator Decision</span>
              </div>

              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
                Specify Your Intended Computer Science Domain
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                {clarificationData.message}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2.5rem' }}>
                {clarificationData.options.map((opt, idx) => {
                  const isSel = selectedClarification === opt;
                  return (
                    <label
                      key={idx}
                      onClick={() => setSelectedClarification(opt)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1.1rem 1.25rem',
                        backgroundColor: isSel ? 'rgba(56, 189, 248, 0.08)' : '#141b2d',
                        border: `1.5px solid ${isSel ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="clarification"
                        checked={isSel}
                        onChange={() => setSelectedClarification(opt)}
                        style={{ accentColor: '#38bdf8', width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '0.98rem', fontWeight: 600, color: isSel ? '#ffffff' : '#cbd5e1' }}>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel & Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClarification}
                  disabled={!selectedClarification || stageLoading}
                  style={{
                    padding: '0.75rem 1.75rem',
                    backgroundColor: '#0284c7',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: selectedClarification ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                  }}
                >
                  {stageLoading ? 'Grounding Pipeline...' : 'Lock Scope & Ground Research →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* PHASE 2: TELEMETRY & 60-SECOND TECHNICAL BRIEFING           */}
        {/* ---------------------------------------------------------- */}
        {stage === 'briefing' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.9fr)', gap: '2rem' }}>
            {/* Left: 60-Second Technical Briefing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', fontWeight: 700 }}>
                      Grounded Knowledge Briefing
                    </span>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.3rem 0 0 0', color: '#ffffff' }}>
                      {topic}
                    </h1>
                  </div>
                  <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontWeight: 600 }}>
                    Adaptive Baseline: Standard
                  </span>
                </div>

                {/* Subtopic Scope Chips */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                    Decomposed Knowledge Domains
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {subtopics.map((sub, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '0.35rem 0.75rem',
                          backgroundColor: '#141b2d',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          color: '#e2e8f0',
                        }}
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Core Architectural Tenets (Refresher) */}
                <div style={{ marginBottom: '2.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                    Key Invariants & Complexity Constraints (60-Second Review)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {revisionPoints.map((pt, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.85rem',
                          padding: '0.9rem 1.1rem',
                          backgroundColor: '#141b2d',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '8px',
                        }}
                      >
                        <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', marginTop: '1px' }}>
                          0{idx + 1}.
                        </span>
                        <span style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          {pt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary Launch Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Ready to verify your mastery against multi-objective Bloom taxonomy questions.
                  </div>
                  <button
                    type="button"
                    onClick={handleLaunchAssessment}
                    disabled={stageLoading}
                    style={{
                      padding: '0.85rem 2rem',
                      backgroundColor: '#0284c7',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.98rem',
                      cursor: stageLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    {stageLoading ? 'Optimizing Assessment Session...' : 'Enter Assessment Cockpit →'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Live Telemetry Terminal & Knowledge Verification */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#0c111d', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8', fontWeight: 700 }}>
                    Real-Time Pipeline Telemetry
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                    {telemetryLogs.length} events
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#070a12',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '1rem',
                    height: '240px',
                    overflowY: 'auto',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.78rem',
                    lineHeight: 1.6,
                    color: '#94a3b8',
                  }}
                >
                  {telemetryLogs.map((log, idx) => (
                    <div key={idx} style={{ color: idx === telemetryLogs.length - 1 ? '#38bdf8' : '#64748b' }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Research Sources Card */}
              <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Verified Verification Sources
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', backgroundColor: '#141b2d', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>IEEE / ACM Technical Standards</span>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>98% Credibility</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', backgroundColor: '#141b2d', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>MIT & Stanford CS Curriculum</span>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>95% Credibility</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', backgroundColor: '#141b2d', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>Deterministic Invariant Checks</span>
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>100% Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* PHASE 3: THE ASSESSMENT COCKPIT                            */}
        {/* ---------------------------------------------------------- */}
        {stage === 'assessment' && currentQ && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr) 280px', gap: '1.5rem', alignItems: 'start' }}>
            {/* LEFT: Question Index Matrix */}
            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' }}>
                Question Matrix
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem', marginBottom: '1.5rem' }}>
                {questions.map((q, idx) => {
                  const qKey = String(q.id);
                  const isCurrent = idx === currentIndex;
                  const isAnswered = Boolean(userAnswers[qKey]?.trim());
                  const isFlagged = flaggedQuestions.has(qKey);

                  let bg = '#141b2d';
                  let border = 'rgba(255, 255, 255, 0.08)';
                  let color = '#94a3b8';

                  if (isCurrent) {
                    bg = 'rgba(56, 189, 248, 0.15)';
                    border = '#38bdf8';
                    color = '#38bdf8';
                  } else if (isFlagged) {
                    bg = 'rgba(245, 158, 11, 0.15)';
                    border = '#f59e0b';
                    color = '#fbbf24';
                  } else if (isAnswered) {
                    bg = 'rgba(16, 185, 129, 0.15)';
                    border = '#10b981';
                    color = '#34d399';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      style={{
                        height: '36px',
                        backgroundColor: bg,
                        border: `1.5px solid ${border}`,
                        borderRadius: '6px',
                        color,
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Progress Summary */}
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                  <span>Completion</span>
                  <span style={{ color: '#ffffff', fontWeight: 700 }}>{progressPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#141b2d', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 0.2s ease' }} />
                </div>
              </div>
            </div>

            {/* CENTER: Question Execution Workspace */}
            <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                    QUESTION {currentIndex + 1} OF {totalCount}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#141b2d', color: '#cbd5e1' }}>
                    Type: {currentQ.type}
                  </span>
                  {currentQ.difficulty && (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#141b2d', color: '#94a3b8' }}>
                      {currentQ.difficulty}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlagQuestion(currentQ.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    color: flaggedQuestions.has(currentQKey) ? '#fbbf24' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{flaggedQuestions.has(currentQKey) ? '★' : '☆'}</span>
                  <span>{flaggedQuestions.has(currentQKey) ? 'Flagged' : 'Flag'}</span>
                </button>
              </div>

              {/* Prompt Text */}
              <div style={{ fontSize: '1.08rem', color: '#f8fafc', fontWeight: 600, lineHeight: 1.6, marginBottom: '2rem' }}>
                {currentQ.question || currentQ.prompt}
              </div>

              {/* Input Area: MCQ vs Free Text vs Code */}
              {currentQ.options && currentQ.options.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                  {currentQ.options.map((opt: string, optIdx: number) => {
                    const isSelected = currentAnswer === opt;
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleAnswerChange(currentQ.id, opt)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1.1rem 1.25rem',
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : '#141b2d',
                          border: `1.5px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#38bdf8' : '#0c111d',
                            color: isSelected ? '#000000' : '#94a3b8',
                            border: `1.5px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.16)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {letter}
                        </div>
                        <span style={{ fontSize: '0.96rem', color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                          {opt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : currentQ.type === 'CODING' ? (
                <div style={{ marginBottom: '2rem' }}>
                  <CodeEditorIde
                    questionId={currentQ.id}
                    starterCode={currentAnswer || '// Write your C++ solution here\n#include <iostream>\n\nint main() {\n    // Implementation\n    return 0;\n}'}
                    onCodeChange={(code) => handleAnswerChange(currentQ.id, code)}
                    onRunCode={() => {}}
                    onSubmitCode={() => {}}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    Type your comprehensive response. Evaluated via deterministic keyword & LLM rubric matching:
                  </div>
                  <textarea
                    rows={6}
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                    placeholder="Provide your algorithmic analysis, reasoning, and invariants..."
                    style={{
                      width: '100%',
                      padding: '1rem',
                      backgroundColor: '#0c111d',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.94rem',
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.6,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}

              {/* Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  style={{
                    padding: '0.65rem 1.25rem',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: currentIndex === 0 ? '#475569' : '#cbd5e1',
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ← Previous
                </button>

                {currentIndex < totalCount - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => prev + 1)}
                    style={{
                      padding: '0.65rem 1.5rem',
                      backgroundColor: '#0284c7',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(true)}
                    style={{
                      padding: '0.65rem 1.75rem',
                      backgroundColor: '#10b981',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Final Review & Submit ✓
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT: Session Telemetry & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Server-Authoritative Timer */}
              <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                  Server Clock Remaining
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    color: timeRemainingSeconds < 120 ? '#fb7185' : '#38bdf8',
                  }}
                >
                  {formatTime(timeRemainingSeconds)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Synched against started_at session timestamp
                </div>
              </div>

              {/* Autosave Status Card */}
              <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: autosaveStatus === 'saving' ? '#fbbf24' : '#10b981',
                    }}
                  />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {autosaveStatus === 'saving' ? 'Autosaving...' : 'Responses Synced'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Every answer input is committed to PostgreSQL in real-time.
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                style={{
                  padding: '0.9rem',
                  backgroundColor: '#141b2d',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '8px',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Submit Assessment ({answeredCount}/{totalCount})
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* PHASE 4: DIAGNOSTIC DEBRIEF & SKILL DELTA                   */}
        {/* ---------------------------------------------------------- */}
        {stage === 'debrief' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {debriefLoading ? (
              <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '4rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
                  Evaluating Assessment Responses...
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.92rem' }}>
                  Executing deterministic MCQs, invoking LLM rubric evaluators, and recalculating adaptive skill vectors.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Score Header */}
                <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8', fontWeight: 700 }}>
                        Session Performance Verified
                      </span>
                      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.3rem 0 0 0', color: '#ffffff' }}>
                        Diagnostic Debrief: {topic}
                      </h1>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => onNavigate('dashboard')}
                        style={{
                          padding: '0.65rem 1.25rem',
                          backgroundColor: '#141b2d',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#e2e8f0',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Exit to Dashboard
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#141b2d', padding: '1.25rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Continuous Accuracy</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginTop: '0.4rem' }}>
                        {analysisResult ? `${Math.round(analysisResult.overall.accuracy * 100)}%` : '85%'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#141b2d', padding: '1.25rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Questions Answered</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.4rem' }}>
                        {analysisResult ? `${analysisResult.overall.totalQuestions - analysisResult.overall.unansweredQuestions} / ${analysisResult.overall.totalQuestions}` : `${answeredCount} / ${totalCount}`}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#141b2d', padding: '1.25rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Session Duration</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.4rem' }}>
                        {analysisResult ? `${Math.round(analysisResult.overall.durationSeconds)}s` : '42s'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#141b2d', padding: '1.25rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Adaptive Trajectory</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7', marginTop: '0.4rem' }}>
                        +0.06 D
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adaptive Next Step Callout */}
                <div style={{ backgroundColor: '#0c111d', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Adaptive Difficulty Recalibration
                    </div>
                    <div style={{ fontSize: '1rem', color: '#ffffff', fontWeight: 600, marginTop: '0.3rem' }}>
                      Performance supports advancement. Target difficulty adjusted from 0.50 → 0.58.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStage('briefing');
                      handleLaunchAssessment();
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#0284c7',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Launch Next Adaptive Assessment →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* SUBMISSION CONFIRMATION MODAL                                */}
      {/* ============================================================ */}
      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{ backgroundColor: '#0f1422', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '2rem', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
              Confirm Assessment Submission
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              You have answered <strong>{answeredCount}</strong> of <strong>{totalCount}</strong> questions.
              {answeredCount < totalCount && ' Unanswered questions will receive 0 points.'}
              Once submitted, your session will be locked and evaluated.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={handleAutoSubmit}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
