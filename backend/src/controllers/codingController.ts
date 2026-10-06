import { Request, Response } from 'express';
import { CodingEvaluationService } from '../services/codingEvaluationService';
import { pool } from '../db';
import { mockAssessmentsStore, mockAttemptsStore } from '../services/attemptService';

export class CodingController {
  /**
   * Evaluates student code submission against all test cases (both visible and hidden).
   * POST /api/attempts/:attemptId/code/submit
   */
  public static async submitCode(req: Request, res: Response): Promise<void> {
    const attemptId = parseInt(req.params.attemptId, 10);
    const { questionId, language, code } = req.body;
    const userId = (req as any).user?.userId ?? 'anonymous';

    console.log(`[CodingController.submitCode] Code submission | attemptId=${attemptId} | questionId=${questionId} | language=${language} | userId=${userId} | codeLength=${typeof code === 'string' ? code.length : 'N/A'}`);

    if (!attemptId || isNaN(attemptId)) {
      console.warn(`[CodingController.submitCode] Invalid attemptId="${req.params.attemptId}"`);
      res.status(400).json({
        status: 'error',
        code: 'INVALID_ATTEMPT_ID',
        message: 'A valid attempt ID must be provided.',
      });
      return;
    }

    if (!questionId) {
      console.warn(`[CodingController.submitCode] Missing questionId | attemptId=${attemptId}`);
      res.status(400).json({
        status: 'error',
        code: 'MISSING_QUESTION_ID',
        message: 'Question ID is required.',
      });
      return;
    }

    if (typeof code !== 'string') {
      console.warn(`[CodingController.submitCode] Invalid code type | attemptId=${attemptId} | questionId=${questionId}`);
      res.status(400).json({
        status: 'error',
        code: 'INVALID_CODE',
        message: 'Submitted code must be a string.',
      });
      return;
    }

    const maxCodeSize = parseInt(process.env.MAX_CODE_SIZE_BYTES || '100000', 10);
    if (Buffer.byteLength(code, 'utf8') > maxCodeSize) {
      console.warn(`[CodingController.submitCode] Code too large | attemptId=${attemptId} | size=${Buffer.byteLength(code, 'utf8')} | limit=${maxCodeSize}`);
      res.status(400).json({
        status: 'error',
        code: 'CODE_TOO_LARGE',
        message: `Code submission exceeds the allowed limit of ${maxCodeSize} bytes.`,
      });
      return;
    }

    const lang = (language || 'cpp').toLowerCase();
    if (lang !== 'cpp') {
      console.warn(`[CodingController.submitCode] Unsupported language="${language}" | attemptId=${attemptId}`);
      res.status(400).json({
        status: 'error',
        code: 'UNSUPPORTED_LANGUAGE',
        message: `This question currently supports C++ only (received: "${language}").`,
      });
      return;
    }

    // 1. Verify Attempt and Question
    console.log(`[CodingController.submitCode] Validating attempt+question | attemptId=${attemptId} | questionId=${questionId}`);
    const questionValidation = await CodingController.validateAttemptQuestion(attemptId, questionId);
    if (!questionValidation.valid) {
      console.warn(`[CodingController.submitCode] Validation failed | code=${questionValidation.code} | msg=${questionValidation.message}`);
      res.status(questionValidation.statusCode).json({
        status: 'error',
        code: questionValidation.code,
        message: questionValidation.message,
      });
      return;
    }

    try {
      // 2. Evaluate submission
      console.log(`[CodingController.submitCode] Running evaluation | attemptId=${attemptId} | questionId=${questionId} | lang=${lang}`);
      const evaluationResult = await CodingEvaluationService.evaluateSubmission(
        attemptId,
        questionId,
        code,
        lang
      );

      console.log(`[CodingController.submitCode] Evaluation complete | attemptId=${attemptId} | questionId=${questionId} | status=${evaluationResult.status} | passed=${(evaluationResult as any)?.testResults?.filter((t: any) => t.passed)?.length ?? 'N/A'}/${(evaluationResult as any)?.testResults?.length ?? 'N/A'}`);

      if (evaluationResult.status === 'error') {
        res.status(400).json(evaluationResult);
        return;
      }

      res.status(200).json(evaluationResult);
    } catch (error: any) {
      console.error('[CodingController.submitCode] Submit code error:', error.message);
      res.status(500).json({
        status: 'error',
        code: 'INTERNAL_EVALUATION_ERROR',
        message: 'Internal error during code evaluation.',
      });
    }
  }

  /**
   * Runs student code against visible (sample) test cases only.
   * POST /api/attempts/:attemptId/code/run
   */
  public static async runCode(req: Request, res: Response): Promise<void> {
    const attemptId = parseInt(req.params.attemptId, 10);
    const { questionId, language, code } = req.body;
    const userId = (req as any).user?.userId ?? 'anonymous';

    console.log(`[CodingController.runCode] Code run request | attemptId=${attemptId} | questionId=${questionId} | language=${language} | userId=${userId}`);

    if (!attemptId || isNaN(attemptId)) {
      console.warn(`[CodingController.runCode] Invalid attemptId="${req.params.attemptId}"`);
      res.status(400).json({
        status: 'error',
        code: 'INVALID_ATTEMPT_ID',
        message: 'A valid attempt ID must be provided.',
      });
      return;
    }

    if (!questionId) {
      console.warn(`[CodingController.runCode] Missing questionId | attemptId=${attemptId}`);
      res.status(400).json({
        status: 'error',
        code: 'MISSING_QUESTION_ID',
        message: 'Question ID is required.',
      });
      return;
    }

    if (typeof code !== 'string') {
      console.warn(`[CodingController.runCode] Invalid code type | attemptId=${attemptId}`);
      res.status(400).json({
        status: 'error',
        code: 'INVALID_CODE',
        message: 'Code must be a string.',
      });
      return;
    }

    const maxCodeSize = parseInt(process.env.MAX_CODE_SIZE_BYTES || '100000', 10);
    if (Buffer.byteLength(code, 'utf8') > maxCodeSize) {
      console.warn(`[CodingController.runCode] Code too large | attemptId=${attemptId} | size=${Buffer.byteLength(code, 'utf8')}`);
      res.status(400).json({
        status: 'error',
        code: 'CODE_TOO_LARGE',
        message: `Code submission exceeds the allowed limit of ${maxCodeSize} bytes.`,
      });
      return;
    }

    const lang = (language || 'cpp').toLowerCase();
    if (lang !== 'cpp') {
      console.warn(`[CodingController.runCode] Unsupported language="${language}" | attemptId=${attemptId}`);
      res.status(400).json({
        status: 'error',
        code: 'UNSUPPORTED_LANGUAGE',
        message: `This question currently supports C++ only (received: "${language}").`,
      });
      return;
    }

    // 1. Verify Attempt and Question
    console.log(`[CodingController.runCode] Validating attempt+question | attemptId=${attemptId} | questionId=${questionId}`);
    const questionValidation = await CodingController.validateAttemptQuestion(attemptId, questionId);
    if (!questionValidation.valid) {
      console.warn(`[CodingController.runCode] Validation failed | code=${questionValidation.code} | msg=${questionValidation.message}`);
      res.status(questionValidation.statusCode).json({
        status: 'error',
        code: questionValidation.code,
        message: questionValidation.message,
      });
      return;
    }

    try {
      console.log(`[CodingController.runCode] Running visible tests | questionId=${questionId} | lang=${lang}`);
      const runResult = await CodingEvaluationService.runVisibleTests(
        questionId,
        code,
        lang
      );

      console.log(`[CodingController.runCode] Run complete | questionId=${questionId} | status=${runResult.status}`);

      if (runResult.status === 'error') {
        res.status(400).json(runResult);
        return;
      }

      res.status(200).json(runResult);
    } catch (error: any) {
      console.error('[CodingController.runCode] Run code error:', error.message);
      res.status(500).json({
        status: 'error',
        code: 'INTERNAL_RUN_ERROR',
        message: 'Internal error during code execution.',
      });
    }
  }

  /**
   * Helper to validate that attempt exists and question belongs to the attempt's assessment.
   */
  private static async validateAttemptQuestion(
    attemptId: number,
    questionId: number | string
  ): Promise<{ valid: boolean; statusCode: number; code?: string; message?: string }> {
    const qIdStr = String(questionId);

    // Check mock attempts store first
    if (mockAttemptsStore.has(attemptId)) {
      const mockAttempt = mockAttemptsStore.get(attemptId)!;
      const mockAssessment = mockAssessmentsStore.get(mockAttempt.assessmentId);
      if (mockAssessment) {
        const found = mockAssessment.questions.find((q) => String(q.id) === qIdStr);
        if (!found) {
          return {
            valid: false,
            statusCode: 400,
            code: 'QUESTION_NOT_IN_ASSESSMENT',
            message: `Question ${questionId} does not belong to this assessment.`,
          };
        }
        if (found.type !== 'CODING') {
          return {
            valid: false,
            statusCode: 400,
            code: 'INVALID_QUESTION_TYPE',
            message: `Question ${questionId} is type "${found.type}", expected "CODING".`,
          };
        }
      }
      return { valid: true, statusCode: 200 };
    }

    // Database lookup
    try {
      const res = await pool.query(
        `SELECT a.id, aq.assessment_id, q.type
         FROM assessment_attempts a
         JOIN assessment_questions aq ON a.assessment_id = aq.assessment_id
         JOIN candidate_questions q ON aq.question_id = q.id
         WHERE a.id = $1 AND q.id = $2;`,
        [attemptId, parseInt(qIdStr, 10)]
      );

      if (res.rows.length === 0) {
        // Check if attempt exists
        const attemptCheck = await pool.query('SELECT id FROM assessment_attempts WHERE id = $1;', [attemptId]);
        if (attemptCheck.rows.length === 0) {
          return {
            valid: false,
            statusCode: 404,
            code: 'ATTEMPT_NOT_FOUND',
            message: `Assessment attempt ${attemptId} not found.`,
          };
        }
        return {
          valid: false,
          statusCode: 400,
          code: 'QUESTION_NOT_IN_ASSESSMENT',
          message: `Question ${questionId} does not belong to this assessment.`,
        };
      }

      const qType = res.rows[0].type;
      if (qType !== 'CODING') {
        return {
          valid: false,
          statusCode: 400,
          code: 'INVALID_QUESTION_TYPE',
          message: `Question ${questionId} is type "${qType}", expected "CODING".`,
        };
      }

      return { valid: true, statusCode: 200 };
    } catch (dbErr) {
      // If DB error, assume valid for fallback
      return { valid: true, statusCode: 200 };
    }
  }
}
