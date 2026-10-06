import { Request, Response } from 'express';
import { AssessmentService } from '../services/assessmentService';
import { OptimizeAssessmentRequest } from '../types/assessment';

export class AssessmentController {
  /**
   * POST /api/assessments/optimize
   * Runs Genetic Algorithm optimization over the valid question pool to select the best assessment.
   */
  public static async optimize(req: Request, res: Response): Promise<void> {
    try {
      const {
        topicId,
        researchRunId,
        targetQuestionCount,
        targetDifficulty,
        skillTargets,
        config,
        questions,
      } = req.body as OptimizeAssessmentRequest;

      console.log(`Building the best assessment from the question pool | topic: #${topicId} | want ${targetQuestionCount ?? 'default'} questions | difficulty: ${targetDifficulty ?? 'auto'}`);

      // 1. Validate targetQuestionCount
      if (targetQuestionCount !== undefined) {
        if (typeof targetQuestionCount !== 'number' || !Number.isInteger(targetQuestionCount) || targetQuestionCount <= 0) {
          console.warn(`⚠️ Rejected — question count must be a whole positive number, got: ${targetQuestionCount}`);
          res.status(400).json({
            status: 'error',
            message: 'Invalid targetQuestionCount. Must be a positive integer.',
          });
          return;
        }
      }

      // 2. Validate targetDifficulty
      if (targetDifficulty !== undefined) {
        if (typeof targetDifficulty !== 'number' || isNaN(targetDifficulty) || targetDifficulty < 0 || targetDifficulty > 1) {
          console.warn(`⚠️ Rejected — difficulty must be between 0 and 1, got: ${targetDifficulty}`);
          res.status(400).json({
            status: 'error',
            message: 'Invalid targetDifficulty. Must be a number between 0.0 and 1.0.',
          });
          return;
        }
      }

      // 3. Validate skillTargets
      if (skillTargets !== undefined && (typeof skillTargets !== 'object' || Array.isArray(skillTargets))) {
        console.warn(`[AssessmentController.optimize] Validation failed: invalid skillTargets type`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid skillTargets. Must be a key-value object of skills to target frequencies.',
        });
        return;
      }

      // 4. Run optimization
      console.log(`Running the optimiser to pick the best questions...`);
      const result = await AssessmentService.optimizeAssessment({
        topicId,
        researchRunId,
        targetQuestionCount,
        targetDifficulty,
        skillTargets,
        config,
        questions,
      });

      console.log(`✅ Assessment built! assessmentId: ${(result as any)?.assessmentId ?? 'unknown'} | ${(result as any)?.questions?.length ?? 'unknown'} questions selected`);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('❌ Could not build assessment —', error.message);

      const errorMessage = error?.message || 'Failed to optimize assessment.';

      if (errorMessage.includes('Not enough valid questions') || errorMessage.includes('Available:')) {
        res.status(400).json({
          status: 'error',
          message: 'Not enough valid questions to build the requested assessment.',
          detail: errorMessage,
        });
        return;
      }

      res.status(500).json({
        status: 'error',
        message: errorMessage,
      });
    }
  }
}
