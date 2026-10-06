import assert from 'assert';
import {
  MockCodeExecutionSandbox,
} from '../src/services/sandbox/mockSandbox';
import { SandboxFactory } from '../src/services/sandbox/sandboxFactory';
import { CodingEvaluationService, mockCodingTestCasesStore, mockCodingEvaluationsStore } from '../src/services/codingEvaluationService';
import { CodingQuestionValidator } from '../src/validators/codingQuestionValidator';
import { CodeExecutionEvaluator } from '../src/services/evaluator/codeExecutionEvaluator';
import { AnswerEvaluatorFactory } from '../src/services/evaluator/answerEvaluator';
import { PerformanceAnalysisEngine } from '../src/services/performanceAnalysisEngine';
import { Question, CodingQuestion } from '../types/question';
import { QuestionEvaluationResult } from '../types/analysis';
import {
  mockAssessmentsStore,
  mockAttemptsStore,
  AttemptService,
} from '../src/services/attemptService';

console.log('=== Running Trial 13: Coding Evaluation Engine Tests ===\n');

async function runTests() {
  let passed = 0;
  const mockSandbox = new MockCodeExecutionSandbox();
  SandboxFactory.setSandbox(mockSandbox);

  // Sample Coding Question for testing
  const sampleCodingQuestion: CodingQuestion = {
    id: 101,
    type: 'CODING',
    language: 'cpp',
    question: 'Write a C++ program to find the maximum element in an array.',
    correctAnswer: 'int maxVal = *max_element(v.begin(), v.end());',
    explanation: 'Iterates through array to maintain maximum.',
    difficulty: 0.5,
    concept: 'Array Traversal',
    subtopic: 'Arrays',
    skills: ['arrays', 'iteration', 'problem solving'],
    cognitiveLevel: 'apply',
    sourceReferences: ['cppreference.com'],
    starterCode: '#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    int n;\n    if (!(cin >> n)) return 0;\n    vector<int> a(n);\n    for(int i=0; i<n; ++i) cin >> a[i];\n    // Find max\n    return 0;\n}',
    constraints: '1 <= N <= 10^5, -10^9 <= A[i] <= 10^9',
    expectedComplexity: { time: 'O(N)', space: 'O(1)' },
    testCases: [
      { id: 1, questionId: 101, input: '5\n1 7 3 9 2', expectedOutput: '9', isHidden: false, weight: 1.0, order: 1 },
      { id: 2, questionId: 101, input: '3\n-5 -2 -10', expectedOutput: '-2', isHidden: false, weight: 1.0, order: 2 },
      { id: 3, questionId: 101, input: '1\n42', expectedOutput: '42', isHidden: true, weight: 2.0, order: 3 },
      { id: 4, questionId: 101, input: '6\n100 200 500 100 300 400', expectedOutput: '500', isHidden: true, weight: 1.0, order: 4 },
    ],
  };

  mockCodingTestCasesStore.set('101', sampleCodingQuestion.testCases!);

  const correctSolution = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    vector<int> a(n);
    for(int i=0; i<n; ++i) cin >> a[i];
    int maxVal = *max_element(a.begin(), a.end());
    cout << maxVal;
    return 0;
}`;

  // -------------------------------------------------------------
  // Test 1: Sandbox compiles and executes valid code
  // -------------------------------------------------------------
  mockSandbox.reset();
  const exec1 = await mockSandbox.execute({
    language: 'cpp',
    code: correctSolution,
    input: '5\n1 7 3 9 2',
  });
  assert.strictEqual(exec1.status, 'completed');
  assert.strictEqual(exec1.stdout.trim(), '9');
  assert.strictEqual(exec1.exitCode, 0);
  console.log('✓ Test 1: Sandbox compiles and executes valid C++ code');
  passed++;

  // -------------------------------------------------------------
  // Test 2: Sandbox detects compilation errors with diagnostics
  // -------------------------------------------------------------
  mockSandbox.reset();
  const badCode = `#include <iostream>\nint main() { SYNTAX_ERROR return 0; }`;
  const exec2 = await mockSandbox.execute({
    language: 'cpp',
    code: badCode,
    input: '',
  });
  assert.strictEqual(exec2.status, 'compilation_error');
  assert(exec2.compilerOutput && exec2.compilerOutput.includes('error:'));
  console.log('✓ Test 2: Sandbox cleanly captures compilation errors and compiler output');
  passed++;

  // -------------------------------------------------------------
  // Test 3: Sandbox detects runtime crashes (e.g. segfault / divide by zero)
  // -------------------------------------------------------------
  mockSandbox.reset();
  const crashCode = `int main() { DIVIDE_BY_ZERO return 0; }`;
  const exec3 = await mockSandbox.execute({
    language: 'cpp',
    code: crashCode,
    input: '',
  });
  assert.strictEqual(exec3.status, 'runtime_error');
  assert.strictEqual(exec3.exitCode, 139);
  console.log('✓ Test 3: Sandbox handles runtime crashes (exit code 139) without host disruption');
  passed++;

  // -------------------------------------------------------------
  // Test 4: Sandbox enforces timeout limit
  // -------------------------------------------------------------
  mockSandbox.reset();
  const infiniteLoopCode = `int main() { while(true) {} return 0; }`;
  const exec4 = await mockSandbox.execute({
    language: 'cpp',
    code: infiniteLoopCode,
    input: '',
    timeoutMs: 3000,
  });
  assert.strictEqual(exec4.status, 'timeout');
  console.log('✓ Test 4: Sandbox enforces execution timeout and terminates runaway processes');
  passed++;

  // -------------------------------------------------------------
  // Test 5: Sandbox enforces memory limit
  // -------------------------------------------------------------
  mockSandbox.reset();
  const oomCode = `int main() { MEMORY_LIMIT_MARKER return 0; }`;
  const exec5 = await mockSandbox.execute({
    language: 'cpp',
    code: oomCode,
    input: '',
  });
  assert.strictEqual(exec5.status, 'memory_limit');
  console.log('✓ Test 5: Sandbox terminates processes that exceed configured memory limits');
  passed++;

  // -------------------------------------------------------------
  // Test 6: Sandbox handles output size limit
  // -------------------------------------------------------------
  mockSandbox.reset();
  const floodCode = `int main() { OUTPUT_LIMIT_MARKER return 0; }`;
  const exec6 = await mockSandbox.execute({
    language: 'cpp',
    code: floodCode,
    input: '',
  });
  assert.strictEqual(exec6.status, 'output_limit');
  console.log('✓ Test 6: Sandbox protects host against excessive stdout size limits');
  passed++;

  // -------------------------------------------------------------
  // Test 7: Sandbox infrastructure error does not fail application
  // -------------------------------------------------------------
  mockSandbox.reset();
  mockSandbox.setSandboxError(true);
  const exec7 = await mockSandbox.execute({
    language: 'cpp',
    code: correctSolution,
    input: '',
  });
  assert.strictEqual(exec7.status, 'sandbox_error');
  console.log('✓ Test 7: Sandbox gracefully returns sandbox_error when runtime is unavailable');
  passed++;

  // -------------------------------------------------------------
  // Test 8: CodingQuestionValidator catches missing fields
  // -------------------------------------------------------------
  const invalidQ: Partial<CodingQuestion> = {
    question: '',
    type: 'CODING',
    language: 'cpp',
    testCases: [],
  };
  const val1 = CodingQuestionValidator.validate(invalidQ);
  assert.strictEqual(val1.isValid, false);
  assert(val1.errors.some((e) => e.includes('Question text is required')));
  assert(val1.errors.some((e) => e.includes('At least one test case is required')));
  console.log('✓ Test 8: CodingQuestionValidator rejects malformed coding questions');
  passed++;

  // -------------------------------------------------------------
  // Test 9: CodingQuestionValidator catches suspicious shell commands in test cases
  // -------------------------------------------------------------
  const shellInjectionQ: Partial<CodingQuestion> = {
    question: 'Calculate sum',
    type: 'CODING',
    language: 'cpp',
    testCases: [
      { input: 'rm -rf /', expectedOutput: '0', isHidden: false },
    ],
  };
  const val2 = CodingQuestionValidator.validate(shellInjectionQ);
  assert.strictEqual(val2.isValid, false);
  assert(val2.errors.some((e) => e.includes('suspicious shell command')));
  console.log('✓ Test 9: CodingQuestionValidator strictly forbids shell injection in test data');
  passed++;

  // -------------------------------------------------------------
  // Test 10: CodingEvaluationService - 100% test pass
  // -------------------------------------------------------------
  mockSandbox.reset();
  const evalAttemptId = 888;
  mockAssessmentsStore.set(100, {
    id: 100,
    topicName: 'Algorithms',
    questionCount: 1,
    targetDifficulty: 0.5,
    questions: [sampleCodingQuestion as any],
  });
  mockAttemptsStore.set(evalAttemptId, {
    id: evalAttemptId,
    assessmentId: 100,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    responses: new Map(),
  });

  const fullPass = await CodingEvaluationService.evaluateSubmission(
    evalAttemptId,
    101,
    correctSolution,
    'cpp',
    { customSandbox: mockSandbox, forceReevaluate: true }
  );
  assert.strictEqual(fullPass.status, 'success');
  assert.strictEqual(fullPass.evaluationStatus, 'completed');
  assert.strictEqual(fullPass.passedTests, 4);
  assert.strictEqual(fullPass.totalTests, 4);
  assert.strictEqual(fullPass.score, 1.0);
  console.log('✓ Test 10: Full test pass produces 100% score (4/4 tests passed)');
  passed++;

  // -------------------------------------------------------------
  // Test 11: CodingEvaluationService - Partial test pass with weights
  // -------------------------------------------------------------
  // Test cases weights: tc1=1.0, tc2=1.0, tc3=2.0 (hidden), tc4=1.0. Total weight = 5.0.
  // Fail tc2 (-2 is expected, but student returns -5)
  mockSandbox.reset();
  mockSandbox.addRule({
    matchInput: '-5 -2 -10',
    result: { status: 'completed', stdout: '-5' }, // wrong output
  });

  const partialPass = await CodingEvaluationService.evaluateSubmission(
    evalAttemptId,
    101,
    correctSolution,
    'cpp',
    { customSandbox: mockSandbox, forceReevaluate: true }
  );
  assert.strictEqual(partialPass.status, 'success');
  assert.strictEqual(partialPass.passedTests, 3);
  assert.strictEqual(partialPass.totalTests, 4);
  // Passed weights: 1.0 (tc1) + 2.0 (tc3) + 1.0 (tc4) = 4.0 out of 5.0 = 0.80
  assert.strictEqual(partialPass.score, 0.8);
  console.log('✓ Test 11: Partial credit correctly computes weighted score (0.80 for 4.0/5.0 weights)');
  passed++;

  // -------------------------------------------------------------
  // Test 12: Zero credit for compilation error
  // -------------------------------------------------------------
  mockSandbox.reset();
  const compErrRes = await CodingEvaluationService.evaluateSubmission(
    evalAttemptId,
    101,
    badCode,
    'cpp',
    { customSandbox: mockSandbox, forceReevaluate: true }
  );
  assert.strictEqual(compErrRes.status, 'success');
  assert.strictEqual(compErrRes.evaluationStatus, 'compilation_error');
  assert.strictEqual(compErrRes.score, 0.0);
  assert.strictEqual(compErrRes.passedTests, 0);
  assert(compErrRes.compilerOutput !== undefined);
  console.log('✓ Test 12: Compilation failure automatically scores 0.0 with diagnostics');
  passed++;

  // -------------------------------------------------------------
  // Test 13: Hidden test cases are strictly redacted in API response
  // -------------------------------------------------------------
  mockSandbox.reset();
  const hiddenRedactionCheck = await CodingEvaluationService.evaluateSubmission(
    evalAttemptId,
    101,
    correctSolution,
    'cpp',
    { customSandbox: mockSandbox, forceReevaluate: true }
  );
  assert.strictEqual(hiddenRedactionCheck.testResults.length, 4);
  const hiddenTest3 = hiddenRedactionCheck.testResults.find((r) => r.testCaseId === 3);
  assert.ok(hiddenTest3);
  assert.strictEqual(hiddenTest3.isHidden, true);
  assert.strictEqual(hiddenTest3.actualOutput, undefined, 'Hidden test actualOutput must be undefined');
  assert.strictEqual(hiddenTest3.expectedOutput, undefined, 'Hidden test expectedOutput must be undefined');

  const visibleTest1 = hiddenRedactionCheck.testResults.find((r) => r.testCaseId === 1);
  assert.ok(visibleTest1);
  assert.strictEqual(visibleTest1.isHidden, false);
  assert.strictEqual(visibleTest1.actualOutput, '9');
  assert.strictEqual(visibleTest1.expectedOutput, '9');
  console.log('✓ Test 13: Hidden test cases strictly redact actual and expected outputs');
  passed++;

  // -------------------------------------------------------------
  // Test 14: Rejection of oversized code submission
  // -------------------------------------------------------------
  const hugeCode = '// big\n'.repeat(25000); // > 100,000 bytes
  const oversizeRes = await CodingEvaluationService.evaluateSubmission(
    evalAttemptId,
    101,
    hugeCode,
    'cpp',
    { customSandbox: mockSandbox }
  );
  assert.strictEqual(oversizeRes.status, 'error');
  assert.strictEqual(oversizeRes.code, 'CODE_TOO_LARGE');
  console.log('✓ Test 14: Oversized code submission strictly rejected before execution');
  passed++;

  // -------------------------------------------------------------
  // Test 15: Rejection of unsupported language
  // -------------------------------------------------------------
  const langRes = await CodingEvaluationService.evaluateSubmission(
    evalAttemptId,
    101,
    correctSolution,
    'python',
    { customSandbox: mockSandbox }
  );
  assert.strictEqual(langRes.status, 'error');
  assert.strictEqual(langRes.code, 'UNSUPPORTED_LANGUAGE');
  console.log('✓ Test 15: Non-C++ language submissions rejected with UNSUPPORTED_LANGUAGE');
  passed++;

  // -------------------------------------------------------------
  // Test 16: "Run Code" executes only against visible test cases
  // -------------------------------------------------------------
  mockSandbox.reset();
  const runCodeRes = await CodingEvaluationService.runVisibleTests(
    101,
    correctSolution,
    'cpp',
    { customSandbox: mockSandbox }
  );
  assert.strictEqual(runCodeRes.status, 'success');
  assert.strictEqual(runCodeRes.totalTests, 2, 'Should only run the 2 visible test cases');
  assert.strictEqual(runCodeRes.passedTests, 2);
  assert.strictEqual(runCodeRes.testResults[0].input, '5\n1 7 3 9 2');
  console.log('✓ Test 16: "Run Code" executes strictly against visible/sample test cases');
  passed++;

  // -------------------------------------------------------------
  // Test 17: AnswerEvaluatorFactory routes CODING to CodeExecutionEvaluator
  // -------------------------------------------------------------
  const evaluator = AnswerEvaluatorFactory.getEvaluator('CODING', undefined, mockSandbox);
  assert(evaluator instanceof CodeExecutionEvaluator);
  console.log('✓ Test 17: AnswerEvaluatorFactory correctly routes CODING to CodeExecutionEvaluator');
  passed++;

  // -------------------------------------------------------------
  // Test 18: CodeExecutionEvaluator integrates into Trial 12 AnswerEvaluation pipeline
  // -------------------------------------------------------------
  mockSandbox.reset();
  const evalResult = await evaluator.evaluate(
    sampleCodingQuestion,
    correctSolution,
    { attemptId: evalAttemptId } as any
  );
  assert.strictEqual(evalResult.evaluationStatus, 'evaluated');
  assert.strictEqual(evalResult.score, 1.0);
  assert.strictEqual(evalResult.correctness, 'correct');
  assert.strictEqual(evalResult.evaluatorType, 'code_execution');
  assert.strictEqual(evalResult.skillEvidence.length, 3);
  assert.strictEqual(evalResult.skillEvidence[0].skill, 'arrays');
  assert.strictEqual(evalResult.skillEvidence[0].score, 1.0);
  console.log('✓ Test 18: CodeExecutionEvaluator produces valid structured AnswerEvaluationResult');
  passed++;

  // -------------------------------------------------------------
  // Test 19: Sandbox error does NOT penalize student score
  // -------------------------------------------------------------
  mockSandbox.reset();
  mockSandbox.setSandboxError(true);
  const sandboxErrEval = await evaluator.evaluate(
    sampleCodingQuestion,
    correctSolution,
    { attemptId: evalAttemptId, forceReevaluate: true } as any
  );
  assert.strictEqual(sandboxErrEval.evaluationStatus, 'evaluator_error');
  assert.strictEqual(sandboxErrEval.score, null);
  assert.strictEqual(sandboxErrEval.correctness, 'evaluator_error');
  console.log('✓ Test 19: Sandbox infrastructure error results in evaluator_error without penalizing student');
  passed++;

  // -------------------------------------------------------------
  // Test 20: PerformanceAnalysisEngine includes CODING in breakdown
  // -------------------------------------------------------------
  const engine = new PerformanceAnalysisEngine();
  const mixedEvals: QuestionEvaluationResult[] = [
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
      questionId: 101,
      answer: correctSolution,
      evaluationStatus: 'evaluated',
      score: 0.80, // CODING question partial pass
      subtopic: 'Arrays',
      skills: ['arrays', 'iteration'],
      cognitiveLevel: 'apply',
      questionType: 'CODING',
      difficulty: 0.5,
    },
    {
      questionId: 102,
      answer: 'Failed sandbox',
      evaluationStatus: 'evaluator_error', // Sandbox error should NOT reduce accuracy
      score: null,
      subtopic: 'Arrays',
      skills: ['arrays'],
      cognitiveLevel: 'apply',
      questionType: 'CODING',
      difficulty: 0.5,
    },
  ];

  const analysis = engine.analyze(1, mixedEvals, 120);
  assert.strictEqual(analysis.overall.totalQuestions, 3);
  assert.strictEqual(analysis.overall.evaluatedQuestions, 2); // Excludes evaluator_error
  assert.strictEqual(analysis.overall.answeredQuestions, 3);
  // (1.0 + 0.8) / 2 = 0.900
  assert.strictEqual(analysis.overall.accuracy, 0.9);
  assert.ok(analysis.questionTypes['CODING']);
  assert.strictEqual(analysis.questionTypes['CODING'].evaluated, 1);
  assert.strictEqual(analysis.questionTypes['CODING'].accuracy, 0.8);
  console.log('✓ Test 20: PerformanceAnalysisEngine accurately aggregates CODING metrics and skill evidence');
  passed++;

  // -------------------------------------------------------------
  // Test 21: AttemptService.getPublicAssessment strips hidden test cases
  // -------------------------------------------------------------
  const publicAssessment = await AttemptService.getPublicAssessment(100);
  const codingQ = publicAssessment.questions.find((q) => q.type === 'CODING');
  assert.ok(codingQ);
  assert.strictEqual((codingQ as any).testCases, undefined, 'testCases must not leak to frontend');
  assert.ok(codingQ.sampleTestCases, 'sampleTestCases must be provided');
  assert.strictEqual(codingQ.sampleTestCases.length, 2, 'Only visible test cases should be in sampleTestCases');
  assert.strictEqual(codingQ.sampleTestCases[0].input, '5\n1 7 3 9 2');
  assert.strictEqual(codingQ.sampleTestCases[0].expectedOutput, '9');
  console.log('✓ Test 21: AttemptService.getPublicAssessment safely provides visible sample tests and hides internal tests');
  passed++;

  // -------------------------------------------------------------
  // Test 22: Unanswered coding question evaluates to 0.0 without sandbox invocation
  // -------------------------------------------------------------
  mockSandbox.reset();
  const unansEval = await evaluator.evaluate(sampleCodingQuestion, null, { attemptId: evalAttemptId } as any);
  assert.strictEqual(unansEval.evaluationStatus, 'evaluated');
  assert.strictEqual(unansEval.score, 0.0);
  assert.strictEqual(unansEval.correctness, 'incorrect');
  assert.strictEqual(mockSandbox.executionCount, 0, 'Sandbox must NOT be invoked for unanswered questions');
  console.log('✓ Test 22: Unanswered coding questions evaluate to 0.0 without unnecessary sandbox invocation');
  passed++;

  console.log(`\n=== All Trial 13 Coding Evaluation Engine Tests Passed Successfully! (${passed}/22) ===\n`);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
