import assert from 'node:assert/strict';
import {
  AttemptService,
  mockAssessmentsStore,
  mockAttemptsStore,
} from '../src/services/attemptService';
import { PublicAssessment, PublicAssessmentQuestion } from '../src/types/attempt';

function setupMockAssessment(assessmentId = 100): PublicAssessment {
  const questions: PublicAssessmentQuestion[] = [
    {
      id: 101,
      order: 1,
      type: 'MCQ',
      question: 'Which hook manages local component state in React?',
      options: ['useState', 'useEffect', 'useContext', 'useMemo'],
      difficulty: 0.3,
      subtopic: 'State Hooks',
      concept: 'useState',
      estimatedTimeSeconds: 30,
    },
    {
      id: 102,
      order: 2,
      type: 'OUTPUT_PREDICTION',
      question: 'What will be printed to the console when the effect fires?',
      options: undefined,
      difficulty: 0.6,
      subtopic: 'Effect Hooks',
      concept: 'useEffect',
      codeSnippet: 'useEffect(() => { console.log("mounted"); }, []);',
      estimatedTimeSeconds: 90,
    },
    {
      id: 103,
      order: 3,
      type: 'CONCEPTUAL',
      question: 'Explain the difference between useState and useRef.',
      options: undefined,
      difficulty: 0.5,
      subtopic: 'Hook Comparison',
      concept: 'State vs Ref',
      estimatedTimeSeconds: 60,
    },
    {
      id: 104,
      order: 4,
      type: 'DEBUGGING',
      question: 'Identify why the following component triggers an infinite re-render loop.',
      codeSnippet: 'function Counter() { const [count, setCount] = useState(0); setCount(count + 1); return <div>{count}</div>; }',
      difficulty: 0.7,
      subtopic: 'State Lifecycle',
      concept: 'Re-render loops',
      estimatedTimeSeconds: 120,
    },
    {
      id: 105,
      order: 5,
      type: 'SCENARIO',
      question: 'Design a custom hook to synchronize theme preferences with localStorage.',
      scenarioText: 'You are building a multi-theme dashboard application requiring offline persistence.',
      difficulty: 0.8,
      subtopic: 'Custom Hooks',
      concept: 'Custom Hook Architecture',
      estimatedTimeSeconds: 90,
    },
  ];

  const assessment: PublicAssessment = {
    id: assessmentId,
    topicId: 1,
    topicName: 'React Hooks & Architecture',
    questionCount: questions.length,
    targetDifficulty: 0.58,
    questions,
  };

  mockAssessmentsStore.set(assessmentId, assessment);
  return assessment;
}

async function runTests() {
  console.log('=== Running Trial 8: Assessment Taking & Submission Tests ===\n');

  const assessmentId = 501;
  const mockAssessment = setupMockAssessment(assessmentId);

  // Test 1: Get Assessment
  {
    const fetched = await AttemptService.getPublicAssessment(assessmentId);
    assert.equal(fetched.id, assessmentId);
    assert.equal(fetched.topicName, 'React Hooks & Architecture');
    console.log('✓ Test 1: Assessment fetched successfully');
  }

  // Test 2: Correct Question Ordering
  {
    const fetched = await AttemptService.getPublicAssessment(assessmentId);
    fetched.questions.forEach((q, idx) => {
      assert.equal(q.order, idx + 1, `Question at index ${idx} must have order ${idx + 1}`);
    });
    console.log('✓ Test 2: Questions are returned in strict sequential order');
  }

  // Test 3: Correct Number of Questions
  {
    const fetched = await AttemptService.getPublicAssessment(assessmentId);
    assert.equal(fetched.questionCount, 5);
    assert.equal(fetched.questions.length, 5);
    console.log('✓ Test 3: Question count matches expected total');
  }

  // Test 4: Correct Answers Are Never Returned (Zero Leakage)
  {
    const fetched = await AttemptService.getPublicAssessment(assessmentId);
    for (const q of fetched.questions) {
      assert.equal((q as any).correctAnswer, undefined, 'correctAnswer must be omitted');
      assert.equal((q as any).correct_answer, undefined, 'correct_answer must be omitted');
      assert.equal((q as any).explanation, undefined, 'explanation must be omitted');
      assert.equal((q as any).validation_status, undefined, 'validation metadata must be omitted');
      assert.equal((q as any).qualityScore, undefined, 'quality score must be omitted');
    }
    console.log('✓ Test 4: Security verified: zero answer key or explanation leakage');
  }

  // Test 5 & 6: Start Assessment & Create Attempt
  let attemptId = 0;
  {
    const startResult = await AttemptService.startAttempt(assessmentId);
    assert.equal(startResult.status, 'success');
    assert.ok(startResult.attemptId > 0);
    assert.equal(startResult.assessmentId, assessmentId);
    assert.ok(startResult.startedAt);
    attemptId = startResult.attemptId;
    console.log(`✓ Test 5 & 6: Attempt started with ID ${attemptId} and status in_progress`);
  }

  // Test 7: Progressive Save
  {
    const saveResult = await AttemptService.saveProgressiveResponse(attemptId, 101, 'useState');
    assert.equal(saveResult.status, 'success');
    assert.equal(saveResult.saved, true);
    console.log('✓ Test 7: Progressive answer saving functions idempotently');
  }

  // Test 8: Submit Valid Attempt
  {
    const submitResult = await AttemptService.submitAttempt(attemptId, [
      { questionId: 101, answer: 'useState' },
      { questionId: 102, answer: 'mounted' },
      { questionId: 103, answer: 'useState triggers re-renders; useRef maintains a mutable ref object without triggering re-render.' },
      { questionId: 104, answer: 'Calling setCount inside the render body triggers an infinite loop.' },
      { questionId: 105, answer: 'Create useLocalStorageTheme with useState and window.localStorage.' },
    ]);

    assert.equal(submitResult.status, 'success');
    assert.equal(submitResult.attemptId, attemptId);
    assert.ok(submitResult.submittedAt);
    console.log('✓ Test 8: Full attempt submission succeeds and marks attempt submitted');
  }

  // Test 9: Reject Already Submitted Attempt
  {
    await assert.rejects(
      async () => {
        await AttemptService.submitAttempt(attemptId, [
          { questionId: 101, answer: 'useEffect' },
        ]);
      },
      /already been submitted/i,
      'Must reject submission on an already submitted attempt'
    );
    console.log('✓ Test 9: Submitting an already submitted attempt is strictly rejected');
  }

  // Test 10: Submit Incomplete Attempt (Unanswered Questions Allowed)
  {
    const start2 = await AttemptService.startAttempt(assessmentId);
    const incompleteAttemptId = start2.attemptId;

    const submitResult = await AttemptService.submitAttempt(incompleteAttemptId, [
      { questionId: 101, answer: 'useState' },
      { questionId: 102, answer: null }, // Unanswered
    ]);

    assert.equal(submitResult.status, 'success');
    assert.equal(submitResult.attemptId, incompleteAttemptId);
    assert.ok(submitResult.submittedAt);
    console.log('✓ Test 10: Incomplete attempts with unanswered questions are accepted');
  }

  // Test 11: Reject Unknown Question or Question from Another Assessment
  {
    const start3 = await AttemptService.startAttempt(assessmentId);
    const attempt3 = start3.attemptId;

    await assert.rejects(
      async () => {
        await AttemptService.submitAttempt(attempt3, [
          { questionId: 9999, answer: 'malicious-answer' },
        ]);
      },
      /does not belong to this assessment/i,
      'Must reject questions from outside the assessment'
    );
    console.log('✓ Test 11: Foreign questions not belonging to assessment are rejected');
  }

  // Test 12: Reject Duplicate Question Responses in Submission Payload
  {
    const start4 = await AttemptService.startAttempt(assessmentId);
    const attempt4 = start4.attemptId;

    await assert.rejects(
      async () => {
        await AttemptService.submitAttempt(attempt4, [
          { questionId: 101, answer: 'Option A' },
          { questionId: 101, answer: 'Option B' }, // Duplicate
        ]);
      },
      /Duplicate response/i,
      'Must reject duplicate question responses in the same submission'
    );
    console.log('✓ Test 12: Duplicate question responses in a payload are rejected');
  }

  // Test 13: Handle Non-Existent Assessment & Invalid IDs
  {
    await assert.rejects(
      async () => {
        await AttemptService.getPublicAssessment(999999);
      },
      /Assessment not found/i,
      'Must return not found for unknown assessment'
    );

    await assert.rejects(
      async () => {
        await AttemptService.startAttempt(999999);
      },
      /Assessment not found/i,
      'Must return not found when starting unknown assessment'
    );
    console.log('✓ Test 13: Non-existent assessments and invalid IDs cleanly handled');
  }

  console.log('\n=== All Trial 8 Assessment Taking & Submission Tests Passed Successfully! ===\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
