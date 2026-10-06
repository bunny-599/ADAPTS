import { Request, Response } from 'express';
import { AnswerEvaluationService } from '../services/answerEvaluationService';

export class EvaluationController {
  /**
   * POST /api/attempts/:attemptId/evaluate
   * Evaluates all submitted responses using deterministic or LLM evaluation.
   */
  public static async evaluateAttempt(req: Request, res: Response): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (isNaN(attemptId) || attemptId <= 0) {
        console.warn(`⚠️ Evaluate rejected — invalid attempt ID: "${req.params.attemptId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid attempt ID. Must be a positive integer.',
        });
        return;
      }

      const forceReevaluate = Boolean(req.body?.forceReevaluate);

      console.log(`🧠 Grading attempt #${attemptId}${forceReevaluate ? ' (force re-grade)' : ''}`);

      const evaluationSummary = await AnswerEvaluationService.evaluateAttempt(attemptId, {
        forceReevaluate,
      });

      console.log(`✅ Grading complete for attempt #${attemptId}`);
      res.status(200).json(evaluationSummary);
    } catch (error: any) {
      const msg = error.message || '';

      if (msg === 'Attempt not found.') {
        console.warn(`⚠️ Can't grade — attempt #${req.params.attemptId} not found`);
        res.status(404).json({
          status: 'error',
          message: 'Attempt not found.',
        });
        return;
      }

      if (msg.includes('in progress and cannot be evaluated')) {
        console.warn(`⚠️ Can't grade attempt #${req.params.attemptId} yet — it's still in progress`);
        res.status(400).json({
          status: 'error',
          message: msg,
        });
        return;
      }

      console.error('❌ Grading failed —', error.message);
      res.status(500).json({
        status: 'error',
        message: msg || 'Failed to evaluate assessment responses.',
      });
    }
  }
}
