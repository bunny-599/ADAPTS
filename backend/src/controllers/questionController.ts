import { Request, Response } from 'express';
import { questionGeneratorService, QuestionGeneratorService } from '../services/questionGeneratorService';
import { GenerateQuestionsRequest } from '../types/question';
import { pool, isDatabaseAvailable } from '../db';

export class QuestionController {
  /**
   * POST /api/questions/generate
   * Generates candidate assessment questions grounded in validated research knowledge.
   */
  public static async generate(req: Request, res: Response): Promise<void> {
    try {
      const { topicId, researchRunId, count, topicTitle, knowledgeItems } = req.body;

      console.log(`[QuestionController.generate] Generating questions | topicId=${topicId} | researchRunId=${researchRunId} | count=${count} | topicTitle="${topicTitle}"`);

      const requestDTO: GenerateQuestionsRequest = {
        topicId: typeof topicId === 'number' ? topicId : undefined,
        researchRunId: typeof researchRunId === 'number' ? researchRunId : undefined,
        count: typeof count === 'number' ? count : undefined,
        topicTitle: typeof topicTitle === 'string' ? topicTitle : undefined,
        knowledgeItems: Array.isArray(knowledgeItems) ? knowledgeItems : undefined,
      };

      try {
        console.log(`[QuestionController.generate] Calling questionGeneratorService.generateQuestions`);
        const result = await questionGeneratorService.generateQuestions(requestDTO);
        console.log(`[QuestionController.generate] Questions generated | count=${(result as any)?.questions?.length ?? 'N/A'} | topic="${topicTitle}"`);
        res.status(200).json(result);
        return;
      } catch (innerError: any) {
        if (topicTitle && typeof topicTitle === 'string') {
          console.warn(`[QuestionController.generate] Primary generation failed, falling back to topic-grounded questions | topic="${topicTitle}" | error=${innerError.message}`);
          const fallbackQs = questionGeneratorService.generateTopicGroundedQuestions(topicTitle, count || 8);
          await questionGeneratorService.persistCandidateQuestions(
            requestDTO.topicId,
            requestDTO.researchRunId,
            fallbackQs,
            topicTitle
          );
          console.log(`[QuestionController.generate] Fallback generation complete | count=${fallbackQs.length}`);
          res.status(200).json({
            status: 'success',
            topic: topicTitle,
            generatedCount: fallbackQs.length,
            questions: fallbackQs,
            distribution: {
              MCQ: fallbackQs.filter(q => q.type === 'MCQ').length,
              OUTPUT_PREDICTION: 0,
              CONCEPTUAL: fallbackQs.filter(q => q.type === 'CONCEPTUAL').length,
              DEBUGGING: fallbackQs.filter(q => q.type === 'DEBUGGING').length,
              SCENARIO: fallbackQs.filter(q => q.type === 'SCENARIO').length,
              CODING: 0,
            },
          });
          return;
        }
        throw innerError;
      }
    } catch (error: any) {
      console.error('[QuestionController.generate] Error generating questions:', error.message);

      if (error?.message?.includes('GEMINI_API_KEY is not configured')) {
        res.status(503).json({
          error: 'LLM Service Unavailable',
          message: 'GEMINI_API_KEY is not configured on the server. Please check backend/.env.',
        });
        return;
      }

      if (error?.message?.includes('No validated research knowledge found')) {
        res.status(400).json({
          error: 'Missing Knowledge',
          message: error.message,
        });
        return;
      }

      if (error?.name === 'QuestionValidationError') {
        res.status(502).json({
          error: 'Invalid Question Output',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to generate assessment questions.',
      });
    }
  }

  /**
   * GET /api/questions/:questionId
   * Retrieves sanitized public question data (no leaked answers).
   */
  public static async getQuestionById(req: Request, res: Response): Promise<void> {
    try {
      const qId = parseInt(req.params.questionId, 10);
      if (isNaN(qId) || qId <= 0) {
        console.warn(`[QuestionController.getQuestionById] Invalid questionId="${req.params.questionId}"`);
        res.status(400).json({ error: 'Validation Error', message: 'Invalid questionId.' });
        return;
      }

      console.log(`[QuestionController.getQuestionById] Fetching question | questionId=${qId}`);

      if (isDatabaseAvailable()) {
        const result = await pool.query(
          `SELECT id, type, question, options, difficulty, concept, subtopic, skills,
                  cognitive_level as "cognitiveLevel", code_snippet as "codeSnippet", scenario_text as "scenarioText"
           FROM candidate_questions WHERE id = $1`,
          [qId]
        );
        if (result.rows.length > 0) {
          console.log(`[QuestionController.getQuestionById] Found in DB | questionId=${qId} | type=${result.rows[0].type}`);
          res.status(200).json({ success: true, data: result.rows[0] });
          return;
        }
      }

      for (const list of QuestionGeneratorService.mockCandidateQuestions.values()) {
        const found = list.find((q: any) => q.id === qId || q.id === String(qId));
        if (found) {
          console.log(`[QuestionController.getQuestionById] Found in memory store | questionId=${qId}`);
          const { correctAnswer, validationIssues, ...safeQ } = found as any;
          res.status(200).json({ success: true, data: safeQ });
          return;
        }
      }

      console.warn(`[QuestionController.getQuestionById] Question not found | questionId=${qId}`);
      res.status(404).json({ error: 'Not Found', message: `Question #${qId} not found.` });
    } catch (err: any) {
      console.error('[QuestionController.getQuestionById] Error fetching question:', err.message);
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }
}
