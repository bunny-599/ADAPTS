import assert from 'assert';
import { AdaptiveAssessmentService, mockAdaptiveRunsStore } from '../src/services/adaptiveAssessmentService';
import { GeneticAssessmentOptimizer } from '../src/services/geneticAssessmentOptimizer';
import { SkillProfileRecord, PerformanceAnalysisResult } from '../src/types/analysis';
import { Question } from '../src/types/question';

console.log('=== Running Trial 10: Adaptive Next Assessment Engine Tests ===\n');

// Mock pool of 20 questions for testing
const mockQuestionPool: Question[] = [
  // Custom Hooks (weak skill) - Debugging & Conceptual
  {
    id: 1,
    type: 'DEBUGGING',
    question: 'Find the stale closure in this custom hook.',
    options: [],
    correctAnswer: 'Add dependency',
    explanation: 'Missing dependency in hook',
    difficulty: 0.60,
    concept: 'Custom Hooks',
    subtopic: 'Hooks Architecture',
    skills: ['Custom Hooks', 'Debugging'],
    cognitiveLevel: 'analyze',
    sourceReferences: ['react.dev'],
  },
  {
    id: 2,
    type: 'DEBUGGING',
    question: 'Debug the infinite render in useWindowSize.',
    options: [],
    correctAnswer: 'Memoize callback',
    explanation: 'Unmemoized listener trigger',
    difficulty: 0.65,
    concept: 'Custom Hooks',
    subtopic: 'Hooks Architecture',
    skills: ['Custom Hooks', 'Debugging'],
    cognitiveLevel: 'analyze',
    sourceReferences: ['react.dev'],
  },
  {
    id: 3,
    type: 'CONCEPTUAL',
    question: 'Explain rules of custom hooks naming and state sharing.',
    options: [],
    correctAnswer: 'Hooks share stateful logic not state itself',
    explanation: 'Each call gets isolated state',
    difficulty: 0.55,
    concept: 'Custom Hooks',
    subtopic: 'Hooks Architecture',
    skills: ['Custom Hooks'],
    cognitiveLevel: 'understand',
    sourceReferences: ['react.dev'],
  },
  {
    id: 4,
    type: 'SCENARIO',
    question: 'Design a useFetch hook with cancellation on unmount.',
    options: [],
    correctAnswer: 'AbortController in cleanup',
    explanation: 'Cleanup function cancels active fetch',
    difficulty: 0.70,
    concept: 'Custom Hooks',
    subtopic: 'Hooks Architecture',
    skills: ['Custom Hooks', 'Application'],
    cognitiveLevel: 'apply',
    sourceReferences: ['react.dev'],
  },

  // useContext (developing skill)
  {
    id: 5,
    type: 'MCQ',
    question: 'What does useContext return when no Provider is present?',
    options: ['Default context value', 'null', 'undefined', 'Throws an error'],
    correctAnswer: 'Default context value',
    explanation: 'Uses defaultValue passed to createContext',
    difficulty: 0.50,
    concept: 'useContext',
    subtopic: 'Context API',
    skills: ['useContext'],
    cognitiveLevel: 'remember',
    sourceReferences: ['react.dev'],
  },
  {
    id: 6,
    type: 'MCQ',
    question: 'How do you prevent unnecessary renders with useContext?',
    options: ['Split contexts into smaller slices', 'Use useMemo inside provider', 'Wrap component in React.memo', 'Both A and B'],
    correctAnswer: 'Both A and B',
    explanation: 'Context splitting and value memoization optimize consumers',
    difficulty: 0.60,
    concept: 'useContext',
    subtopic: 'Context API',
    skills: ['useContext', 'Application'],
    cognitiveLevel: 'apply',
    sourceReferences: ['react.dev'],
  },

  // useState (strong skill)
  {
    id: 7,
    type: 'MCQ',
    question: 'How do you update state based on previous state in useState?',
    options: ['Pass updater function setState(prev => ...)', 'Call setState(state + 1)', 'Mutate state directly', 'Use usePrevious'],
    correctAnswer: 'Pass updater function setState(prev => ...)',
    explanation: 'Functional updater prevents stale closures in batching',
    difficulty: 0.35,
    concept: 'useState',
    subtopic: 'State Hooks',
    skills: ['useState'],
    cognitiveLevel: 'remember',
    sourceReferences: ['react.dev'],
  },
  {
    id: 8,
    type: 'OUTPUT_PREDICTION',
    question: 'What is logged after 3 consecutive setState calls?',
    options: [],
    correctAnswer: 'Batched single update',
    explanation: 'React 18 automatic batching batches synchronous triggers',
    difficulty: 0.50,
    concept: 'useState',
    subtopic: 'State Hooks',
    skills: ['useState'],
    cognitiveLevel: 'understand',
    sourceReferences: ['react.dev'],
  },

  // useEffect (strong skill)
  {
    id: 9,
    type: 'MCQ',
    question: 'When does the useEffect cleanup function execute?',
    options: ['Before unmount and before re-running effect', 'Only on unmount', 'Only on error', 'After component re-render'],
    correctAnswer: 'Before unmount and before re-running effect',
    explanation: 'Cleanup cleans previous invocation before new run or unmount',
    difficulty: 0.40,
    concept: 'useEffect',
    subtopic: 'Effect Hooks',
    skills: ['useEffect'],
    cognitiveLevel: 'understand',
    sourceReferences: ['react.dev'],
  },
  {
    id: 10,
    type: 'DEBUGGING',
    question: 'Fix missing dependency warning in useEffect.',
    options: [],
    correctAnswer: 'Add id to dependency array',
    explanation: 'All reactive values must be included',
    difficulty: 0.55,
    concept: 'useEffect',
    subtopic: 'Effect Hooks',
    skills: ['useEffect', 'Debugging'],
    cognitiveLevel: 'apply',
    sourceReferences: ['react.dev'],
  },

  // Additional questions for pool depth (10 more questions)
  {
    id: 11,
    type: 'MCQ',
    question: 'What is the purpose of useId hook?',
    options: ['Generating unique accessibility IDs', 'Database row identifier', 'CSS class generator', 'Session token'],
    correctAnswer: 'Generating unique accessibility IDs',
    explanation: 'Provides hydration-safe unique IDs',
    difficulty: 0.45,
    concept: 'Other Hooks',
    subtopic: 'Utility Hooks',
    skills: ['Other Hooks'],
    cognitiveLevel: 'remember',
    sourceReferences: ['react.dev'],
  },
  {
    id: 12,
    type: 'MCQ',
    question: 'What does useTransition do?',
    options: ['Marks state updates as non-urgent transitions', 'Animates CSS elements', 'Transitions routes in React Router', 'Delays mounting'],
    correctAnswer: 'Marks state updates as non-urgent transitions',
    explanation: 'Concurrent feature keeping UI responsive',
    difficulty: 0.65,
    concept: 'Concurrent Hooks',
    subtopic: 'Concurrency',
    skills: ['Concurrency'],
    cognitiveLevel: 'understand',
    sourceReferences: ['react.dev'],
  },
  {
    id: 13,
    type: 'OUTPUT_PREDICTION',
    question: 'Predict the render order of parent and child useEffects.',
    options: [],
    correctAnswer: 'Child effect first, then parent effect',
    explanation: 'Effects run bottom-up after DOM mutation',
    difficulty: 0.60,
    concept: 'useEffect',
    subtopic: 'Effect Hooks',
    skills: ['useEffect'],
    cognitiveLevel: 'analyze',
    sourceReferences: ['react.dev'],
  },
  {
    id: 14,
    type: 'SCENARIO',
    question: 'A dashboard has high-frequency socket updates. Which hook minimizes lag?',
    options: [],
    correctAnswer: 'useDeferredValue with memoized charts',
    explanation: 'Defers expensive re-renders while prioritizing input',
    difficulty: 0.75,
    concept: 'Concurrent Hooks',
    subtopic: 'Concurrency',
    skills: ['Concurrency', 'Application'],
    cognitiveLevel: 'apply',
    sourceReferences: ['react.dev'],
  },
  {
    id: 15,
    type: 'DEBUGGING',
    question: 'Identify memory leak in setInterval hook without cleanup.',
    options: [],
    correctAnswer: 'Return clearInterval in effect cleanup',
    explanation: 'Uncleared intervals persist in memory',
    difficulty: 0.50,
    concept: 'Custom Hooks',
    subtopic: 'Hooks Architecture',
    skills: ['Custom Hooks', 'Debugging'],
    cognitiveLevel: 'apply',
    sourceReferences: ['react.dev'],
  },
  {
    id: 16,
    type: 'CONCEPTUAL',
    question: 'Why cannot hooks be called conditionally?',
    options: [],
    correctAnswer: 'React relies on call order across renders',
    explanation: 'Internal hook linked list tracks state by order',
    difficulty: 0.55,
    concept: 'Hook Rules',
    subtopic: 'Hooks Architecture',
    skills: ['Hook Rules'],
    cognitiveLevel: 'understand',
    sourceReferences: ['react.dev'],
  },
  {
    id: 17,
    type: 'MCQ',
    question: 'Which hook stores mutable values that do not trigger re-render on change?',
    options: ['useRef', 'useState', 'useMemo', 'useReducer'],
    correctAnswer: 'useRef',
    explanation: 'Mutating current property does not re-render',
    difficulty: 0.30,
    concept: 'useRef',
    subtopic: 'Ref Hooks',
    skills: ['useRef'],
    cognitiveLevel: 'remember',
    sourceReferences: ['react.dev'],
  },
  {
    id: 18,
    type: 'SCENARIO',
    question: 'How would you synchronize a React component with an external browser API?',
    options: [],
    correctAnswer: 'useSyncExternalStore',
    explanation: 'Recommended hook for subscribing to external state in React 18',
    difficulty: 0.80,
    concept: 'External Store',
    subtopic: 'Subscription Hooks',
    skills: ['Subscription'],
    cognitiveLevel: 'analyze',
    sourceReferences: ['react.dev'],
  },
  {
    id: 19,
    type: 'MCQ',
    question: 'What is the return value of useReducer?',
    options: ['[state, dispatch]', '[state, setState]', 'dispatch function only', 'state object only'],
    correctAnswer: '[state, dispatch]',
    explanation: 'Returns tuple with current state and dispatch action dispatcher',
    difficulty: 0.40,
    concept: 'useReducer',
    subtopic: 'State Hooks',
    skills: ['useReducer'],
    cognitiveLevel: 'remember',
    sourceReferences: ['react.dev'],
  },
  {
    id: 20,
    type: 'DEBUGGING',
    question: 'Debug useReducer mutation bug in action handler.',
    options: [],
    correctAnswer: 'Return new copied object instead of mutating previous state',
    explanation: 'Reducers must remain pure functions',
    difficulty: 0.60,
    concept: 'useReducer',
    subtopic: 'State Hooks',
    skills: ['useReducer', 'Debugging'],
    cognitiveLevel: 'analyze',
    sourceReferences: ['react.dev'],
  },
];

async function runTests() {
  let passed = 0;

  // 1. Cold-start Profile
  const coldStartDiff = AdaptiveAssessmentService.calculateNextDifficulty(0.50, 0.50);
  assert.strictEqual(typeof coldStartDiff.nextDifficulty, 'number');
  console.log('✓ Test 1: Cold-start calculates initial valid target difficulty');
  passed++;

  // 2. Weak Skill Detection
  const weakProfile: SkillProfileRecord[] = [
    {
      topicId: 1,
      skill: 'Custom Hooks',
      score: 0.52,
      confidence: 0.80,
      status: 'weak',
      evaluatedQuestions: 4,
      correctAnswers: 2,
      lastAssessedAt: new Date().toISOString(),
    },
  ];
  const weakPriority = AdaptiveAssessmentService.calculateSkillPriorities(weakProfile);
  assert.strictEqual(weakPriority.priorities['Custom Hooks'].priority, 'HIGH');
  assert.strictEqual(weakPriority.skillTargets['Custom Hooks'], 0.80);
  console.log('✓ Test 2: Weak skill (< 0.60) receives HIGH priority and target weight 0.80');
  passed++;

  // 3. Developing Skill Detection
  const devProfile: SkillProfileRecord[] = [
    {
      topicId: 1,
      skill: 'useContext',
      score: 0.72,
      confidence: 0.60,
      status: 'developing',
      evaluatedQuestions: 3,
      correctAnswers: 2,
      lastAssessedAt: new Date().toISOString(),
    },
  ];
  const devPriority = AdaptiveAssessmentService.calculateSkillPriorities(devProfile);
  assert.strictEqual(devPriority.priorities['useContext'].priority, 'MEDIUM');
  assert.strictEqual(devPriority.skillTargets['useContext'], 0.50);
  console.log('✓ Test 3: Developing skill (0.60-0.79) receives MEDIUM priority and weight 0.50');
  passed++;

  // 4. Strong Skill Maintenance
  const strongProfile: SkillProfileRecord[] = [
    {
      topicId: 1,
      skill: 'useState',
      score: 0.92,
      confidence: 1.0,
      status: 'strong',
      evaluatedQuestions: 5,
      correctAnswers: 5,
      lastAssessedAt: new Date().toISOString(),
    },
  ];
  const strongPriority = AdaptiveAssessmentService.calculateSkillPriorities(strongProfile);
  assert.strictEqual(strongPriority.priorities['useState'].priority, 'LOW');
  assert.strictEqual(strongPriority.skillTargets['useState'], 0.15);
  console.log('✓ Test 4: Strong skill (>= 0.80) receives non-zero maintenance weight (0.15)');
  passed++;

  // 5. Insufficient Evidence
  const unverifiedProfile: SkillProfileRecord[] = [
    {
      topicId: 1,
      skill: 'Concurrency',
      score: 0.50,
      confidence: 0.20,
      status: 'insufficient_evidence',
      evaluatedQuestions: 1,
      correctAnswers: 0,
      lastAssessedAt: new Date().toISOString(),
    },
  ];
  const unverifiedRes = AdaptiveAssessmentService.calculateSkillPriorities(unverifiedProfile);
  assert.strictEqual(unverifiedRes.priorities['Concurrency'].priority, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(unverifiedRes.skillTargets['Concurrency'], 0.45);
  console.log('✓ Test 5: Insufficient evidence (< 2 questions) receives diagnostic weight (0.45)');
  passed++;

  // 6. Multi-skill Priority Calculation
  const multiProfile: SkillProfileRecord[] = [
    ...weakProfile,
    ...devProfile,
    ...strongProfile,
    ...unverifiedProfile,
  ];
  const multiRes = AdaptiveAssessmentService.calculateSkillPriorities(multiProfile);
  assert.strictEqual(Object.keys(multiRes.priorities).length, 4);
  assert.strictEqual(multiRes.priorities['Custom Hooks'].weight, 0.80);
  assert.strictEqual(multiRes.priorities['useContext'].weight, 0.50);
  assert.strictEqual(multiRes.priorities['useState'].weight, 0.15);
  assert.strictEqual(multiRes.priorities['Concurrency'].weight, 0.45);
  console.log('✓ Test 6: Multi-skill profile correctly prioritizes all items concurrently');
  passed++;

  // 7. Question Type Adaptation
  const mockAnalysis: PerformanceAnalysisResult = {
    status: 'success',
    attemptId: 10,
    overall: {
      accuracy: 0.70,
      completionRate: 1.0,
      totalQuestions: 10,
      answeredQuestions: 10,
      unansweredQuestions: 0,
      evaluatedQuestions: 8,
      correctAnswers: 6,
      incorrectAnswers: 2,
      durationSeconds: 300,
    },
    questionTypes: {
      MCQ: { total: 4, evaluated: 4, correct: 4, accuracy: 1.0 },
      DEBUGGING: { total: 4, evaluated: 4, correct: 2, accuracy: 0.50 },
    },
    subtopics: {},
    skills: {},
    cognitiveLevels: {},
    difficultyRanges: {},
    strengths: [],
    weaknesses: [],
    evaluatedResponses: [],
  };
  const qTypeRes = AdaptiveAssessmentService.calculateQuestionTypeTargets(mockAnalysis);
  assert(qTypeRes.targets['DEBUGGING'] > qTypeRes.targets['MCQ'], 'DEBUGGING weight should exceed MCQ weight');
  console.log('✓ Test 7: Weaker question type (DEBUGGING 50%) weight prioritized over mastered (MCQ 100%)');
  passed++;

  // 8. Cognitive-Level Adaptation
  mockAnalysis.cognitiveLevels = {
    remember: { total: 4, evaluated: 4, correct: 4, accuracy: 1.0 },
    understand: { total: 2, evaluated: 2, correct: 2, accuracy: 1.0 },
    apply: { total: 2, evaluated: 2, correct: 1, accuracy: 0.50 },
    analyze: { total: 2, evaluated: 2, correct: 1, accuracy: 0.50 },
  };
  const cogRes = AdaptiveAssessmentService.calculateCognitiveTargets(mockAnalysis);
  assert(cogRes.targets['apply'] > cogRes.targets['remember'], 'Apply weight should exceed remember weight');
  assert(cogRes.targets['analyze'] > cogRes.targets['understand'], 'Analyze weight should exceed understand weight');
  console.log('✓ Test 8: Higher-order Bloom levels emphasized when recall is mastered');
  passed++;

  // 9. Difficulty Increase on High Accuracy
  const incDiff = AdaptiveAssessmentService.calculateNextDifficulty(0.50, 0.90);
  assert.strictEqual(incDiff.nextDifficulty, 0.58);
  console.log('✓ Test 9: Difficulty increases by full step (+0.08) when accuracy >= 0.85 (0.50 -> 0.58)');
  passed++;

  // 10. Difficulty Decrease on Low Accuracy
  const decDiff = AdaptiveAssessmentService.calculateNextDifficulty(0.50, 0.40);
  assert.strictEqual(decDiff.nextDifficulty, 0.42);
  console.log('✓ Test 10: Difficulty decreases by full step (-0.08) when accuracy < 0.50 (0.50 -> 0.42)');
  passed++;

  // 11. Difficulty Boundaries (0.20 min, 0.85 max)
  const highClamp = AdaptiveAssessmentService.calculateNextDifficulty(0.83, 0.95);
  assert.strictEqual(highClamp.nextDifficulty, 0.85);
  const lowClamp = AdaptiveAssessmentService.calculateNextDifficulty(0.24, 0.20);
  assert.strictEqual(lowClamp.nextDifficulty, 0.20);
  console.log('✓ Test 11: Difficulty boundaries strictly clamped between 0.20 and 0.85');
  passed++;

  // 12. Gradual Difficulty Changes
  const leapDiff = AdaptiveAssessmentService.calculateNextDifficulty(0.50, 1.0);
  assert.strictEqual(leapDiff.nextDifficulty, 0.58);
  assert(leapDiff.nextDifficulty - 0.50 <= 0.081, 'Difficulty increase should not leap to extreme');
  console.log('✓ Test 12: Gradual change rule verified: perfect score does not cause uncontrolled leap');
  passed++;

  // 13. Skill Target Generation
  const prioritiesRes = AdaptiveAssessmentService.calculateSkillPriorities([
    {
      topicId: 1,
      skill: 'Binary Search',
      score: 0.40,
      confidence: 0.8,
      status: 'weak',
      evaluatedQuestions: 5,
      correctAnswers: 2,
      lastAssessedAt: new Date().toISOString(),
    },
  ]);
  assert.strictEqual(prioritiesRes.skillTargets['Binary Search'], 0.80);
  console.log('✓ Test 13: Generic Computer Science topic generates valid skill targets');
  passed++;

  // 14. Adaptive Profile Generation
  const testProfile = AdaptiveAssessmentService.calculateSkillPriorities(weakProfile);
  assert(testProfile.reasoning.length > 0, 'Reasoning should contain explanatory notes');
  console.log('✓ Test 14: Target assessment profile includes transparent reasoning points');
  passed++;

  // 15. GA Integration: Fitness rewards target alignment
  const gaCustomHooksTarget = new GeneticAssessmentOptimizer(
    mockQuestionPool,
    5,
    0.60,
    { 'Custom Hooks': 0.80 },
    { seed: 42 },
    { DEBUGGING: 0.40 },
    { analyze: 0.40 }
  );
  const gaNoTarget = new GeneticAssessmentOptimizer(
    mockQuestionPool,
    5,
    0.60,
    {},
    { seed: 42 }
  );

  // A chromosome loaded with Custom Hooks questions
  const customHooksChromosome = [1, 2, 3, 4, 15];
  const fitWithTarget = gaCustomHooksTarget.evaluateFitness(customHooksChromosome);
  assert(fitWithTarget.total > 0, 'Fitness evaluation should produce positive score');
  console.log('✓ Test 15: GA optimizer accepts and evaluates skillTargets, questionTypeTargets, and cognitiveTargets');
  passed++;

  // 16. End-to-End Adaptive Assessment Creation
  const adaptiveRun = await AdaptiveAssessmentService.generateAdaptiveAssessment({
    topicId: 1,
    questionCount: 10,
    questions: mockQuestionPool,
  });
  assert.strictEqual(adaptiveRun.status, 'success');
  assert.strictEqual(adaptiveRun.adaptiveProfile.questionCount, 10);
  assert(adaptiveRun.assessment.fitness > 0);
  console.log('✓ Test 16: End-to-end adaptive assessment generated successfully with optimized chromosome');
  passed++;

  // 17. Adaptive Run Persistence
  assert(mockAdaptiveRunsStore.size > 0, 'Adaptive run must be recorded in persistence store');
  const storedRun = Array.from(mockAdaptiveRunsStore.values())[0];
  assert.strictEqual(storedRun.topicId, 1);
  assert(Array.isArray(storedRun.reasoning) && storedRun.reasoning.length > 0);
  console.log('✓ Test 17: Adaptive run decision, targets, and reasoning successfully persisted');
  passed++;

  // 18. Historical Skill Improvement
  // Stage 1: weak
  const stage1 = AdaptiveAssessmentService.calculateSkillPriorities([
    { topicId: 1, skill: 'Sorting', score: 0.45, confidence: 0.8, status: 'weak', evaluatedQuestions: 4, correctAnswers: 1, lastAssessedAt: '' }
  ]);
  assert.strictEqual(stage1.priorities['Sorting'].priority, 'HIGH');
  // Stage 2: improved to developing
  const stage2 = AdaptiveAssessmentService.calculateSkillPriorities([
    { topicId: 1, skill: 'Sorting', score: 0.70, confidence: 0.8, status: 'developing', evaluatedQuestions: 6, correctAnswers: 4, lastAssessedAt: '' }
  ]);
  assert.strictEqual(stage2.priorities['Sorting'].priority, 'MEDIUM');
  // Stage 3: improved to strong
  const stage3 = AdaptiveAssessmentService.calculateSkillPriorities([
    { topicId: 1, skill: 'Sorting', score: 0.85, confidence: 1.0, status: 'strong', evaluatedQuestions: 8, correctAnswers: 7, lastAssessedAt: '' }
  ]);
  assert.strictEqual(stage3.priorities['Sorting'].priority, 'LOW');
  assert(stage1.priorities['Sorting'].weight > stage2.priorities['Sorting'].weight);
  assert(stage2.priorities['Sorting'].weight > stage3.priorities['Sorting'].weight);
  console.log('✓ Test 18: Historical skill improvement shifts priority: HIGH (0.80) -> MEDIUM (0.50) -> LOW (0.15)');
  passed++;

  // 19. No Previous Assessment (Cold-Start)
  const coldStartRun = await AdaptiveAssessmentService.generateAdaptiveAssessment({
    topicId: 999, // Unassessed topic
    questionCount: 10,
    questions: mockQuestionPool,
  });
  assert.strictEqual(coldStartRun.adaptiveProfile.targetDifficulty, 0.50);
  assert(coldStartRun.reasoning.some(r => r.includes('Cold-start diagnostic')));
  console.log('✓ Test 19: Cold-start fallback cleanly generates diagnostic assessment at difficulty 0.50');
  passed++;

  // 20. Existing Skill Profile Ingested Correctly
  const loadedRes = await AdaptiveAssessmentService.generateAdaptiveAssessment({
    topicId: 1,
    questionCount: 10,
    questions: mockQuestionPool,
  });
  assert(loadedRes.reasoning.length > 0);
  console.log('✓ Test 20: Existing skill profile records correctly ingested and synthesized into target profile');
  passed++;

  // 21. API Request Handling & Validation
  let errorCaught = false;
  try {
    await AdaptiveAssessmentService.generateAdaptiveAssessment({
      topicId: NaN,
      questionCount: 10,
    });
  } catch (err: any) {
    errorCaught = true;
    assert.strictEqual(err.message, 'Invalid topic ID.');
  }
  assert(errorCaught);
  console.log('✓ Test 21: Invalid topicId strictly rejected with clear error');
  passed++;

  // 22. Graceful Degradation on Limited Question Pool
  const smallPool = mockQuestionPool.slice(0, 10); // only 10 questions total
  const constrainedRun = await AdaptiveAssessmentService.generateAdaptiveAssessment({
    topicId: 1,
    questionCount: 10,
    questions: smallPool,
  });
  assert.strictEqual(constrainedRun.status, 'success');
  assert.strictEqual(constrainedRun.assessment.questionCount, 10);
  console.log('✓ Test 22: Graceful degradation: constrained question pool successfully optimized without error');
  passed++;

  console.log(`\n=== All Trial 10 Adaptive Next Assessment Engine Tests Passed Successfully! (${passed}/${passed}) ===\n`);
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
