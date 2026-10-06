import { Request, Response } from 'express';
import { PerformanceService } from '../services/performanceService';
import { pool, isDatabaseAvailable } from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { NotificationController } from './notificationController';

export class PerformanceController {
  /**
   * POST /api/attempts/:attemptId/analyze
   * Analyzes student responses and evaluates multidimensional performance & skill profile.
   */
  public static async analyze(req: Request, res: Response): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (isNaN(attemptId) || attemptId <= 0) {
        console.warn(`[PerformanceController.analyze] Invalid attemptId="${req.params.attemptId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid attempt ID. Must be a positive integer.',
        });
        return;
      }

      const userId = (req as AuthenticatedRequest).user?.userId;
      console.log(`[PerformanceController.analyze] Analyzing attempt | attemptId=${attemptId} | userId=${userId}`);

      const analysis = await PerformanceService.analyzeAttempt(attemptId);

      console.log(`[PerformanceController.analyze] Analysis complete | attemptId=${attemptId} | accuracy=${analysis?.overall?.accuracy ?? 'N/A'} | correct=${analysis?.overall?.correctAnswers ?? 'N/A'}/${analysis?.overall?.totalQuestions ?? 'N/A'}`);

      if (userId && analysis?.overall) {
        const accuracyPct = Math.round(analysis.overall.accuracy * 100);
        await NotificationController.createNotification(
          userId,
          'Assessment Evaluated',
          `Assessment #${attemptId} completed with ${accuracyPct}% accuracy (${analysis.overall.correctAnswers}/${analysis.overall.totalQuestions} correct).`,
          'assessment_evaluated'
        );
        console.log(`[PerformanceController.analyze] Notification sent | userId=${userId} | accuracy=${accuracyPct}%`);
      }

      res.status(200).json(analysis);
    } catch (error: any) {
      const msg = error.message || '';

      if (msg === 'Attempt not found.') {
        console.warn(`[PerformanceController.analyze] Attempt not found | attemptId=${req.params.attemptId}`);
        res.status(404).json({
          status: 'error',
          message: 'Attempt not found.',
        });
        return;
      }

      if (msg.includes('in progress and cannot be analyzed')) {
        console.warn(`[PerformanceController.analyze] Attempt still in progress | attemptId=${req.params.attemptId}`);
        res.status(400).json({
          status: 'error',
          message: msg,
        });
        return;
      }

      console.error('[PerformanceController.analyze] Error analyzing assessment attempt:', error.message);
      res.status(500).json({
        status: 'error',
        message: msg || 'Failed to analyze assessment performance.',
      });
    }
  }

  /**
   * GET /api/attempts/:attemptId/analysis
   * Retrieves the performance analysis and skill profile for an attempt.
   */
  public static async getAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (isNaN(attemptId) || attemptId <= 0) {
        console.warn(`[PerformanceController.getAnalysis] Invalid attemptId="${req.params.attemptId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid attempt ID. Must be a positive integer.',
        });
        return;
      }

      console.log(`[PerformanceController.getAnalysis] Fetching analysis | attemptId=${attemptId}`);
      const analysis = await PerformanceService.getAnalysis(attemptId);
      console.log(`[PerformanceController.getAnalysis] Analysis fetched | attemptId=${attemptId}`);
      res.status(200).json(analysis);
    } catch (error: any) {
      const msg = error.message || '';

      if (msg === 'Attempt not found.') {
        console.warn(`[PerformanceController.getAnalysis] Attempt not found | attemptId=${req.params.attemptId}`);
        res.status(404).json({
          status: 'error',
          message: 'Attempt not found.',
        });
        return;
      }

      if (msg.includes('in progress and cannot be analyzed')) {
        console.warn(`[PerformanceController.getAnalysis] Attempt still in progress | attemptId=${req.params.attemptId}`);
        res.status(400).json({
          status: 'error',
          message: msg,
        });
        return;
      }

      console.error('[PerformanceController.getAnalysis] Error retrieving assessment performance analysis:', error.message);
      res.status(500).json({
        status: 'error',
        message: msg || 'Failed to retrieve assessment analysis.',
      });
    }
  }

  /**
   * GET /api/performance
   * Retrieves real aggregated performance analytics strictly scoped to authenticated user from PostgreSQL.
   */
  public static async getUserPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || 1;

      console.log(`[PerformanceController.getUserPerformance] Fetching performance analytics | userId=${userId}`);

      if (isDatabaseAvailable()) {
        // Stats: total attempts, sum of total questions, avg accuracy, avg duration strictly for current user
        const statsRes = await pool.query(
          `SELECT COUNT(DISTINCT h.attempt_id)::int as "totalAssessments",
                  COALESCE(SUM(h.total_questions), 0)::int as "totalQuestionsAttempted",
                  COALESCE(AVG(h.overall_accuracy), 0)::float as "averageAccuracy",
                  COALESCE(AVG(h.completion_rate), 0)::float as "completionRate",
                  COALESCE(AVG(h.duration_seconds), 0)::int as "avgDurationSeconds"
           FROM assessment_performance_history h
           WHERE h.user_id = $1;`,
          [userId]
        );

        // Subject breakdown strictly for current user
        const subjectsRes = await pool.query(
          `SELECT t.topic as name,
                  ROUND(AVG(h.overall_accuracy) * 100)::int as percentage,
                  COUNT(h.attempt_id)::int as "attemptsCount"
           FROM assessment_performance_history h
           JOIN topics t ON h.topic_id = t.id
           WHERE h.user_id = $1
           GROUP BY t.topic;`,
          [userId]
        );

        // History strictly for current user
        const historyRes = await pool.query(
          `SELECT h.id, h.attempt_id as "attemptId", t.topic as "topicName",
                  ROUND(h.overall_accuracy * 100)::int as score,
                  h.created_at as "createdAt"
           FROM assessment_performance_history h
           JOIN topics t ON h.topic_id = t.id
           WHERE h.user_id = $1
           ORDER BY h.created_at ASC;`,
          [userId]
        );

        const subjects = subjectsRes.rows || [];
        const weakAreas = subjects
          .filter((s: any) => s.percentage < 60)
          .map((s: any) => ({
            topic: s.name,
            accuracy: s.percentage,
            attempts: s.attemptsCount,
          }));

        const strongAreas = subjects
          .filter((s: any) => s.percentage >= 70)
          .map((s: any) => ({
            topic: s.name,
            accuracy: s.percentage,
            attempts: s.attemptsCount,
          }));

        const recommendations = weakAreas.map((w: any) => ({
          title: `${w.topic} Reinforcement`,
          topic: w.topic,
          questionCount: 15,
          estimatedMinutes: 15,
          difficulty: 'Adaptive',
          reason: `You scored ${w.accuracy}% on ${w.topic} across ${w.attempts} recent attempt(s). We recommend targeted adaptive practice to reinforce this topic.`,
        }));

        const stats = statsRes.rows[0] || {
          totalAssessments: 0,
          totalQuestionsAttempted: 0,
          averageAccuracy: 0,
          completionRate: 0,
          avgDurationSeconds: 0,
        };

        const avgRespTime = stats.totalQuestionsAttempted > 0
          ? Math.round(stats.avgDurationSeconds / Math.max(1, stats.totalQuestionsAttempted / Math.max(1, stats.totalAssessments)))
          : 0;

        console.log(`[PerformanceController.getUserPerformance] Analytics ready | userId=${userId} | totalAssessments=${stats.totalAssessments} | avgAccuracy=${Number((stats.averageAccuracy * 100).toFixed(1))}% | weakAreas=${weakAreas.length} | strongAreas=${strongAreas.length}`);

        res.status(200).json({
          totalAssessments: stats.totalAssessments,
          totalQuestionsAttempted: stats.totalQuestionsAttempted,
          averageAccuracy: Number((stats.averageAccuracy * 100).toFixed(1)),
          completionRate: Number((stats.completionRate * 100).toFixed(1)),
          avgResponseTimeSeconds: avgRespTime,
          subjects,
          weakAreas,
          strongAreas,
          recommendations,
          history: historyRes.rows,
        });
        return;
      }

      console.log(`[PerformanceController.getUserPerformance] DB unavailable, returning empty analytics | userId=${userId}`);
      res.status(200).json({
        totalAssessments: 0,
        totalQuestionsAttempted: 0,
        averageAccuracy: 0,
        completionRate: 0,
        avgResponseTimeSeconds: 0,
        subjects: [],
        weakAreas: [],
        strongAreas: [],
        recommendations: [],
        history: [],
      });
    } catch (error: any) {
      console.error('[PerformanceController.getUserPerformance] Error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve user performance analytics.' });
    }
  }
}
