import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssessmentsPage } from './pages/AssessmentsPage';
import { AssessmentHistoryPage } from './pages/AssessmentHistoryPage';
import { TopicPreparationPage } from './pages/TopicPreparationPage';
import { AssessmentTakingFullscreenPage } from './pages/AssessmentTakingFullscreenPage';
import { PerformanceAnalyticsPage } from './pages/PerformanceAnalyticsPage';
import { SkillProfilePage } from './pages/SkillProfilePage';
import { AssessmentResultsView } from './components/AssessmentResultsView';
import { AssessmentStudioPage } from './pages/AssessmentStudioPage';
import { UserTracingPage } from './pages/UserTracingPage';
import { ClarificationModal } from './components/ClarificationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { authService } from './services/authService';
import { topicService } from './services/topicService';
import { User } from './types/auth';
import { PerformanceAnalysisResult } from './types/analysis';

export type PageRoute =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'assessments'
  | 'history'
  | 'studio'
  | 'prepare'
  | 'take_assessment'
  | 'results'
  | 'performance'
  | 'skill_profile'
  | 'tracing';

const ROUTE_TO_PATH: Record<PageRoute, string> = {
  landing: '/',
  auth: '/auth',
  dashboard: '/dashboard',
  assessments: '/assessments',
  history: '/history',
  studio: '/studio',
  prepare: '/prepare',
  take_assessment: '/take_assessment',
  results: '/results',
  performance: '/performance',
  skill_profile: '/skills',
  tracing: '/tracing',
};

const PATH_TO_ROUTE: Record<string, PageRoute> = {
  '/': 'landing',
  '/auth': 'auth',
  '/dashboard': 'dashboard',
  '/assessments': 'assessments',
  '/history': 'history',
  '/studio': 'studio',
  '/prepare': 'prepare',
  '/take_assessment': 'take_assessment',
  '/test': 'take_assessment',
  '/results': 'results',
  '/performance': 'performance',
  '/skills': 'skill_profile',
  '/skill_profile': 'skill_profile',
  '/tracing': 'tracing',
};

function parseRouteAndParams(pathname: string, search: string): { route: PageRoute; attemptId?: number } {
  const clean = pathname.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(search);
  const queryId = params.get('id') || params.get('result') || params.get('attemptId');
  let parsedAttemptId: number | undefined = queryId && !isNaN(Number(queryId)) ? Number(queryId) : undefined;

  // Match /:username/result=1, /:username/results/1, /results/1, /result=1
  const resultMatch = clean.match(/(?:result(?:s)?(?:[=/:]))(\d+)/i);
  if (resultMatch && resultMatch[1]) {
    parsedAttemptId = Number(resultMatch[1]);
    return { route: 'results', attemptId: parsedAttemptId };
  }

  if (clean === '/results') {
    return { route: 'results', attemptId: parsedAttemptId };
  }

  const route = PATH_TO_ROUTE[clean] || 'landing';
  return { route, attemptId: parsedAttemptId };
}

export const App: React.FC = () => {
  const { getToken, isSignedIn } = useAuth();
  const initialNav = parseRouteAndParams(window.location.pathname, window.location.search);
  const [currentPage, setCurrentPage] = useState<PageRoute>(() => initialNav.route);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Sync Clerk Token to authService header provider and load user profile (including live Elo rating)
  useEffect(() => {
    if (isSignedIn) {
      getToken()
        .then((token) => {
          if (token) {
            authService.setToken(token);
            authService.getMe().then((user) => {
              if (user) setCurrentUser(user);
            }).catch(() => null);
          }
        })
        .catch(() => null);
    }
  }, [isSignedIn, getToken]);

  // Topic & Research Pipeline State
  const [activeTopic, setActiveTopic] = useState<string>('Searching Algorithms');
  const [knowledgeItems] = useState<any[]>([]);
  const [clarificationData, setClarificationData] = useState<{ message: string; options: string[] } | null>(null);

  // Real-Time Assessment Pipeline State
  const [realQuestions, setRealQuestions] = useState<any[]>([]);
  const [attemptId, setAttemptId] = useState<number>(() => initialNav.attemptId || 1);
  const [attemptStartedAt, setAttemptStartedAt] = useState<string | undefined>(undefined);
  const [assessmentLoading, setAssessmentLoading] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<PerformanceAnalysisResult | null>(null);

  useEffect(() => {
    // Check local authentication on boot
    const storedUser = authService.getUser();
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  // Listen to browser Back/Forward popstate events
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.page) {
        setCurrentPage(e.state.page);
        if (e.state.attemptId) {
          setAttemptId(e.state.attemptId);
        }
      } else {
        const nav = parseRouteAndParams(window.location.pathname, window.location.search);
        setCurrentPage(nav.route);
        if (nav.attemptId) {
          setAttemptId(nav.attemptId);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (page: string, tabOrParams?: any) => {
    const targetRoute = page as PageRoute;
    let newAttemptId: number | undefined;

    if (tabOrParams === 'login' || tabOrParams === 'register') {
      setAuthTab(tabOrParams);
    } else if (typeof tabOrParams === 'object' && typeof tabOrParams?.attemptId === 'number') {
      const explicitAttemptId: number = tabOrParams.attemptId;
      newAttemptId = explicitAttemptId;
      setAttemptId(explicitAttemptId);
      setEvaluationResult(null);
    }

    let path = ROUTE_TO_PATH[targetRoute] || '/';
    if (targetRoute === 'results') {
      const aid = newAttemptId || attemptId || 1;
      const username = currentUser?.username || (currentUser?.name ? currentUser.name.toLowerCase().replace(/\s+/g, '') : (currentUser?.email ? currentUser.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '') : 'user'));
      path = `/${username}/result=${aid}`;
    }

    if (window.location.pathname !== path) {
      window.history.pushState(
        { page: targetRoute, attemptId: newAttemptId || attemptId },
        '',
        path
      );
    }

    setCurrentPage(targetRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    handleNavigate('dashboard');
  };

  const handleLogout = () => {
    authService.clearAuth();
    setCurrentUser(null);
    handleNavigate('landing');
  };

  // Launch Unified Assessment Studio
  const handleStartTopic = (topicInput: string) => {
    setActiveTopic(topicInput);
    handleNavigate('studio');
  };

  // Step 2: Real-Time Question Generation, GA Optimization & Start Attempt
  const handleStartAssessment = async () => {
    setAssessmentLoading(true);

    try {
      // 1. Real-Time Question Generation
      const questionRes = await topicService.generateQuestions({
        topicTitle: activeTopic,
        knowledgeItems,
        count: 8,
      }).catch(() => null);

      const generatedPool = questionRes?.questions || [];

      if (generatedPool.length > 0) {
        // 2. Validate Questions
        const validated = await topicService.validateQuestions({ questions: generatedPool }).catch(() => null);
        const validPool = validated?.validQuestions ? validated.validQuestions.map(vq => vq.question) : generatedPool;

        // 3. Genetic Algorithm Optimization
        const optimized = await topicService.optimizeAssessment({
          questions: validPool,
          targetQuestionCount: 5,
        }).catch(() => null);

        let activeCreatedAttemptId: number | null = null;
        let activeCreatedStartedAt: string | null = null;

        if (optimized && optimized.questions && optimized.questions.length > 0) {
          setRealQuestions(optimized.questions);

          if (optimized.assessmentId) {
            const startRes = await topicService.startAttempt(optimized.assessmentId).catch(() => null);
            if (startRes?.attemptId) {
              activeCreatedAttemptId = startRes.attemptId;
              activeCreatedStartedAt = new Date().toISOString();
            }
          }
        } else {
          setRealQuestions(validPool);
        }

        // Ensure attempt ID is initialized if not already created
        if (!activeCreatedAttemptId) {
          const fallbackAttempt = await topicService.startAttempt(1).catch(() => null);
          if (fallbackAttempt?.attemptId) {
            activeCreatedAttemptId = fallbackAttempt.attemptId;
            activeCreatedStartedAt = new Date().toISOString();
          }
        }

        if (activeCreatedAttemptId) {
          setAttemptId(activeCreatedAttemptId);
          setAttemptStartedAt(activeCreatedStartedAt || new Date().toISOString());
        }
      } else {
        const fallbackAttempt = await topicService.startAttempt(1).catch(() => null);
        if (fallbackAttempt?.attemptId) {
          setAttemptId(fallbackAttempt.attemptId);
          setAttemptStartedAt(new Date().toISOString());
        }
      }

      handleNavigate('take_assessment');
    } catch (err) {
      console.error('Error starting real-time assessment:', err);
      handleNavigate('take_assessment');
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Step 3: Real-Time Attempt Submission, Evaluation & Performance Analysis
  const handleSubmitSession = async (answers: Record<string, string>) => {
    setEvaluationResult(null);
    const targetAttemptId = attemptId || 1;
    handleNavigate('results', { attemptId: targetAttemptId });

    try {
      const studentResponses = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        answer: ans,
      }));

      // Submit attempt
      await topicService.submitAttempt(targetAttemptId, studentResponses).catch(() => null);

      // Evaluate attempt (with bounded timeout so LLM slowdown never blocks analysis)
      await Promise.race([
        topicService.evaluateAttempt(targetAttemptId),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]).catch(() => null);

      // Compute performance & skill profile analysis
      const analysis = await topicService.analyzeAttempt(targetAttemptId).catch(() => null);
      if (analysis) {
        setEvaluationResult(analysis);
      }
    } catch (err) {
      console.error('Error submitting assessment:', err);
    }
  };

  return (
    <ErrorBoundary>
      {/* Clarification Modal Popup when topic ambiguity is returned */}
      {clarificationData && (
        <ClarificationModal
          message={clarificationData.message}
          options={clarificationData.options}
          onSelectOption={(opt) => handleStartTopic(opt)}
          onCancel={() => setClarificationData(null)}
        />
      )}

      {currentPage === 'landing' && (
        <LandingPage onNavigate={handleNavigate} />
      )}

      {currentPage === 'auth' && (
        <AuthPage
          initialTab={authTab}
          onNavigate={handleNavigate}
          onAuthSuccess={handleAuthSuccess}
        />
      )}

      {currentPage === 'dashboard' && (
        <DashboardPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onStartTopic={handleStartTopic}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'assessments' && (
        <AssessmentsPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onStartTopic={handleStartTopic}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'history' && (
        <AssessmentHistoryPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'studio' && (
        <AssessmentStudioPage
          currentUser={currentUser}
          initialTopic={activeTopic}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'prepare' && (
        <TopicPreparationPage
          currentUser={currentUser}
          topic={activeTopic}
          subtopics={['Core Principles', 'Time Complexity', 'Key Invariants']}
          revisionPoints={['Deterministic evaluation ensures state correctness.']}
          loading={assessmentLoading}
          onNavigate={handleNavigate}
          onStartAssessment={handleStartAssessment}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'take_assessment' && (
        <AssessmentTakingFullscreenPage
          currentUser={currentUser}
          topicName={activeTopic}
          realQuestions={realQuestions}
          attemptId={attemptId}
          startedAt={attemptStartedAt}
          onNavigate={handleNavigate}
          onSubmitSession={handleSubmitSession}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'results' && (
        <div style={{ backgroundColor: '#070a12', minHeight: '100vh', padding: '2.5rem 3rem', maxWidth: '1320px', margin: '0 auto' }}>
          <AssessmentResultsView
            attemptId={attemptId || 1}
            topicId={1}
            initialAnalysis={evaluationResult}
            onExit={() => handleNavigate('dashboard')}
            onNavigatePerformance={() => handleNavigate('performance')}
            onStartAdaptiveAssessment={() => handleStartAssessment()}
          />
        </div>
      )}

      {currentPage === 'performance' && (
        <PerformanceAnalyticsPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'skill_profile' && (
        <SkillProfilePage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onStartTopic={handleStartTopic}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'tracing' && (
        <UserTracingPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}
    </ErrorBoundary>
  );
};

export default App;
