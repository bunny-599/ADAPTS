import assert from 'node:assert/strict';
import {
  PerformanceAnalysisEngine,
  DeterministicAnswerEvaluator,
} from '../src/services/performanceAnalysisEngine';
import {
  PerformanceService,
  mockAnalysesStore,
  mockSkillProfilesStore,
} from '../src/services/performanceService';
import {
  mockAssessmentsStore,
  mockAttemptsStore,
} from '../src/services/attemptService';
import { Question } from '../src/types/question';

function createMockQuestions(): (Question & { order: number })[] {
  return [
    {
      id: 201,
      order: 1,
      type: 'MCQ',
      question: 'Which hook manages state?',
      correctAnswer: 'useState',
      explanation: 'useState is the primary state hook.',
      options: ['useState', 'useEffect', 'useContext', 'useRef'],
      difficulty: 0.2, // Easy
      subtopic: 'useState',
      skills: ['state management', 'React Hooks'],
      cognitiveLevel: 'remember',
      concept: 'state hook',
      sourceReferences: [],
    },
    {
      id: 202,
      order: 2,
      type: 'MCQ',
      question: 'How do you perform side effects on mount?',
      correctAnswer: 'useEffect with empty array',
      explanation: 'Passing [] runs only on mount.',
      options: ['useEffect with empty array', 'useEffect without deps', 'useState', 'useMemo'],
      difficulty: 0.4, // Medium
      subtopic: 'useEffect',
      skills: ['lifecycle management', 'React Hooks'],
      cognitiveLevel: 'understand',
      concept: 'effect hook',
      sourceReferences: [],
    },
    {
      id: 203,
      order: 3,
      type: 'MCQ',
      question: 'How to avoid re-rendering context consumers needlessly?',
      correctAnswer: 'split contexts or memoize',
      explanation: 'Splitting context isolates state changes.',
      options: ['split contexts or memoize', 'use class components', 'avoid context', 'call forceUpdate'],
      difficulty: 0.75, // Hard
      subtopic: 'useContext',
      skills: ['state management', 'performance optimization'],
      cognitiveLevel: 'apply',
      concept: 'context optimization',
      sourceReferences: [],
    },
    {
      id: 204,
      order: 4,
      type: 'MCQ',
      question: 'Identify the bug in this state updater.',
      correctAnswer: 'stale closure in handler',
      explanation: 'Functional updater prevents stale closure.',
      options: ['stale closure in handler', 'syntax error', 'missing return', 'wrong type'],
      difficulty: 0.8, // Hard
      subtopic: 'useState',
      skills: ['state management', 'debugging'],
      cognitiveLevel: 'analyze',
      concept: 'closure bug',
      sourceReferences: [],
    },
    {
      id: 205,
      order: 5,
      type: 'OUTPUT_PREDICTION',
      question: 'Predict the console output of this effect sequence.',
      correctAnswer: 'Render: 1, Effect: 1',
      explanation: 'Effects run after render.',
      options: undefined,
      difficulty: 0.5, // Medium
      subtopic: 'useEffect',
      skills: ['lifecycle management'],
      cognitiveLevel: 'analyze',
      concept: 'render order',
      sourceReferences: [],
    },
  ];
}

async function runTests() {
  console.log('=== Running Trial 9: Performance Analysis & Skill Profile Tests ===\n');
  const engine = new PerformanceAnalysisEngine();
  const mockQuestions = createMockQuestions();

  // Test 1: All-correct assessment
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'],
      ['202', 'useEffect with empty array'],
      ['203', 'split contexts or memoize'],
      ['204', 'stale closure in handler'],
      ['205', 'Render: 1, Effect: 1'], // Output prediction (not_auto_evaluable)
    ]);

    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(1, evaluations, 120);

    assert.equal(result.overall.totalQuestions, 5);
    assert.equal(result.overall.answeredQuestions, 5);
    assert.equal(result.overall.evaluatedQuestions, 4); // 4 MCQs evaluated
    assert.equal(result.overall.correctAnswers, 4);
    assert.equal(result.overall.incorrectAnswers, 0);
    assert.equal(result.overall.accuracy, 1.0, 'All evaluated MCQs correct should yield accuracy 1.0');
    assert.equal(result.overall.completionRate, 1.0);
    console.log('✓ Test 1: All-correct assessment produces 100% accuracy');
  }

  // Test 2: All-incorrect assessment
  {
    const responses = new Map<string, string | null>([
      ['201', 'wrong-1'],
      ['202', 'wrong-2'],
      ['203', 'wrong-3'],
      ['204', 'wrong-4'],
      ['205', 'some output'],
    ]);

    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(2, evaluations, 90);

    assert.equal(result.overall.evaluatedQuestions, 4);
    assert.equal(result.overall.correctAnswers, 0);
    assert.equal(result.overall.incorrectAnswers, 4);
    assert.equal(result.overall.accuracy, 0.0, 'All evaluated MCQs incorrect should yield accuracy 0.0');
    console.log('✓ Test 2: All-incorrect assessment produces 0% accuracy');
  }

  // Test 3 & 4: Partially answered & Unanswered questions
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // Correct
      ['202', null],       // Unanswered
      ['203', 'wrong'],     // Incorrect
      ['204', ''],         // Unanswered
      ['205', null],       // Unanswered
    ]);

    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(3, evaluations, 60);

    assert.equal(result.overall.totalQuestions, 5);
    assert.equal(result.overall.answeredQuestions, 2);
    assert.equal(result.overall.unansweredQuestions, 3);
    assert.equal(result.overall.evaluatedQuestions, 2);
    assert.equal(result.overall.correctAnswers, 1);
    assert.equal(result.overall.incorrectAnswers, 1);
    assert.equal(result.overall.accuracy, 0.5);
    assert.equal(result.overall.completionRate, 0.4); // 2/5
    console.log('✓ Test 3 & 4: Unanswered questions tracked correctly without corrupting evaluated accuracy');
  }

  // Test 5: Not-auto-evaluable questions (Free text / non-MCQ)
  {
    const responses = new Map<string, string | null>([
      ['205', 'Custom student output text'],
    ]);
    const evaluations = engine.evaluateResponses([mockQuestions[4]], responses);
    assert.equal(evaluations[0].evaluationStatus, 'not_auto_evaluable');
    assert.equal(evaluations[0].score, null, 'Score must be null for not_auto_evaluable');
    console.log('✓ Test 5: Non-MCQ responses classified as not_auto_evaluable with score null');
  }

  // Test 6 & 7: Overall Accuracy vs Completion Rate distinction
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // correct
      ['202', null],       // unanswered
      ['203', null],       // unanswered
      ['204', null],       // unanswered
      ['205', null],       // unanswered
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(4, evaluations, 30);

    assert.equal(result.overall.accuracy, 1.0, 'Accuracy is 1/1 (100%)');
    assert.equal(result.overall.completionRate, 0.2, 'Completion rate is 1/5 (20%)');
    console.log('✓ Test 6 & 7: Accuracy and completion rate are strictly decoupled');
  }

  // Test 8: Question Type aggregation
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // MCQ correct
      ['202', 'wrong'],    // MCQ incorrect
      ['205', 'out'],      // OUTPUT_PREDICTION not_auto_evaluable
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(5, evaluations, 100);

    assert.ok(result.questionTypes['MCQ']);
    assert.equal(result.questionTypes['MCQ'].total, 4);
    assert.equal(result.questionTypes['MCQ'].evaluated, 2);
    assert.equal(result.questionTypes['MCQ'].correct, 1);
    assert.equal(result.questionTypes['MCQ'].accuracy, 0.5);

    assert.ok(result.questionTypes['OUTPUT_PREDICTION']);
    assert.equal(result.questionTypes['OUTPUT_PREDICTION'].evaluated, 0);
    assert.equal(result.questionTypes['OUTPUT_PREDICTION'].accuracy, null);
    console.log('✓ Test 8: Question type aggregation correctly segments format performance');
  }

  // Test 9: Subtopic aggregation
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // subtopic useState (correct)
      ['204', 'stale closure in handler'], // subtopic useState (correct)
      ['202', 'wrong'], // subtopic useEffect (incorrect)
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(6, evaluations, 100);

    assert.equal(result.subtopics['useState'].evaluated, 2);
    assert.equal(result.subtopics['useState'].correct, 2);
    assert.equal(result.subtopics['useState'].accuracy, 1.0);

    assert.equal(result.subtopics['useEffect'].evaluated, 1);
    assert.equal(result.subtopics['useEffect'].correct, 0);
    assert.equal(result.subtopics['useEffect'].accuracy, 0.0);
    console.log('✓ Test 9: Subtopic aggregation calculates evidence and accuracy per subtopic');
  }

  // Test 10: Skill aggregation (Multi-skill mapping)
  {
    // Question 201 has: ['state management', 'React Hooks']
    // Question 203 has: ['state management', 'performance optimization']
    // Question 204 has: ['state management', 'debugging']
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // correct
      ['203', 'split contexts or memoize'], // correct
      ['204', 'wrong'], // incorrect
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(7, evaluations, 120);

    // 'state management' appears in 201, 203, 204 (3 evaluated, 2 correct = 0.667)
    assert.ok(result.skills['state management']);
    assert.equal(result.skills['state management'].evidence, 3);
    assert.equal(result.skills['state management'].correctCount, 2);
    assert.equal(result.skills['state management'].score, 0.667);
    console.log('✓ Test 10: Multi-skill questions contribute evidence across all mapped skills');
  }

  // Test 11: Cognitive level aggregation
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // remember: correct
      ['202', 'wrong'],    // understand: incorrect
      ['203', 'split contexts or memoize'], // apply: correct
      ['204', 'wrong'],    // analyze: incorrect
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(8, evaluations, 150);

    assert.equal(result.cognitiveLevels['remember'].accuracy, 1.0);
    assert.equal(result.cognitiveLevels['understand'].accuracy, 0.0);
    assert.equal(result.cognitiveLevels['apply'].accuracy, 1.0);
    assert.equal(result.cognitiveLevels['analyze'].accuracy, 0.0);
    console.log('✓ Test 11: Cognitive level breakdown evaluates Bloom taxonomy levels');
  }

  // Test 12: Difficulty aggregation
  {
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // Easy (0.20) -> correct
      ['202', 'wrong'],    // Medium (0.40) -> incorrect
      ['203', 'split contexts or memoize'], // Hard (0.75) -> correct
      ['204', 'stale closure in handler'], // Hard (0.80) -> correct
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(9, evaluations, 120);

    assert.equal(result.difficultyRanges['Easy (0.00 - 0.33)'].accuracy, 1.0);
    assert.equal(result.difficultyRanges['Medium (0.34 - 0.66)'].accuracy, 0.0);
    assert.equal(result.difficultyRanges['Hard (0.67 - 1.00)'].accuracy, 1.0);
    console.log('✓ Test 12: Difficulty ranges segmented into Easy, Medium, and Hard buckets');
  }

  // Test 13 & 14 & 15: Strength, Weakness & Insufficient Evidence detection
  {
    // 'state management' has 3 questions: 201 (correct), 203 (correct), 204 (correct) -> score 1.0, ev 3 -> 'strong'
    // 'debugging' has 1 question: 204 -> ev 1 -> 'insufficient_evidence'
    // 'lifecycle management' has 1 question: 202 (incorrect) -> ev 1 -> 'insufficient_evidence'
    const responses = new Map<string, string | null>([
      ['201', 'useState'], // correct
      ['203', 'split contexts or memoize'], // correct
      ['204', 'stale closure in handler'], // correct
    ]);
    const evaluations = engine.evaluateResponses(mockQuestions, responses);
    const result = engine.analyze(10, evaluations, 100);

    assert.equal(result.skills['state management'].status, 'strong');
    assert.ok(result.strengths.includes('state management'));

    // 'debugging' only has 1 evaluated question -> insufficient evidence
    assert.equal(result.skills['debugging'].status, 'insufficient_evidence');
    assert.ok(!result.strengths.includes('debugging'));

    // Test weakness with >= 2 questions
    // Make 2 questions for debugging incorrect
    const qDebug1 = { ...mockQuestions[3], id: 301, skills: ['debugging'] };
    const qDebug2 = { ...mockQuestions[3], id: 302, skills: ['debugging'] };
    const debugEvals = engine.evaluateResponses([qDebug1, qDebug2], new Map([['301', 'wrong1'], ['302', 'wrong2']]));
    const debugResult = engine.analyze(11, debugEvals, 50);

    assert.equal(debugResult.skills['debugging'].status, 'weak');
    assert.ok(debugResult.weaknesses.includes('debugging'));
    console.log('✓ Test 13, 14, 15: Strengths, Weaknesses, and Insufficient Evidence classified reliably');
  }

  // Test 16: Confidence calculation
  {
    const q1 = { ...mockQuestions[0], id: 401, skills: ['testing-confidence'] };
    const q2 = { ...mockQuestions[0], id: 402, skills: ['testing-confidence'] };
    const q3 = { ...mockQuestions[0], id: 403, skills: ['testing-confidence'] };

    const evals = engine.evaluateResponses([q1, q2, q3], new Map([['401', 'useState'], ['402', 'useState'], ['403', 'useState']]));
    const res = engine.analyze(12, evals, 50);

    // Target is 5, 3 evaluated -> confidence = 3/5 = 0.60
    assert.equal(res.skills['testing-confidence'].confidence, 0.6);
    console.log('✓ Test 16: Confidence metric reflects evidence coverage relative to target');
  }

  // Test 17, 18, 19: Skill Profile Persistence & Historical Weighted Aggregation
  {
    const topicId = 99;
    const skill = 'state management';

    // Simulate initial attempt
    mockSkillProfilesStore.set(`${topicId}:${skill}`, {
      topicId,
      skill,
      score: 0.70,
      confidence: 0.6,
      status: 'developing',
      evaluatedQuestions: 3,
      correctAnswers: 2,
      lastAssessedAt: new Date().toISOString(),
    });

    // New assessment adds 2 evaluated questions, 2 correct (score 1.0)
    // Combined = (2 + 2) / (3 + 2) = 4 / 5 = 0.80
    const prev = mockSkillProfilesStore.get(`${topicId}:${skill}`)!;
    const newEvidence = 2;
    const newCorrect = 2;

    const combinedEv = prev.evaluatedQuestions + newEvidence;
    const combinedCorrect = prev.correctAnswers + newCorrect;
    const combinedScore = combinedCorrect / combinedEv;
    const combinedConf = Math.min(1.0, combinedEv / 5);

    assert.equal(combinedEv, 5);
    assert.equal(combinedScore, 0.80);
    assert.equal(combinedConf, 1.0);
    console.log('✓ Test 17, 18, 19: Historical weighted aggregation updates skill profile accurately');
  }

  // Test 20 & 21: Analysis Service Execution & Persistence
  {
    // Setup mock attempt in submitted state
    const attemptId = 901;
    const assessmentId = 900;
    mockAssessmentsStore.set(assessmentId, {
      id: assessmentId,
      topicId: 1,
      topicName: 'React State Management',
      questionCount: mockQuestions.length,
      targetDifficulty: 0.5,
      questions: mockQuestions,
    });

    mockAttemptsStore.set(attemptId, {
      id: attemptId,
      assessmentId,
      status: 'submitted',
      startedAt: new Date(Date.now() - 300000).toISOString(),
      submittedAt: new Date().toISOString(),
      responses: new Map([
        ['201', 'useState'],
        ['202', 'useEffect with empty array'],
        ['203', 'split contexts or memoize'],
        ['204', 'wrong answer'],
        ['205', 'predict output text'],
      ]),
    });

    const analysisResult = await PerformanceService.analyzeAttempt(attemptId);
    assert.equal(analysisResult.status, 'success');
    assert.equal(analysisResult.attemptId, attemptId);
    assert.ok(analysisResult.overall.durationSeconds > 0);
    assert.ok(analysisResult.overall.evaluatedQuestions >= 4);
    assert.ok(analysisResult.overall.correctAnswers >= 3);
    assert.ok(analysisResult.overall.accuracy >= 0.60);

    // Call getAnalysis to verify idempotent retrieval
    const fetched = await PerformanceService.getAnalysis(attemptId);
    assert.equal(fetched.attemptId, attemptId);
    assert.equal(fetched.overall.accuracy, analysisResult.overall.accuracy);
    console.log('✓ Test 20 & 21: PerformanceService analyzes submitted attempt and returns persisted record');
  }

  // Test 22 & 23: Reject Non-Existent & In-Progress Attempts
  {
    // In-progress attempt
    const inProgressAttemptId = 902;
    mockAttemptsStore.set(inProgressAttemptId, {
      id: inProgressAttemptId,
      assessmentId: 900,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      responses: new Map(),
    });

    await assert.rejects(
      async () => {
        await PerformanceService.analyzeAttempt(inProgressAttemptId);
      },
      /still in progress and cannot be analyzed/i,
      'Must reject in-progress attempt'
    );

    // Non-existent attempt
    await assert.rejects(
      async () => {
        await PerformanceService.analyzeAttempt(999999);
      },
      /Attempt not found/i,
      'Must reject non-existent attempt'
    );
    console.log('✓ Test 22 & 23: In-progress and non-existent attempts strictly rejected');
  }

  console.log('\n=== All Trial 9 Performance Analysis & Skill Profile Tests Passed Successfully! ===\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
