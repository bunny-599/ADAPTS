import { pool } from '../db';
import {
  CodeExecutionRequest,
  CodeExecutionResult,
  CodeExecutionStatus,
  CodingEvaluationRecord,
  CodingTestCaseStatus,
  CodingTestResultItem,
  PublicTestResultView,
  RunCodeResponse,
  SubmitCodeResponse,
  VisibleTestResultView,
} from '../types/coding';
import { CodingTestCase } from '../types/question';
import { ICodeExecutionSandbox } from './sandbox/codeExecutionSandbox';
import { SandboxFactory } from './sandbox/sandboxFactory';
import { mockAttemptsStore, mockAssessmentsStore } from './attemptService';

export const mockCodingTestCasesStore = new Map<string, CodingTestCase[]>();
export const mockCodingEvaluationsStore = new Map<number, CodingEvaluationRecord>();
let mockCodingEvalIdCounter = 1;

export class CodingEvaluationService {
  private static readonly MAX_CODE_SIZE_BYTES = parseInt(
    process.env.MAX_CODE_SIZE_BYTES || '100000',
    10
  );
  private static readonly SUPPORTED_LANGUAGES = new Set(['cpp']);

  /**
   * Evaluates student code submission against all test cases (both visible and hidden).
   * Persists results to coding_evaluations and coding_test_results.
   */
  public static async evaluateSubmission(
    attemptId: number,
    questionId: number | string,
    code: string,
    language: string = 'cpp',
    options: {
      customSandbox?: ICodeExecutionSandbox;
      forceReevaluate?: boolean;
    } = {}
  ): Promise<SubmitCodeResponse> {
    // 1. Validation
    const validationError = this.validateCodePayload(code, language);
    if (validationError) {
      return {
        status: 'error',
        code: validationError.code,
        message: validationError.message,
        evaluationStatus: 'sandbox_error',
        score: 0,
        passedTests: 0,
        totalTests: 0,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        testResults: [],
      };
    }

    // 2. Resolve Assessment and Question
    const resolvedAttempt = await this.resolveAttempt(attemptId);
    if (!resolvedAttempt) {
      return {
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Assessment attempt not found.',
        evaluationStatus: 'sandbox_error',
        score: 0,
        passedTests: 0,
        totalTests: 0,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        testResults: [],
      };
    }

    // 3. Resolve Assessment Response ID
    const responseId = await this.resolveResponseId(attemptId, questionId, code);

    // 4. Check Idempotency / Existing Evaluation
    if (!options.forceReevaluate && responseId) {
      const cached = await this.getCachedEvaluation(responseId);
      if (cached) {
        return this.formatSubmitResponse(cached);
      }
    }

    // 5. Load Test Cases
    const testCases = await this.getTestCases(questionId);
    if (testCases.length === 0) {
      return {
        status: 'error',
        code: 'NO_TEST_CASES',
        message: 'No test cases configured for this coding question.',
        evaluationStatus: 'sandbox_error',
        score: 0,
        passedTests: 0,
        totalTests: 0,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        testResults: [],
      };
    }

    // 6. Execute against Test Cases using Sandbox
    const sandbox = options.customSandbox || SandboxFactory.getSandbox();
    const testResults: CodingTestResultItem[] = [];
    let passedWeight = 0;
    let totalWeight = 0;
    let totalExecutionTimeMs = 0;
    let maxMemoryUsedMb = 0;
    let overallStatus: CodeExecutionStatus = 'completed';
    let compilerOutput: string | undefined = undefined;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const weight = tc.weight ?? 1.0;
      totalWeight += weight;

      // Execute in sandbox
      const execResult = await sandbox.execute({
        language: 'cpp',
        code,
        input: tc.input,
      });

      totalExecutionTimeMs += execResult.executionTimeMs;
      if (execResult.memoryUsedMb > maxMemoryUsedMb) {
        maxMemoryUsedMb = execResult.memoryUsedMb;
      }

      // If compilation error occurred: short-circuit remaining tests
      if (execResult.status === 'compilation_error') {
        overallStatus = 'compilation_error';
        compilerOutput = execResult.compilerOutput || execResult.stderr;

        // Record compilation failure for this test case
        testResults.push({
          testCaseId: tc.id || i + 1,
          status: 'failed',
          actualOutput: '',
          expectedOutput: tc.expectedOutput,
          executionTimeMs: execResult.executionTimeMs,
          isHidden: tc.isHidden,
        });

        // Mark all remaining test cases as failed due to compilation error
        for (let j = i + 1; j < testCases.length; j++) {
          const remTc = testCases[j];
          totalWeight += remTc.weight ?? 1.0;
          testResults.push({
            testCaseId: remTc.id || j + 1,
            status: 'failed',
            actualOutput: '',
            expectedOutput: remTc.expectedOutput,
            executionTimeMs: 0,
            isHidden: remTc.isHidden,
          });
        }
        break;
      }

      // If sandbox infrastructure error occurred
      if (execResult.status === 'sandbox_error') {
        return {
          status: 'error',
          code: 'SANDBOX_UNAVAILABLE',
          message: 'Code execution sandbox is temporarily unavailable.',
          evaluationStatus: 'sandbox_error',
          score: 0,
          passedTests: 0,
          totalTests: testCases.length,
          executionTimeMs: totalExecutionTimeMs,
          memoryUsedMb: maxMemoryUsedMb,
          testResults: [],
        };
      }

      // Check test output match
      let testStatus: CodingTestCaseStatus = 'failed';
      const actualClean = this.normalizeOutput(execResult.stdout);
      const expectedClean = this.normalizeOutput(tc.expectedOutput);

      if (execResult.status === 'timeout') {
        testStatus = 'timeout';
        if (overallStatus === 'completed') overallStatus = 'timeout';
      } else if (execResult.status === 'runtime_error' || execResult.status === 'memory_limit') {
        testStatus = 'runtime_error';
        if (overallStatus === 'completed') overallStatus = execResult.status;
      } else if (actualClean === expectedClean) {
        testStatus = 'passed';
        passedWeight += weight;
      } else {
        testStatus = 'failed';
      }

      testResults.push({
        testCaseId: tc.id || i + 1,
        status: testStatus,
        actualOutput: execResult.stdout,
        expectedOutput: tc.expectedOutput,
        executionTimeMs: execResult.executionTimeMs,
        isHidden: tc.isHidden,
      });
    }

    const passedTests = testResults.filter((r) => r.status === 'passed').length;
    const score = overallStatus === 'compilation_error'
      ? 0.0
      : Math.round((passedWeight / (totalWeight || 1)) * 1000) / 1000;

    const evaluationRecord: CodingEvaluationRecord = {
      assessmentResponseId: responseId || 0,
      evaluationStatus: overallStatus,
      score,
      passedTests,
      totalTests: testCases.length,
      executionTimeMs: totalExecutionTimeMs,
      memoryUsedMb: maxMemoryUsedMb,
      compilerOutput,
      testResults,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 7. Persist Evaluation
    if (responseId) {
      await this.saveEvaluation(responseId, evaluationRecord, attemptId);
    }

    return this.formatSubmitResponse(evaluationRecord);
  }

  /**
   * Runs code exclusively against visible (sample) test cases without persisting an assessment response.
   */
  public static async runVisibleTests(
    questionId: number | string,
    code: string,
    language: string = 'cpp',
    options: { customSandbox?: ICodeExecutionSandbox } = {}
  ): Promise<RunCodeResponse> {
    const validationError = this.validateCodePayload(code, language);
    if (validationError) {
      return {
        status: 'error',
        code: validationError.code,
        message: validationError.message,
        evaluationStatus: 'sandbox_error',
        passedTests: 0,
        totalTests: 0,
        executionTimeMs: 0,
        testResults: [],
      };
    }

    const allTestCases = await this.getTestCases(questionId);
    // Filter only visible test cases
    const visibleTests = allTestCases.filter((tc) => !tc.isHidden);

    if (visibleTests.length === 0) {
      // Fallback: take first test case if none are marked visible
      if (allTestCases.length > 0) {
        visibleTests.push({ ...allTestCases[0], isHidden: false });
      } else {
        return {
          status: 'error',
          code: 'NO_VISIBLE_TESTS',
          message: 'No visible test cases found for this question.',
          evaluationStatus: 'sandbox_error',
          passedTests: 0,
          totalTests: 0,
          executionTimeMs: 0,
          testResults: [],
        };
      }
    }

    const sandbox = options.customSandbox || SandboxFactory.getSandbox();
    const testResults: VisibleTestResultView[] = [];
    let passedCount = 0;
    let totalTimeMs = 0;
    let overallStatus: CodeExecutionStatus = 'completed';
    let compilerOutput: string | undefined = undefined;

    for (let i = 0; i < visibleTests.length; i++) {
      const tc = visibleTests[i];
      const execResult = await sandbox.execute({
        language: 'cpp',
        code,
        input: tc.input,
      });

      totalTimeMs += execResult.executionTimeMs;

      if (execResult.status === 'compilation_error') {
        overallStatus = 'compilation_error';
        compilerOutput = execResult.compilerOutput || execResult.stderr;
        testResults.push({
          testCaseId: tc.id || i + 1,
          status: 'failed',
          executionTimeMs: execResult.executionTimeMs,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          error: compilerOutput,
        });
        break;
      }

      if (execResult.status === 'sandbox_error') {
        return {
          status: 'error',
          code: 'SANDBOX_UNAVAILABLE',
          message: 'Code execution sandbox is unavailable.',
          evaluationStatus: 'sandbox_error',
          passedTests: 0,
          totalTests: visibleTests.length,
          executionTimeMs: totalTimeMs,
          testResults: [],
        };
      }

      const actualClean = this.normalizeOutput(execResult.stdout);
      const expectedClean = this.normalizeOutput(tc.expectedOutput);
      const isPassed = actualClean === expectedClean;
      let status: CodingTestCaseStatus = isPassed ? 'passed' : 'failed';

      if (execResult.status === 'timeout') status = 'timeout';
      if (execResult.status === 'runtime_error' || execResult.status === 'memory_limit') status = 'runtime_error';
      if (isPassed) passedCount++;

      testResults.push({
        testCaseId: tc.id || i + 1,
        status,
        executionTimeMs: execResult.executionTimeMs,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: execResult.stdout,
        error: execResult.stderr || undefined,
      });
    }

    return {
      status: 'success',
      evaluationStatus: overallStatus,
      passedTests: passedCount,
      totalTests: visibleTests.length,
      executionTimeMs: totalTimeMs,
      compilerOutput,
      testResults,
    };
  }

  /**
   * Retrieves test cases for a question from DB or in-memory store.
   */
  public static async getTestCases(questionId: number | string): Promise<CodingTestCase[]> {
    const qKey = String(questionId);

    // Check mock test cases store first
    if (mockCodingTestCasesStore.has(qKey)) {
      return mockCodingTestCasesStore.get(qKey)!;
    }

    // Attempt DB query
    try {
      const tcRes = await pool.query(
        `SELECT id, question_id as "questionId", input, expected_output as "expectedOutput",
                is_hidden as "isHidden", weight::float as weight, test_order as "order"
         FROM coding_test_cases
         WHERE question_id = $1
         ORDER BY test_order ASC, id ASC;`,
        [parseInt(qKey, 10)]
      );

      if (tcRes.rows.length > 0) {
        return tcRes.rows;
      }
    } catch (dbErr) {
      // Safe fallback
    }

    // Default sample test cases if question was dynamically generated or in memory
    return [
      {
        id: 1,
        questionId: questionId,
        input: '5\n1 7 3 9 2',
        expectedOutput: '9',
        isHidden: false,
        weight: 1.0,
        order: 1,
      },
      {
        id: 2,
        questionId: questionId,
        input: '3\n-5 -2 -10',
        expectedOutput: '-2',
        isHidden: false,
        weight: 1.0,
        order: 2,
      },
      {
        id: 3,
        questionId: questionId,
        input: '1\n42',
        expectedOutput: '42',
        isHidden: true,
        weight: 1.0,
        order: 3,
      },
      {
        id: 4,
        questionId: questionId,
        input: '6\n100 200 500 100 300 400',
        expectedOutput: '500',
        isHidden: true,
        weight: 1.0,
        order: 4,
      },
    ];
  }

  /**
   * Normalizes code output by trimming trailing whitespace and unifying line breaks.
   */
  public static normalizeOutput(output: string | null | undefined): string {
    if (!output) return '';
    return output
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  private static validateCodePayload(
    code: string,
    language: string
  ): { code: string; message: string } | null {
    if (typeof code !== 'string' || code.trim().length === 0) {
      return { code: 'EMPTY_CODE', message: 'Submitted code cannot be empty.' };
    }

    if (Buffer.byteLength(code, 'utf8') > this.MAX_CODE_SIZE_BYTES) {
      return {
        code: 'CODE_TOO_LARGE',
        message: `Code submission exceeds the maximum allowed size of ${this.MAX_CODE_SIZE_BYTES} bytes.`,
      };
    }

    if (!this.SUPPORTED_LANGUAGES.has(language.toLowerCase())) {
      return {
        code: 'UNSUPPORTED_LANGUAGE',
        message: `This question currently supports C++ only (received: "${language}").`,
      };
    }

    return null;
  }

  private static async resolveAttempt(attemptId: number): Promise<{ id: number } | null> {
    if (mockAttemptsStore.has(attemptId)) {
      return { id: attemptId };
    }

    try {
      const res = await pool.query('SELECT id FROM assessment_attempts WHERE id = $1;', [attemptId]);
      if (res.rows.length > 0) return { id: res.rows[0].id };
    } catch {
      // ignore
    }
    return null;
  }

  private static async resolveResponseId(
    attemptId: number,
    questionId: number | string,
    code: string
  ): Promise<number | null> {
    const numQId = parseInt(String(questionId), 10);

    // Check mock attempts store
    if (mockAttemptsStore.has(attemptId)) {
      const mockAttempt = mockAttemptsStore.get(attemptId)!;
      if (!mockAttempt.responses) mockAttempt.responses = new Map();
      mockAttempt.responses.set(String(questionId), code);
      return attemptId * 1000 + (isNaN(numQId) ? 1 : numQId);
    }

    try {
      const res = await pool.query(
        `INSERT INTO assessment_responses (attempt_id, question_id, answer, answered_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET answer = EXCLUDED.answer, answered_at = EXCLUDED.answered_at
         RETURNING id;`,
        [attemptId, numQId, code]
      );
      if (res.rows.length > 0) return res.rows[0].id;
    } catch {
      // ignore
    }

    return attemptId * 1000 + (isNaN(numQId) ? 1 : numQId);
  }

  private static async getCachedEvaluation(responseId: number): Promise<CodingEvaluationRecord | null> {
    if (mockCodingEvaluationsStore.has(responseId)) {
      return mockCodingEvaluationsStore.get(responseId)!;
    }

    try {
      const evalRes = await pool.query(
        `SELECT id, assessment_response_id as "assessmentResponseId",
                evaluation_status as "evaluationStatus", score::float as score,
                passed_tests as "passedTests", total_tests as "totalTests",
                execution_time_ms as "executionTimeMs", memory_used_mb::float as "memoryUsedMb",
                compiler_output as "compilerOutput", runtime_output as "runtimeOutput"
         FROM coding_evaluations
         WHERE assessment_response_id = $1;`,
        [responseId]
      );

      if (evalRes.rows.length > 0) {
        const row = evalRes.rows[0];
        const trRes = await pool.query(
          `SELECT test_case_id as "testCaseId", status, execution_time_ms as "executionTimeMs",
                  actual_output as "actualOutput", is_hidden as "isHidden"
           FROM coding_test_results
           WHERE coding_evaluation_id = $1;`,
          [row.id]
        );
        return {
          ...row,
          testResults: trRes.rows,
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  private static async saveEvaluation(
    responseId: number,
    record: CodingEvaluationRecord,
    attemptId: number
  ): Promise<void> {
    // In-memory store
    mockCodingEvaluationsStore.set(responseId, {
      ...record,
      id: mockCodingEvalIdCounter++,
    });

    if (mockAttemptsStore.has(attemptId)) {
      return;
    }

    try {
      const evalInsert = await pool.query(
        `INSERT INTO coding_evaluations (
            assessment_response_id, evaluation_status, score, passed_tests,
            total_tests, execution_time_ms, memory_used_mb, compiler_output,
            runtime_output, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (assessment_response_id) DO UPDATE SET
            evaluation_status = EXCLUDED.evaluation_status,
            score = EXCLUDED.score,
            passed_tests = EXCLUDED.passed_tests,
            total_tests = EXCLUDED.total_tests,
            execution_time_ms = EXCLUDED.execution_time_ms,
            memory_used_mb = EXCLUDED.memory_used_mb,
            compiler_output = EXCLUDED.compiler_output,
            runtime_output = EXCLUDED.runtime_output,
            updated_at = CURRENT_TIMESTAMP
         RETURNING id;`,
        [
          responseId,
          record.evaluationStatus,
          record.score,
          record.passedTests,
          record.totalTests,
          record.executionTimeMs,
          record.memoryUsedMb,
          record.compilerOutput || null,
          record.runtimeOutput || null,
        ]
      );

      const codingEvalId = evalInsert.rows[0]?.id;
      if (codingEvalId && record.testResults) {
        await pool.query('DELETE FROM coding_test_results WHERE coding_evaluation_id = $1;', [codingEvalId]);
        for (const tr of record.testResults) {
          await pool.query(
            `INSERT INTO coding_test_results (
                coding_evaluation_id, test_case_id, status, actual_output,
                execution_time_ms, is_hidden, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);`,
            [
              codingEvalId,
              typeof tr.testCaseId === 'number' ? tr.testCaseId : null,
              tr.status,
              tr.actualOutput || null,
              tr.executionTimeMs,
              tr.isHidden,
            ]
          );
        }
      }
    } catch (saveErr) {
      console.warn('DB save for coding evaluation failed, fallback preserved in-memory:', saveErr);
    }
  }

  /**
   * Formats SubmitCodeResponse and strictly redacts inputs and outputs for hidden test cases.
   */
  private static formatSubmitResponse(record: CodingEvaluationRecord): SubmitCodeResponse {
    const publicTestResults: PublicTestResultView[] = (record.testResults || []).map((tr) => ({
      testCaseId: tr.testCaseId,
      status: tr.status,
      executionTimeMs: tr.executionTimeMs,
      isHidden: tr.isHidden,
      // Strictly suppress actual and expected outputs for hidden tests
      actualOutput: tr.isHidden ? undefined : tr.actualOutput,
      expectedOutput: tr.isHidden ? undefined : tr.expectedOutput,
    }));

    return {
      status: 'success',
      evaluationStatus: record.evaluationStatus,
      score: record.score,
      passedTests: record.passedTests,
      totalTests: record.totalTests,
      executionTimeMs: record.executionTimeMs,
      memoryUsedMb: record.memoryUsedMb,
      compilerOutput: record.compilerOutput,
      testResults: publicTestResults,
    };
  }
}
