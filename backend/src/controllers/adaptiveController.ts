import { Request, Response } from 'express';
import { AdaptiveAssessmentService } from '../services/adaptiveAssessmentService';

export class AdaptiveController {
  /**
   * POST /api/assessments/adaptive
   * Generates a new adaptive assessment based on the student's SkillProfile and previous performance.
   */
  public static async generateAdaptive(req: Request, res: Response): Promise<void> {
    try {
      const topicId = parseInt(req.body.topicId, 10);
      if (!topicId || isNaN(topicId)) {
        console.warn(`⚠️ Adaptive assessment rejected — invalid topic ID: "${req.body.topicId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Valid topicId is required.',
        });
        return;
      }

      const questionCount = req.body.questionCount ? parseInt(req.body.questionCount, 10) : 10;
      const previousAttemptId = req.body.previousAttemptId ? parseInt(req.body.previousAttemptId, 10) : undefined;
      const targetDifficulty = typeof req.body.targetDifficulty === 'number' ? req.body.targetDifficulty : undefined;
      const questions = Array.isArray(req.body.questions) ? req.body.questions : undefined;
      const userId = (req as any).user?.userId;

      console.log(`🤖 Creating a personalised adaptive assessment for topic #${topicId} | questions: ${questionCount} | user: #${userId}${previousAttemptId ? ` | based on previous attempt #${previousAttemptId}` : ''}`);

      const result = await AdaptiveAssessmentService.generateAdaptiveAssessment({
        topicId,
        questionCount,
        previousAttemptId,
        targetDifficulty,
        questions,
      });

      console.log(`✅ Adaptive assessment ready — ${(result as any)?.questions?.length ?? 'unknown'} questions, difficulty: ${result?.adaptiveProfile?.targetDifficulty ?? 'auto'}`);

      if (userId) {
        const { NotificationController } = await import('./notificationController');
        const diff = result.adaptiveProfile?.targetDifficulty !== undefined
          ? result.adaptiveProfile.targetDifficulty.toFixed(2)
          : 'adaptive';
        await NotificationController.createNotification(
          userId,
          'Adaptive Assessment Ready',
          `A tailored follow-up assessment (Difficulty ${diff}) has been prepared based on your skill profile.`,
          'info'
        );
        console.log(`🔔 Sent notification to user #${userId} — adaptive assessment ready at difficulty ${diff}`);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('❌ Could not create adaptive assessment —', error.message);
      res.status(error.message?.includes('Not enough valid questions') ? 400 : 500).json({
        status: 'error',
        message: error.message || 'Failed to generate adaptive assessment.',
      });
    }
  }
}
