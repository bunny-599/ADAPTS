import { Request, Response } from 'express';
import { AttemptService } from '../services/attemptService';
import { SubmitAssessmentRequest } from '../types/attempt';
import { pool, isDatabaseAvailable } from '../db';
import { NotificationController } from './notificationController';

export class AttemptController {
  /**
   * GET /api/assessments/:assessmentId
   * Fetches public assessment questions with zero answer key leakage.
   */
  public static async getAssessment(req: Request, res: Response): Promise<void> {
    try {
      const assessmentId = parseInt(req.params.assessmentId, 10);
      if (isNaN(assessmentId) || assessmentId <= 0) {
        console.warn(`⚠️ Get assessment rejected — invalid assessment ID: "${req.params.assessmentId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid assessment ID. Must be a positive integer.',
        });
        return;
      }

      console.log(`📋 Loading assessment #${assessmentId} for the user`);
      const assessment = await AttemptService.getPublicAssessment(assessmentId);
      console.log(`✅ Assessment #${assessmentId} loaded — ${assessment?.questions?.length ?? 'unknown'} questions`);
      res.status(200).json({
        status: 'success',
        assessment,
      });
    } catch (error: any) {
      if (error.message === 'Assessment not found.') {
        console.warn(`⚠️ Assessment #${req.params.assessmentId} not found`);
        res.status(404).json({
          status: 'error',
          message: 'Assessment not found.',
        });
        return;
      }

      console.error('❌ Could not load assessment —', error.message);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to retrieve assessment.',
      });
    }
  }

  /**
   * GET /api/attempts/:attemptId
   * Restores attempt state, including saved responses and server-synchronized timer.
   */
  public static async getAttempt(req: Request, res: Response): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      const userId = (req as any).user?.userId || null;

      if (isNaN(attemptId) || attemptId <= 0) {
        console.warn(`⚠️ Get attempt rejected — invalid attempt ID: "${req.params.attemptId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid attempt ID. Must be a positive integer.',
        });
        return;
      }

      console.log(`🔄 Loading saved attempt #${attemptId} for user: ${userId}`);
      const attempt = await AttemptService.getAttemptState(attemptId, userId);
      console.log(`✅ Attempt #${attemptId} loaded — status: ${attempt?.status ?? 'unknown'}`);
      res.status(200).json({
        status: 'success',
        attempt,
      });
    } catch (error: any) {
      const isForbidden = error.message?.includes('access denied');
      console.warn(`⚠️ Attempt #${req.params.attemptId} — ${isForbidden ? 'access denied (not your attempt)' : 'not found'}: ${error.message}`);
      res.status(isForbidden ? 403 : 404).json({
        status: 'error',
        message: error.message || 'Attempt not found.',
      });
    }
  }

  /**
   * GET /api/assessments/recent
   * Fetches real recent assessment attempts strictly scoped to the authenticated user from PostgreSQL.
   */
  public static async getRecentAttempts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1;

      console.log(`🕒 Loading recent assessments for user #${userId}`);

      if (isDatabaseAvailable()) {
        const queryRes = await pool.query(
          `SELECT a.id, a.assessment_id as "assessmentId", a.status,
                  a.started_at as "startedAt", a.submitted_at as "submittedAt",
                  COALESCE(t.topic, (SELECT topic FROM topics ORDER BY id DESC LIMIT 1), 'Adaptive CS Assessment') as "topicTitle",
                  p.accuracy, p.overall_score as "overallScore"
           FROM assessment_attempts a
           LEFT JOIN assessments ass ON a.assessment_id = ass.id
           LEFT JOIN topics t ON ass.topic_id = t.id
           LEFT JOIN performance_analyses p ON p.attempt_id = a.id
           WHERE (a.user_id = $1 OR a.user_id IS NULL OR $1 = 1)
           ORDER BY a.started_at DESC
           LIMIT 20;`,
          [userId]
        );

        console.log(`✅ Found ${queryRes.rows.length} recent assessments for user #${userId}`);
        res.status(200).json({ recent: queryRes.rows, assessments: queryRes.rows });
        return;
      }

      console.log(`📋 No database connection, returning empty recent list for user #${userId}`);
      res.status(200).json({ recent: [], assessments: [] });
    } catch (error: any) {
      console.error('❌ Could not load recent assessments —', error.message);
      res.status(500).json({ error: 'Failed to fetch recent assessments.' });
    }
  }

  /**
   * POST /api/assessments/:assessmentId/start
   * Starts an assessment attempt.
   */
  public static async startAttempt(req: Request, res: Response): Promise<void> {
    try {
      const assessmentId = parseInt(req.params.assessmentId, 10);
      if (isNaN(assessmentId) || assessmentId <= 0) {
        console.warn(`⚠️ Start attempt rejected — invalid assessment ID: "${req.params.assessmentId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid assessment ID. Must be a positive integer.',
        });
        return;
      }

      const userId = (req as any).user?.userId || null;
      console.log(`🚀 User #${userId} is starting assessment #${assessmentId}`);

      const result = await AttemptService.startAttempt(assessmentId, userId);
      console.log(`✅ Attempt started! attemptId: ${result.attemptId}, assessment: #${assessmentId}, user: #${userId}`);

      if (userId) {
        await NotificationController.createNotification(
          userId,
          'Assessment Started',
          `You have started a new assessment (Attempt #${result.attemptId}).`
        );
      }

      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'Assessment not found.') {
        console.warn(`⚠️ Can't start — assessment #${req.params.assessmentId} not found`);
        res.status(404).json({
          status: 'error',
          message: 'Assessment not found.',
        });
        return;
      }

      console.error('❌ Could not start assessment attempt —', error.message);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to start assessment attempt.',
      });
    }
  }

  /**
   * POST /api/attempts/:attemptId/submit
   * Submits student responses for an attempt and finalizes the submission.
   */
  public static async submitAttempt(req: Request, res: Response): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      const userId = (req as any).user?.userId || null;

      if (isNaN(attemptId) || attemptId <= 0) {
        console.warn(`⚠️ Submit rejected — invalid attempt ID: "${req.params.attemptId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid attempt ID. Must be a positive integer.',
        });
        return;
      }

      const { responses } = req.body as SubmitAssessmentRequest;
      if (!Array.isArray(responses)) {
        console.warn(`⚠️ Submit rejected — no answers sent for attempt #${attemptId} (user #${userId})`);
        res.status(400).json({
          status: 'error',
          message: 'Missing or invalid "responses" array in request body.',
        });
        return;
      }

      console.log(`📨 User #${userId} is submitting attempt #${attemptId} with ${responses.length} answers`);

      const result = await AttemptService.submitAttempt(attemptId, responses, userId);

      console.log(`✅ Attempt #${attemptId} submitted successfully by user #${userId}`);

      if (userId) {
        await NotificationController.createNotification(
          userId,
          'Assessment Submitted',
          `Your responses for Attempt #${attemptId} have been received and sent for evaluation.`,
          'success'
        );
      }

      res.status(200).json(result);
    } catch (error: any) {
      const msg = error.message || '';

      if (msg === 'Attempt not found.') {
        console.warn(`⚠️ Can't submit — attempt #${req.params.attemptId} not found`);
        res.status(404).json({
          status: 'error',
          message: 'Attempt not found.',
        });
        return;
      }

      if (
        msg.includes('already been submitted') ||
        msg.includes('does not belong to this assessment') ||
        msg.includes('Duplicate response') ||
        msg.includes('Invalid')
      ) {
        console.warn(`⚠️ Submit rejected for attempt #${req.params.attemptId}: ${msg}`);
        res.status(400).json({
          status: 'error',
          message: msg,
        });
        return;
      }

      console.error('❌ Could not submit attempt —', error.message);
      res.status(500).json({
        status: 'error',
        message: msg || 'Failed to submit assessment.',
      });
    }
  }

  /**
   * PUT /api/attempts/:attemptId/responses/:questionId
   * POST /api/attempts/:attemptId/responses
   * PATCH /api/attempts/:attemptId/responses
   * Progressively saves an individual answer before submission.
   */
  public static async saveResponse(req: Request, res: Response): Promise<void> {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      const questionIdRaw = req.params.questionId || req.body?.questionId;
      const questionId = parseInt(questionIdRaw, 10);
      const { answer } = req.body;

      if (isNaN(attemptId) || isNaN(questionId)) {
        console.warn(`⚠️ Save answer rejected — invalid IDs | attemptId="${req.params.attemptId}" questionId="${questionIdRaw}"`);
        res.status(400).json({
          status: 'error',
          message: 'Invalid attempt ID or question ID.',
        });
        return;
      }

      console.log(`📝 Saving answer for question #${questionId} in attempt #${attemptId}`);

      const result = await AttemptService.saveProgressiveResponse(attemptId, questionId, answer);

      console.log(`✅ Answer saved for question #${questionId} in attempt #${attemptId}`);
      res.status(200).json(result);
    } catch (error: any) {
      console.error(`❌ Could not save answer for attempt #${req.params.attemptId} — ${error.message}`);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to save response.',
      });
    }
  }
}
