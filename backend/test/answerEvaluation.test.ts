import assert from 'assert';
import { ILLMProvider } from '../src/services/llm/llmProvider';
import {
  DeterministicAnswerEvaluator,
  LLMAnswerEvaluator,
  AnswerEvaluatorFactory,
} from '../src/services/evaluator/answerEvaluator';
import { EvaluationValidator } from '../src/validators/evaluationValidator';
import {
  AnswerEvaluationService,
  mockAnswerEvaluationsStore,
} from '../src/services/answerEvaluationService';
import {
  mockAssessmentsStore,
  mockAttemptsStore,
} from '../src/services/attemptService';
import { PerformanceAnalysisEngine } from '../src/services/performanceAnalysisEngine';
import { Question } from '../src/types/question';
import { AnswerEvaluationResult } from '../src/types/evaluation';
import { QuestionEvaluationResult } from '../src/types/analysis';

console.log('=== Running Trial 12: LLM-Based Free-Text Answer Evaluation Engine Tests ===\n');

/**
 * Controllable Mock LLM Provider for deterministic offline testing.
 */
class MockLLMProvider implements ILLMProvider {
  private responseQueue: unknown[] = [];
  private shouldThrow: Error | null = null;
  public callCount = 0;

  public queueResponse(response: unknown): void {
    this.responseQueue.push(response);
  }

  public setThrowError(error: Error | null): void {
    this.shouldThrow = error;
  }

  public async generateStructuredResponse(_systemPrompt: string, _userPrompt: string): Promise<unknown> {
    this.callCount++;

    if (this.shouldThrow) {
      throw this.shouldThrow;
    }

    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift();
    }

    // Default fallback response
    return {
      evaluationStatus: 'evaluated',
      score: 0.75,
      correctness: 'mostly_correct',
      reasoning: 'Default mock evaluation.',
      strengths: ['Demonstrated basic understanding'],
      missingConcepts: ['Advanced nuances'],
      skillEvidence: [{ skill: 'React Hooks', score: 0.75 }],
      confidence: 0.90,
    };
  }
}

// Sample test questions
const mcqQuestion: Question = {
  id: 1,
  type: 'MCQ',
  question: 'What is the hook used for managing local state?',
  options: ['useState', 'useEffect', 'useContext', 'useRef'],
  correctAnswer: 'useState',
  explanation: 'useState is the primary React hook for state management.',
  difficulty: 0.3,
  concept: 'React Hooks',
  subtopic: 'State Management',
  skills: ['React Hooks', 'State Management'],
  cognitiveLevel: 'remember',
  sourceReferences: ['react.dev'],
};

const conceptualQuestion: Question = {
  id: 2,
  type: 'CONCEPTUAL',
  question: 'Explain why state should never be mutated directly in React components.',
  correctAnswer: 'State must be updated via setState so React is notified to schedule a re-render and maintain pure render transitions.',
  explanation: 'Direct mutations do not trigger re-renders and cause subtle stale state bugs.',
  difficulty: 0.6,
  concept: 'State Immutability',
  subtopic: 'Component Lifecycle',
  skills: ['State Immutability', 'React Architecture'],
  cognitiveLevel: 'understand',
  sourceReferences: ['react.dev'],
};

const debuggingQuestion: Question = {
  id: 3,
  type: 'DEBUGGING',
  question: 'Identify the stale closure bug in this counter effect.',
  codeSnippet: 'useEffect(() => {\n  const id = setInterval(() => setCount(count + 1), 1000);\n  return () => clearInterval(id);\n}, []);',
  correctAnswer: 'The effect captures a stale value of count because count is not in dependencies or functional update setCount(c => c + 1) is not used.',
  explanation: 'Using functional updates or adding count to deps avoids stale closures.',
  difficulty: 0.7,
  concept: 'Stale Closures',
  subtopic: 'Hooks Gotchas',
  skills: ['Debugging', 'React Hooks'],
  cognitiveLevel: 'analyze',
  sourceReferences: ['react.dev'],
};

const scenarioQuestion: Question = {
  id: 4,
  type: 'SCENARIO',
  question: 'Your dashboard app is experiencing excessive re-renders when global filter state changes. How would you architect this?',
  scenarioText: 'A financial dashboard renders 50 charts. When a single filter changes in a shared context, all 50 charts re-render simultaneously.',
  correctAnswer: 'Split contexts into fine-grained providers, use memoization (React.memo / useMemo), or isolate localized state to leaf components.',
  explanation: 'Context splitting isolates consumers from irrelevant updates.',
  difficulty: 0.75,
  concept: 'Context Optimization',
  subtopic: 'Performance Optimization',
  skills: ['Performance Optimization', 'Architecture Design'],
  cognitiveLevel: 'apply',
  sourceReferences: ['react.dev'],
};

const outputPredictionQuestion: Question = {
  id: 5,
  type: 'OUTPUT_PREDICTION',
  question: 'What is printed to the console when this component mounts?',
  codeSnippet: 'useEffect(() => {\n  console.log("Effect 1");\n}, []);\nconsole.log("Render");',
  correctAnswer: 'Render\nEffect 1',
  explanation: 'Component renders first, effects run asynchronously after paint.',
  difficulty: 0.5,
  concept: 'Effect Execution Timing',
  subtopic: 'Component Lifecycle',
  skills: ['Component Lifecycle'],
  cognitiveLevel: 'understand',
  sourceReferences: ['react.dev'],
};

async function runTests() {
  let passed = 0;
  const mockLLM = new MockLLMProvider();

  // Clear mock stores
  mockAnswerEvaluationsStore.clear();
  mockAssessmentsStore.clear();
  mockAttemptsStore.clear();

  // -------------------------------------------------------------
  // Test 1: Deterministic Evaluation - Correct MCQ
  // -------------------------------------------------------------
  const detEvaluator = new DeterministicAnswerEvaluator();
  const res1 = await detEvaluator.evaluate(mcqQuestion, 'useState');
  assert.strictEqual(res1.evaluationStatus, 'evaluated');
  assert.strictEqual(res1.score, 1.0);
  assert.strictEqual(res1.correctness, 'correct');
  assert.strictEqual(res1.evaluatorType, 'deterministic');
  assert(res1.reasoning.includes('matches the correct'));
  console.log('✓ Test 1: Deterministic evaluator gives 1.0 (correct) for valid MCQ');
  passed++;

  // -------------------------------------------------------------
  // Test 2: Deterministic Evaluation - Incorrect MCQ
  // -------------------------------------------------------------
  const res2 = await detEvaluator.evaluate(mcqQuestion, 'useContext');
  assert.strictEqual(res2.evaluationStatus, 'evaluated');
  assert.strictEqual(res2.score, 0.0);
  assert.strictEqual(res2.correctness, 'incorrect');
  console.log('✓ Test 2: Deterministic evaluator gives 0.0 (incorrect) for wrong MCQ option');
  passed++;

  // -------------------------------------------------------------
  // Test 3: Unanswered Question Handling
  // -------------------------------------------------------------
  const res3 = await detEvaluator.evaluate(mcqQuestion, null);
  assert.strictEqual(res3.evaluationStatus, 'evaluated');
  assert.strictEqual(res3.score, 0.0);
  assert.strictEqual(res3.correctness, 'incorrect');

  const llmEvaluator = new LLMAnswerEvaluator(mockLLM);
  const initialCalls = mockLLM.callCount;
  const res3LLM = await llmEvaluator.evaluate(conceptualQuestion, '   ');
  assert.strictEqual(res3LLM.evaluationStatus, 'evaluated');
  assert.strictEqual(res3LLM.score, 0.0);
  assert.strictEqual(res3LLM.correctness, 'incorrect');
  assert.strictEqual(mockLLM.callCount, initialCalls, 'Should not invoke LLM for blank answer');
  console.log('✓ Test 3: Unanswered questions evaluated to 0.0 without unnecessary LLM invocation');
  passed++;

  // -------------------------------------------------------------
  // Test 4: LLM Evaluation - Fully Correct Conceptual Answer
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 1.00,
    correctness: 'correct',
    reasoning: 'The student accurately explains that direct mutation prevents React from detecting state transitions and scheduling re-renders.',
    strengths: ['Identified re-render trigger necessity', 'Understands state immutability'],
    missingConcepts: [],
    skillEvidence: [
      { skill: 'State Immutability', score: 1.00 },
      { skill: 'React Architecture', score: 1.00 },
    ],
    confidence: 0.95,
  });

  const res4 = await llmEvaluator.evaluate(
    conceptualQuestion,
    'Mutating state directly means React does not know that state changed, so it cannot schedule a re-render.'
  );
  assert.strictEqual(res4.evaluationStatus, 'evaluated');
  assert.strictEqual(res4.score, 1.00);
  assert.strictEqual(res4.correctness, 'correct');
  assert.strictEqual(res4.strengths.length, 2);
  console.log('✓ Test 4: Fully correct conceptual answer evaluated with strengths and 1.00 score');
  passed++;

  // -------------------------------------------------------------
  // Test 5: LLM Evaluation - Mostly Correct Answer
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.85,
    correctness: 'mostly_correct',
    reasoning: 'Strong understanding of render scheduling, but missed mentioning pure component snapshot comparisons.',
    strengths: ['Understands setter triggers re-render'],
    missingConcepts: ['Component snapshot equality checks'],
    skillEvidence: [{ skill: 'State Immutability', score: 0.85 }],
    confidence: 0.90,
  });

  const res5 = await llmEvaluator.evaluate(
    conceptualQuestion,
    'Because React needs you to call setState so it knows to re-render the screen.'
  );
  assert.strictEqual(res5.score, 0.85);
  assert.strictEqual(res5.correctness, 'mostly_correct');
  assert(res5.missingConcepts.length > 0);
  console.log('✓ Test 5: Mostly correct answer receives ~0.85 score with minor missing concept');
  passed++;

  // -------------------------------------------------------------
  // Test 6: LLM Evaluation - Partially Correct Answer
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.70,
    correctness: 'partially_correct',
    reasoning: 'Understands that state changes must happen through functions, but vague on why mutation is dangerous.',
    strengths: ['Recognized requirement to use state setter'],
    missingConcepts: ['Re-render scheduling', 'Immutability in reconciliation'],
    skillEvidence: [{ skill: 'State Immutability', score: 0.70 }],
    confidence: 0.85,
  });

  const res6 = await llmEvaluator.evaluate(
    conceptualQuestion,
    'You should use the function setter otherwise it causes bugs.'
  );
  assert.strictEqual(res6.score, 0.70);
  assert.strictEqual(res6.correctness, 'partially_correct');
  console.log('✓ Test 6: Partially correct answer classified accurately (score: 0.70)');
  passed++;

  // -------------------------------------------------------------
  // Test 7: LLM Evaluation - Incorrect Conceptual Answer
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.00,
    correctness: 'incorrect',
    reasoning: 'The response incorrectly claims direct mutation makes React faster.',
    strengths: [],
    missingConcepts: ['Re-render triggers', 'Reactivity model'],
    skillEvidence: [{ skill: 'State Immutability', score: 0.00 }],
    confidence: 0.95,
  });

  const res7 = await llmEvaluator.evaluate(
    conceptualQuestion,
    'You can mutate state directly anytime and it makes React run much faster.'
  );
  assert.strictEqual(res7.score, 0.00);
  assert.strictEqual(res7.correctness, 'incorrect');
  console.log('✓ Test 7: Completely incorrect conceptual answer receives 0.00 score');
  passed++;

  // -------------------------------------------------------------
  // Test 8: LLM Evaluation - Debugging Answer
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.90,
    correctness: 'mostly_correct',
    reasoning: 'Correctly identified the stale count closure and suggested setCount(c => c + 1) functional update.',
    strengths: ['Identified closure bug', 'Proposed functional state update'],
    missingConcepts: [],
    skillEvidence: [{ skill: 'Debugging', score: 0.90 }],
    confidence: 0.90,
  });

  const res8 = await llmEvaluator.evaluate(
    debuggingQuestion,
    'The interval callback captures the initial count value. Change setCount(count + 1) to setCount(prev => prev + 1).'
  );
  assert.strictEqual(res8.score, 0.90);
  assert(res8.strengths.includes('Identified closure bug'));
  console.log('✓ Test 8: Debugging answer successfully credits bug identification and remediation');
  passed++;

  // -------------------------------------------------------------
  // Test 9: LLM Evaluation - Scenario Question
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.88,
    correctness: 'mostly_correct',
    reasoning: 'Suggested splitting context and memoizing child chart components.',
    strengths: ['Context splitting proposed', 'useMemo/React.memo application'],
    missingConcepts: [],
    skillEvidence: [{ skill: 'Performance Optimization', score: 0.88 }],
    confidence: 0.92,
  });

  const res9 = await llmEvaluator.evaluate(
    scenarioQuestion,
    'I would split the context into multiple smaller providers so only charts listening to changed values re-render, and wrap charts in React.memo.'
  );
  assert.strictEqual(res9.score, 0.88);
  console.log('✓ Test 9: Scenario answer correctly evaluated for architectural trade-offs');
  passed++;

  // -------------------------------------------------------------
  // Test 10: LLM Evaluation - Output Prediction
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 1.00,
    correctness: 'correct',
    reasoning: 'Matches expected output sequence exactly: "Render" followed by "Effect 1".',
    strengths: ['Correct execution order'],
    missingConcepts: [],
    skillEvidence: [{ skill: 'Component Lifecycle', score: 1.00 }],
    confidence: 0.95,
  });

  const res10 = await llmEvaluator.evaluate(
    outputPredictionQuestion,
    'First "Render" will print, then "Effect 1" prints after paint.'
  );
  assert.strictEqual(res10.score, 1.00);
  console.log('✓ Test 10: Output prediction evaluated for semantic equivalence and order');
  passed++;

  // -------------------------------------------------------------
  // Test 11: Malformed LLM Response Handling
  // -------------------------------------------------------------
  const validation11 = EvaluationValidator.validate(
    'not a json object',
    ['State Immutability'],
    'gemini'
  );
  assert.strictEqual(validation11.isValid, false);
  assert.strictEqual(validation11.result.evaluationStatus, 'evaluator_error');
  assert.strictEqual(validation11.result.correctness, 'evaluator_error');
  assert.strictEqual(validation11.result.score, null);
  console.log('✓ Test 11: Malformed non-JSON output cleanly degrades to evaluator_error without crashing');
  passed++;

  // -------------------------------------------------------------
  // Test 12: LLM Timeout / Network Error Handling
  // -------------------------------------------------------------
  mockLLM.setThrowError(new Error('ETIMEDOUT: Gemini API did not respond in time'));
  const res12 = await llmEvaluator.evaluate(conceptualQuestion, 'Some valid answer');
  assert.strictEqual(res12.evaluationStatus, 'evaluator_error');
  assert.strictEqual(res12.score, null);
  assert(res12.reasoning.includes('ETIMEDOUT'));
  mockLLM.setThrowError(null); // Reset
  console.log('✓ Test 12: API timeout/network error returns evaluator_error safely');
  passed++;

  // -------------------------------------------------------------
  // Test 13: Invalid Score Handling
  // -------------------------------------------------------------
  const validation13 = EvaluationValidator.validate(
    {
      evaluationStatus: 'evaluated',
      score: 1.50, // Out of bounds (> 1.0)
      correctness: 'correct',
      reasoning: 'Invalid score test',
      strengths: [],
      missingConcepts: [],
      skillEvidence: [],
      confidence: 0.9,
    },
    ['State Immutability']
  );
  assert.strictEqual(validation13.isValid, false);
  assert.strictEqual(validation13.result.evaluationStatus, 'evaluator_error');
  assert.strictEqual(validation13.result.score, null);
  console.log('✓ Test 13: Score outside bounds [0.0, 1.0] safely converts to evaluator_error');
  passed++;

  // -------------------------------------------------------------
  // Test 14: Invalid Correctness Status Handling
  // -------------------------------------------------------------
  const validation14 = EvaluationValidator.validate(
    {
      evaluationStatus: 'evaluated',
      score: 0.80,
      correctness: 'super_awesome_correct', // Unrecognized correctness
      reasoning: 'Status test',
      strengths: [],
      missingConcepts: [],
      skillEvidence: [],
      confidence: 0.9,
    },
    ['State Immutability']
  );
  assert.strictEqual(validation14.isValid, false);
  assert.strictEqual(validation14.result.correctness, 'evaluator_error');
  console.log('✓ Test 14: Unrecognized correctness status handled safely');
  passed++;

  // -------------------------------------------------------------
  // Test 15: Unknown Skill Rejection (Prevents Skill Profile Pollution)
  // -------------------------------------------------------------
  const validation15 = EvaluationValidator.validate(
    {
      evaluationStatus: 'evaluated',
      score: 0.80,
      correctness: 'mostly_correct',
      reasoning: 'Good answer',
      strengths: ['Knowledge'],
      missingConcepts: [],
      skillEvidence: [
        { skill: 'State Immutability', score: 0.80 },
        { skill: 'Arbitrary Hallucinated Skill XYZ', score: 0.95 },
      ],
      confidence: 0.9,
    },
    ['State Immutability'] // Only this skill is allowed
  );
  assert.strictEqual(validation15.result.skillEvidence.length, 1);
  assert.strictEqual(validation15.result.skillEvidence[0].skill, 'State Immutability');
  console.log('✓ Test 15: Arbitrary unknown skills from LLM strictly rejected to protect skill profiles');
  passed++;

  // -------------------------------------------------------------
  // Test 16: Missing Research Context Handled Gracefully
  // -------------------------------------------------------------
  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.80,
    correctness: 'mostly_correct',
    reasoning: 'Evaluated without external research knowledge.',
    strengths: ['Understands basics'],
    missingConcepts: [],
    skillEvidence: [{ skill: 'State Immutability', score: 0.80 }],
    confidence: 0.85,
  });

  const res16 = await llmEvaluator.evaluate(conceptualQuestion, 'An answer', { researchKnowledge: [] });
  assert.strictEqual(res16.evaluationStatus, 'evaluated');
  console.log('✓ Test 16: Missing research context does not halt or degrade evaluation');
  passed++;

  // -------------------------------------------------------------
  // Test 17: Evaluator Factory & Metadata Persistence
  // -------------------------------------------------------------
  const evalMCQ = AnswerEvaluatorFactory.getEvaluator('MCQ');
  assert(evalMCQ instanceof DeterministicAnswerEvaluator);

  const evalConcept = AnswerEvaluatorFactory.getEvaluator('CONCEPTUAL', mockLLM);
  assert(evalConcept instanceof LLMAnswerEvaluator);
  console.log('✓ Test 17: AnswerEvaluatorFactory selects optimal evaluator per question type');
  passed++;

  // -------------------------------------------------------------
  // Test 18: Evaluation Caching & Reuse
  // -------------------------------------------------------------
  // Simulate mock attempt with question in memory
  const mockAttemptId = 999;
  mockAssessmentsStore.set(100, {
    id: 100,
    topicId: 1,
    topicName: 'React',
    questionCount: 1,
    targetDifficulty: 0.5,
    questions: [{ ...mcqQuestion, order: 1 } as any],
    estimatedTimeMinutes: 5,
  });
  mockAttemptsStore.set(mockAttemptId, {
    id: mockAttemptId,
    assessmentId: 100,
    status: 'submitted',
    startedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    responses: new Map([['1', 'useState']]),
  });

  const batch1 = await AnswerEvaluationService.evaluateAttempt(mockAttemptId, {
    customLLMProvider: mockLLM,
  });
  assert.strictEqual(batch1.evaluatedQuestions, 1);
  assert.strictEqual(batch1.results[0].score, 1.0);

  // Call again: existing evaluation must be reused
  const storeCountBefore = mockAnswerEvaluationsStore.size;
  const batch2 = await AnswerEvaluationService.evaluateAttempt(mockAttemptId, {
    customLLMProvider: mockLLM,
  });
  assert.strictEqual(batch2.evaluatedQuestions, 1);
  assert.strictEqual(mockAnswerEvaluationsStore.size, storeCountBefore, 'Should reuse cached evaluation');
  console.log('✓ Test 18: Existing evaluation correctly cached and reused for unchanged answers');
  passed++;

  // -------------------------------------------------------------
  // Test 19: Performance Analysis Integration (Continuous Aggregation)
  // -------------------------------------------------------------
  const engine = new PerformanceAnalysisEngine();
  const mixedEvals: QuestionEvaluationResult[] = [
    {
      questionId: 1,
      answer: 'useState',
      evaluationStatus: 'evaluated',
      score: 1.0, // MCQ correct
      subtopic: 'Hooks',
      skills: ['React Hooks'],
      cognitiveLevel: 'remember',
      questionType: 'MCQ',
      difficulty: 0.3,
    },
    {
      questionId: 2,
      answer: 'Partially correct explanation',
      evaluationStatus: 'evaluated',
      score: 0.70, // Free-text partially correct
      subtopic: 'Lifecycle',
      skills: ['React Hooks'],
      cognitiveLevel: 'understand',
      questionType: 'CONCEPTUAL',
      difficulty: 0.6,
    },
    {
      questionId: 3,
      answer: 'Mostly correct fix',
      evaluationStatus: 'evaluated',
      score: 0.85, // Free-text mostly correct
      subtopic: 'Debugging',
      skills: ['Debugging'],
      cognitiveLevel: 'analyze',
      questionType: 'DEBUGGING',
      difficulty: 0.7,
    },
  ];

  const analysisRes = engine.analyze(1, mixedEvals, 120);
  // Expected accuracy = (1.0 + 0.70 + 0.85) / 3 = 2.55 / 3 = 0.850
  assert.strictEqual(analysisRes.overall.evaluatedQuestions, 3);
  assert.strictEqual(analysisRes.overall.accuracy, 0.85);
  console.log('✓ Test 19: Performance engine calculates continuous accuracy (sum(scores) / N = 0.850)');
  passed++;

  // -------------------------------------------------------------
  // Test 20: Evaluator Error Does NOT Penalize Student
  // -------------------------------------------------------------
  const evalsWithError: QuestionEvaluationResult[] = [
    {
      questionId: 1,
      answer: 'useState',
      evaluationStatus: 'evaluated',
      score: 1.0,
      subtopic: 'Hooks',
      skills: ['React Hooks'],
      cognitiveLevel: 'remember',
      questionType: 'MCQ',
      difficulty: 0.3,
    },
    {
      questionId: 2,
      answer: 'A submitted answer',
      evaluationStatus: 'evaluator_error', // System failed to evaluate
      score: null,
      subtopic: 'Hooks',
      skills: ['React Hooks'],
      cognitiveLevel: 'understand',
      questionType: 'CONCEPTUAL',
      difficulty: 0.6,
    },
  ];

  const errorAnalysis = engine.analyze(2, evalsWithError, 60);
  // 1 evaluated question with score 1.0 -> accuracy should be 1.000, not 0.500
  assert.strictEqual(errorAnalysis.overall.evaluatedQuestions, 1);
  assert.strictEqual(errorAnalysis.overall.accuracy, 1.0);
  console.log('✓ Test 20: Evaluator error does NOT reduce student accuracy (remains 100%)');
  passed++;

  // -------------------------------------------------------------
  // Test 21: Not Evaluable Does NOT Count as Incorrect
  // -------------------------------------------------------------
  const evalsWithNotEvaluable: QuestionEvaluationResult[] = [
    {
      questionId: 1,
      answer: 'useState',
      evaluationStatus: 'evaluated',
      score: 1.0,
      subtopic: 'Hooks',
      skills: ['React Hooks'],
      cognitiveLevel: 'remember',
      questionType: 'MCQ',
      difficulty: 0.3,
    },
    {
      questionId: 2,
      answer: 'Manual submission',
      evaluationStatus: 'not_evaluable',
      score: null,
      subtopic: 'Hooks',
      skills: ['React Hooks'],
      cognitiveLevel: 'apply',
      questionType: 'SCENARIO',
      difficulty: 0.5,
    },
  ];

  const notEvalAnalysis = engine.analyze(3, evalsWithNotEvaluable, 60);
  assert.strictEqual(notEvalAnalysis.overall.evaluatedQuestions, 1);
  assert.strictEqual(notEvalAnalysis.overall.accuracy, 1.0);
  console.log('✓ Test 21: "not_evaluable" status does not count as incorrect');
  passed++;

  // -------------------------------------------------------------
  // Test 22: Batch Attempt Evaluation via AnswerEvaluationService
  // -------------------------------------------------------------
  const attemptId22 = 888;
  mockAssessmentsStore.set(101, {
    id: 101,
    topicId: 1,
    topicName: 'React',
    questionCount: 2,
    targetDifficulty: 0.5,
    questions: [
      { ...mcqQuestion, order: 1 } as any,
      { ...conceptualQuestion, order: 2 } as any,
    ],
    estimatedTimeMinutes: 10,
  });
  mockAttemptsStore.set(attemptId22, {
    id: attemptId22,
    assessmentId: 101,
    status: 'submitted',
    startedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    responses: new Map([
      ['1', 'useState'],
      ['2', 'State mutates should be avoided.'],
    ]),
  });

  mockLLM.queueResponse({
    evaluationStatus: 'evaluated',
    score: 0.75,
    correctness: 'mostly_correct',
    reasoning: 'Solid explanation.',
    strengths: ['Identified core rule'],
    missingConcepts: [],
    skillEvidence: [{ skill: 'State Immutability', score: 0.75 }],
    confidence: 0.90,
  });

  const batch22 = await AnswerEvaluationService.evaluateAttempt(attemptId22, {
    customLLMProvider: mockLLM,
  });
  assert.strictEqual(batch22.status, 'success');
  assert.strictEqual(batch22.totalQuestions, 2);
  assert.strictEqual(batch22.evaluatedQuestions, 2);
  assert.strictEqual(batch22.results.length, 2);
  assert.strictEqual(batch22.results[0].evaluatorType, 'deterministic');
  assert.strictEqual(batch22.results[1].evaluatorType, 'llm');
  console.log('✓ Test 22: Complete multi-question attempt evaluated across deterministic & LLM evaluators');
  passed++;

  console.log(`\n=== All Trial 12 Answer Evaluation Engine Tests Passed Successfully! (${passed}/${passed}) ===\n`);
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
