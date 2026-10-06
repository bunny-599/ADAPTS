import { Request, Response } from 'express';
import { ProgressAnalysisService } from '../services/progressAnalysisService';
import { pool, isDatabaseAvailable } from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class ProgressController {
  /**
   * GET /api/topics/:topicId/progress
   * Returns overall progress, skill trends, strengths, weaknesses, and regressions.
   */
  public static async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const topicId = parseInt(req.params.topicId, 10);
      if (!topicId || isNaN(topicId)) {
        console.warn(`[ProgressController.getProgress] Invalid topicId="${req.params.topicId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Valid topicId is required.',
        });
        return;
      }

      const userId = (req as AuthenticatedRequest).user?.userId;
      console.log(`[ProgressController.getProgress] Fetching topic progress | topicId=${topicId} | userId=${userId}`);

      const summary = await ProgressAnalysisService.getTopicProgress(topicId);

      console.log(`[ProgressController.getProgress] Progress fetched | topicId=${topicId} | attempts=${(summary as any)?.totalAttempts ?? 'N/A'}`);
      res.status(200).json(summary);
    } catch (error: any) {
      console.error('[ProgressController.getProgress] Error fetching topic progress:', error.message);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to retrieve topic progress.',
      });
    }
  }

  /**
   * GET /api/topics/:topicId/history
   * Returns chronological assessment attempts for performance and difficulty tracking.
   */
  public static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const topicId = parseInt(req.params.topicId, 10);
      if (!topicId || isNaN(topicId)) {
        console.warn(`[ProgressController.getHistory] Invalid topicId="${req.params.topicId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Valid topicId is required.',
        });
        return;
      }

      const userId = (req as AuthenticatedRequest).user?.userId;
      console.log(`[ProgressController.getHistory] Fetching topic history | topicId=${topicId} | userId=${userId}`);

      const result = await ProgressAnalysisService.getTopicHistory(topicId);

      console.log(`[ProgressController.getHistory] History fetched | topicId=${topicId} | entries=${result?.history?.length ?? 'N/A'}`);
      res.status(200).json({
        status: 'success',
        topicId,
        history: result.history,
      });
    } catch (error: any) {
      console.error('[ProgressController.getHistory] Error fetching topic history:', error.message);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to retrieve assessment history.',
      });
    }
  }

  /**
   * GET /api/topics/:topicId/skills/:skill/history
   * Returns longitudinal timeline and trend data for a single skill.
   */
  public static async getSkillHistory(req: Request, res: Response): Promise<void> {
    try {
      const topicId = parseInt(req.params.topicId, 10);
      const skillName = req.params.skill;

      if (!topicId || isNaN(topicId)) {
        console.warn(`[ProgressController.getSkillHistory] Invalid topicId="${req.params.topicId}"`);
        res.status(400).json({
          status: 'error',
          message: 'Valid topicId is required.',
        });
        return;
      }

      if (!skillName) {
        console.warn(`[ProgressController.getSkillHistory] Missing skill name | topicId=${topicId}`);
        res.status(400).json({
          status: 'error',
          message: 'Skill name is required.',
        });
        return;
      }

      const userId = (req as AuthenticatedRequest).user?.userId;
      console.log(`[ProgressController.getSkillHistory] Fetching skill history | topicId=${topicId} | skill="${skillName}" | userId=${userId}`);

      const skillProgress = await ProgressAnalysisService.getSkillHistory(topicId, skillName);

      console.log(`[ProgressController.getSkillHistory] Skill history fetched | topicId=${topicId} | skill="${skillName}" | dataPoints=${(skillProgress as any)?.timeline?.length ?? 'N/A'}`);
      res.status(200).json({
        status: 'success',
        topicId,
        skill: skillName,
        progress: skillProgress,
      });
    } catch (error: any) {
      console.error('[ProgressController.getSkillHistory] Error fetching skill history:', error.message);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to retrieve skill history.',
      });
    }
  }

  /**
   * GET /api/skills
   * Retrieves real persistent skill profiles strictly scoped to authenticated user from PostgreSQL.
   */
  public static async getUserSkills(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        console.log(`[ProgressController.getUserSkills] Unauthenticated request, returning empty skills`);
        res.status(200).json({ skills: [], recommendedNext: null });
        return;
      }

      console.log(`[ProgressController.getUserSkills] Fetching skill profiles | userId=${userId}`);

      if (isDatabaseAvailable()) {
        const skillsRes = await pool.query(
          `SELECT s.id, s.skill as name,
                  ROUND(s.score * 100)::int as score,
                  s.confidence::float as confidence,
                  s.status,
                  s.evaluated_questions as "evidenceCount",
                  t.topic as "topicName"
           FROM skill_profiles s
           JOIN topics t ON s.topic_id = t.id
           WHERE s.user_id = $1
           ORDER BY s.score ASC;`,
          [userId]
        );

        // Calculate evidence-based recommended next assessment if weak skills exist
        let recommendedNext = null;
        if (skillsRes.rows.length > 0) {
          const weakestSkill = skillsRes.rows[0];
          recommendedNext = {
            topic: weakestSkill.topicName,
            title: `Targeted Practice: ${weakestSkill.name}`,
            reasoning: `Based on your recent assessment performance, your score in "${weakestSkill.name}" is ${weakestSkill.score}%. We recommend a targeted adaptive assessment focused on this area.`,
          };
        }

        console.log(`[ProgressController.getUserSkills] Skills fetched | userId=${userId} | skillCount=${skillsRes.rows.length} | weakestSkill="${skillsRes.rows[0]?.name ?? 'none'}"`);

        res.status(200).json({
          skills: skillsRes.rows,
          recommendedNext,
        });
        return;
      }

      console.log(`[ProgressController.getUserSkills] DB unavailable, returning empty | userId=${userId}`);
      res.status(200).json({ skills: [], recommendedNext: null });
    } catch (error: any) {
      console.error('[ProgressController.getUserSkills] Error:', error.message);
      res.status(500).json({ error: 'Failed to retrieve user skill profile.' });
    }
  }
}
