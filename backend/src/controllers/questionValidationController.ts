import { Request, Response } from 'express';
import { questionValidationEngine } from '../services/questionValidationEngine';
import { ValidateQuestionPoolRequest, ValidateQuestionPoolResponse } from '../types/validation';
import { Question } from '../types/question';
import { pool, isDatabaseAvailable } from '../db';
import { ResearchService } from '../services/researchService';
import { QuestionGeneratorService } from '../services/questionGeneratorService';

export class QuestionValidationController {
  /**
   * POST /api/questions/validate
   * Analyzes candidate questions and categorizes them into Valid, Flagged, and Invalid pools.
   */
  public static async validate(req: Request, res: Response): Promise<void> {
    try {
      const { topicId, researchRunId, questions } = req.body as ValidateQuestionPoolRequest;

      console.log(`[QuestionValidationController.validate] Starting validation | topicId=${topicId} | researchRunId=${researchRunId} | inlineQuestions=${Array.isArray(questions) ? questions.length : 0}`);

      let candidateList: Question[] = [];
      const validKnowledgeUrls = new Set<string>();
      const knownSubtopics = new Set<string>();

      // 1. If questions array was provided in body, use it; otherwise load from DB or memory
      if (Array.isArray(questions) && questions.length > 0) {
        candidateList = questions;
        console.log(`[QuestionValidationController.validate] Using ${candidateList.length} inline questions from request body`);
      } else {
        if (isDatabaseAvailable() && (topicId || researchRunId)) {
          try {
            const dbQuestions = await pool.query(
              `SELECT id, type, question, options, correct_answer as "correctAnswer",
                      explanation, difficulty::float, concept, subtopic, skills,
                      cognitive_level as "cognitiveLevel", source_references as "sourceReferences",
                      code_snippet as "codeSnippet", scenario_text as "scenarioText"
               FROM candidate_questions
               WHERE ($1::int IS NULL OR topic_id = $1)
                 AND ($2::int IS NULL OR research_session_id = $2)
               ORDER BY id ASC;`,
              [topicId || null, researchRunId || null]
            );
            candidateList = dbQuestions.rows;
            console.log(`[QuestionValidationController.validate] Loaded ${candidateList.length} questions from DB | topicId=${topicId} | researchRunId=${researchRunId}`);
          } catch (dbErr) {
            console.warn('[QuestionValidationController.validate] DB query failed, falling back to memory store.');
          }
        }

        if (candidateList.length === 0) {
          const topicKey = topicId ? String(topicId) : 'default';
          const inMem = QuestionGeneratorService.mockCandidateQuestions.get(topicKey)
            || QuestionGeneratorService.mockCandidateQuestions.get('default')
            || Array.from(QuestionGeneratorService.mockCandidateQuestions.values()).flat();
          if (inMem && inMem.length > 0) {
            candidateList = inMem;
            console.log(`[QuestionValidationController.validate] Loaded ${candidateList.length} questions from in-memory store`);
          }
        }
      }

      if (candidateList.length === 0) {
        console.warn(`[QuestionValidationController.validate] No candidate questions found | topicId=${topicId} | researchRunId=${researchRunId}`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'No candidate questions available to validate. Please generate questions first or provide them in request body.',
        });
        return;
      }

      // 2. Fetch context (sources and subtopics) if available
      try {
        if (researchRunId || topicId) {
          const sourcesRes = await pool.query(
            `SELECT s.url FROM research_sources s
             WHERE ($1::int IS NULL OR s.session_id = $1);`,
            [researchRunId || null]
          );
          sourcesRes.rows.forEach((r) => validKnowledgeUrls.add(r.url));

          const topicRes = await pool.query(
            `SELECT subtopics FROM topics WHERE ($1::int IS NULL OR id = $1);`,
            [topicId || null]
          );
          if (topicRes.rows[0]?.subtopics && Array.isArray(topicRes.rows[0].subtopics)) {
            topicRes.rows[0].subtopics.forEach((sub: string) => knownSubtopics.add(sub));
          }
          console.log(`[QuestionValidationController.validate] Context loaded | knownUrls=${validKnowledgeUrls.size} | knownSubtopics=${knownSubtopics.size}`);
        }
      } catch (ctxErr) {
        console.warn('[QuestionValidationController.validate] Could not load validation context from DB, checking in-memory research session:', ctxErr);
      }

      // Check in-memory research session if DB was offline or empty
      if (validKnowledgeUrls.size === 0 || knownSubtopics.size === 0) {
        const memSession = ResearchService.getInMemorySession(researchRunId, topicId);
        if (memSession) {
          memSession.sources?.forEach((s) => validKnowledgeUrls.add(s.url));
          memSession.knowledge?.forEach((k) => {
            if (k.subtopic) knownSubtopics.add(k.subtopic);
          });
          console.log(`[QuestionValidationController.validate] Context loaded from memory session | urls=${validKnowledgeUrls.size} | subtopics=${knownSubtopics.size}`);
        }
      }

      // 3. Execute Validation Engine
      console.log(`[QuestionValidationController.validate] Running validation engine on ${candidateList.length} questions`);
      const validationResult = questionValidationEngine.validatePool(candidateList, {
        validKnowledgeUrls,
        knownSubtopics,
      });

      console.log(`[QuestionValidationController.validate] Validation complete | valid=${validationResult.validQuestions.length} | flagged=${validationResult.flaggedQuestions.length} | invalid=${validationResult.invalidQuestions.length}`);

      // 4. Update status in PostgreSQL for persisted questions
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const allResults = [
            ...validationResult.validQuestions,
            ...validationResult.flaggedQuestions,
            ...validationResult.invalidQuestions,
          ];

          for (const item of allResults) {
            if (item.question.id) {
              await client.query(
                `UPDATE candidate_questions
                 SET validation_status = $1,
                     quality_score = $2,
                     validation_issues = $3
                 WHERE id = $4;`,
                [
                  item.status,
                  item.qualityScore,
                  JSON.stringify(item.issues),
                  item.question.id,
                ]
              );
            }
          }
          await client.query('COMMIT');
          console.log(`[QuestionValidationController.validate] DB statuses updated for ${allResults.length} questions`);
        } catch (dbErr) {
          await client.query('ROLLBACK');
          console.warn('[QuestionValidationController.validate] Failed to update question validation statuses in DB:', dbErr);
        } finally {
          client.release();
        }
      } catch {}

      const response: ValidateQuestionPoolResponse = {
        status: 'success',
        summary: validationResult.summary,
        validQuestions: validationResult.validQuestions,
        flaggedQuestions: validationResult.flaggedQuestions,
        invalidQuestions: validationResult.invalidQuestions,
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('[QuestionValidationController.validate] Error validating question pool:', error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to validate candidate question pool.',
      });
    }
  }
}
