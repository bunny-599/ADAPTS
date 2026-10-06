import { pool } from '../db';
import { Question } from '../types/question';
import {
  AnswerEvaluationRecord,
  AnswerEvaluationResult,
  EvaluateAttemptResponse,
  EvaluationContext,
  QuestionEvaluationSummaryItem,
} from '../types/evaluation';
import { mockAssessmentsStore, mockAttemptsStore } from './attemptService';
import { AnswerEvaluatorFactory } from './evaluator/answerEvaluator';
import { ILLMProvider } from './llm/llmProvider';

export const mockAnswerEvaluationsStore = new Map<number, AnswerEvaluationRecord>();
let mockEvalIdCounter = 1;

export class AnswerEvaluationService {
  /**
   * Evaluates all submitted responses for a given attempt.
   * Caches/reuses existing valid evaluations unless forceReevaluate is true.
   */
  public static async evaluateAttempt(
    attemptId: number,
    options: {
      forceReevaluate?: boolean;
      customLLMProvider?: ILLMProvider;
    } = {}
  ): Promise<EvaluateAttemptResponse> {
    if (!attemptId || isNaN(attemptId)) {
      throw new Error('Invalid attempt ID.');
    }

    // 1. Fetch Attempt Info
    let assessmentId: number | null = null;
    let topicId: number | null = null;
    let topicName: string | null = null;
    let isSubmitted = false;

    // Check mock attempts store first (e.g. unit tests or offline in-memory flow)
    const mockAttempt = mockAttemptsStore.get(attemptId);
    if (mockAttempt) {
      assessmentId = mockAttempt.assessmentId;
      isSubmitted = mockAttempt.status === 'submitted';
      const mockAssessment = mockAssessmentsStore.get(assessmentId);
      if (mockAssessment) {
        topicId = mockAssessment.topicId || null;
        topicName = mockAssessment.topicName || null;
      }
    } else {
      try {
        const attemptRes = await pool.query(
          `SELECT a.id, a.assessment_id as "assessmentId", a.status,
                  asm.topic_id as "topicId", t.topic as "topicName"
           FROM assessment_attempts a
           JOIN assessments asm ON a.assessment_id = asm.id
           LEFT JOIN topics t ON asm.topic_id = t.id
           WHERE a.id = $1;`,
          [attemptId]
        );

        if (attemptRes.rows.length > 0) {
          const row = attemptRes.rows[0];
          assessmentId = row.assessmentId;
          topicId = row.topicId;
          topicName = row.topicName;
          isSubmitted = row.status === 'submitted';
        }
      } catch (dbErr) {
        console.warn('DB query failed for attempt, checking in-memory store:', dbErr);
      }
    }

    if (!assessmentId) {
      throw new Error('Attempt not found.');
    }

    if (!isSubmitted) {
      throw new Error('Assessment attempt is still in progress and cannot be evaluated.');
    }

    // 2. Fetch Questions and Student Responses
    let questionsWithResponses: {
      question: Question & { order?: number };
      responseId: number;
      answer: string | null;
    }[] = [];

    const mockAttemptRef = mockAttemptsStore.get(attemptId);
    const mockAssessmentRef = mockAssessmentsStore.get(assessmentId);

    if (mockAttemptRef && mockAssessmentRef) {
      let fakeRespIdCounter = 1000 * attemptId;
      questionsWithResponses = mockAssessmentRef.questions.map((q) => ({
        question: {
          id: q.id,
          order: q.order,
          type: q.type,
          language: (q as any).language || 'cpp',
          question: q.question,
          options: q.options as any,
          correctAnswer: (q as any).correctAnswer || (q.options ? q.options[0] : ''),
          explanation: (q as any).explanation || 'Model answer explanation',
          difficulty: q.difficulty || 0.5,
          concept: q.concept || q.subtopic,
          subtopic: q.subtopic,
          skills: (q as any).skills || [q.subtopic],
          cognitiveLevel: (q as any).cognitiveLevel || 'understand',
          sourceReferences: (q as any).sourceReferences || [],
          codeSnippet: q.codeSnippet,
          scenarioText: q.scenarioText,
        },
        responseId: ++fakeRespIdCounter,
        answer: mockAttemptRef.responses.get(String(q.id)) ?? null,
      }));
    } else {
      try {
        const qRes = await pool.query(
          `SELECT q.id, q.type, q.question, q.options, q.correct_answer as "correctAnswer",
                  q.explanation, q.difficulty::float as difficulty, q.concept,
                  q.subtopic, q.skills, q.cognitive_level as "cognitiveLevel",
                  q.code_snippet as "codeSnippet", q.scenario_text as "scenarioText",
                  q.source_references as "sourceReferences",
                  aq.question_order as "order",
                  r.id as "responseId",
                  r.answer
           FROM assessment_questions aq
           JOIN candidate_questions q ON aq.question_id = q.id
           JOIN assessment_responses r ON r.attempt_id = $1 AND r.question_id = q.id
           WHERE aq.assessment_id = $2
           ORDER BY aq.question_order ASC;`,
          [attemptId, assessmentId]
        );

        if (qRes.rows.length > 0) {
          questionsWithResponses = qRes.rows.map((r) => ({
            question: {
              id: r.id,
              order: r.order,
              type: r.type,
              language: 'cpp',
              question: r.question,
              options: r.options,
              correctAnswer: r.correctAnswer || '',
              explanation: r.explanation || '',
              difficulty: r.difficulty || 0.5,
              concept: r.concept || r.subtopic,
              subtopic: r.subtopic,
              skills: Array.isArray(r.skills) ? r.skills : [r.subtopic],
              cognitiveLevel: r.cognitiveLevel || 'understand',
              sourceReferences: Array.isArray(r.sourceReferences) ? r.sourceReferences : [],
              codeSnippet: r.codeSnippet,
              scenarioText: r.scenarioText,
            },
            responseId: r.responseId,
            answer: r.answer,
          }));
        }
      } catch (dbErr) {
        console.warn('DB questions load failed, checking fallback:', dbErr);
      }
    }

    // 3. Gather Research Grounding Context
    const evaluationContext: EvaluationContext = {
      topicName: topicName || undefined,
      topicId: topicId || undefined,
      researchKnowledge: [],
    };

    if (topicId) {
      try {
        const researchRes = await pool.query(
          `SELECT summary, concept
           FROM research_knowledge_items
           WHERE session_id IN (
             SELECT id FROM research_sessions WHERE topic_id = $1
           )
           LIMIT 10;`,
          [topicId]
        );
        evaluationContext.researchKnowledge = researchRes.rows.map(
          (r) => `${r.concept}: ${r.summary}`
        );
      } catch (researchErr) {
        // Safe to proceed without external research items
      }
    }

    // 4. Evaluate Each Response
    const evaluationResults: QuestionEvaluationSummaryItem[] = [];
    let evaluatedCount = 0;
    let notEvaluableCount = 0;
    let errorCount = 0;
    let scoreSum = 0;

    for (const item of questionsWithResponses) {
      const { question, responseId, answer } = item;

      let evaluation: AnswerEvaluationResult | null = null;

      // Check cache / existing evaluation unless forceReevaluate is set
      if (!options.forceReevaluate) {
        if (mockAttemptsStore.has(attemptId)) {
          const mockEval = mockAnswerEvaluationsStore.get(responseId);
          if (mockEval) {
            evaluation = mockEval;
          }
        } else {
          try {
            const existingRes = await pool.query(
              `SELECT evaluation_status as "evaluationStatus", score::float as score,
                      correctness, reasoning, strengths, missing_concepts as "missingConcepts",
                      skill_evidence as "skillEvidence", confidence::float as confidence,
                      evaluator_type as "evaluatorType", model_name as "modelName",
                      evaluator_version as "evaluatorVersion", prompt_version as "promptVersion"
               FROM answer_evaluations
               WHERE assessment_response_id = $1;`,
              [responseId]
            );
            if (existingRes.rows.length > 0) {
              const row = existingRes.rows[0];
              evaluation = {
                evaluationStatus: row.evaluationStatus,
                score: row.score,
                correctness: row.correctness,
                reasoning: row.reasoning,
                strengths: Array.isArray(row.strengths) ? row.strengths : [],
                missingConcepts: Array.isArray(row.missingConcepts) ? row.missingConcepts : [],
                skillEvidence: Array.isArray(row.skillEvidence) ? row.skillEvidence : [],
                confidence: row.confidence,
                evaluatorType: row.evaluatorType,
                modelName: row.modelName,
                evaluatorVersion: row.evaluatorVersion,
                promptVersion: row.promptVersion,
              };
            }
          } catch (dbErr) {
            // Check in-memory store
            const mockEval = mockAnswerEvaluationsStore.get(responseId);
            if (mockEval) {
              evaluation = mockEval;
            }
          }
        }
      }

      // If no valid cached evaluation, perform evaluation
      if (!evaluation) {
        const evaluator = AnswerEvaluatorFactory.getEvaluator(
          question.type,
          options.customLLMProvider
        );

        evaluation = await evaluator.evaluate(question, answer, evaluationContext);

        // 5. Persist AnswerEvaluation Record
        const now = new Date().toISOString();

        if (mockAttemptsStore.has(attemptId)) {
          mockAnswerEvaluationsStore.set(responseId, {
            id: mockEvalIdCounter++,
            assessmentResponseId: responseId,
            ...evaluation,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          try {
            await pool.query(
              `INSERT INTO answer_evaluations (
                  assessment_response_id, evaluation_status, score, correctness,
                  reasoning, strengths, missing_concepts, skill_evidence,
                  confidence, evaluator_type, model_name, evaluator_version,
                  prompt_version, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
               ON CONFLICT (assessment_response_id) DO UPDATE SET
                  evaluation_status = EXCLUDED.evaluation_status,
                  score = EXCLUDED.score,
                  correctness = EXCLUDED.correctness,
                  reasoning = EXCLUDED.reasoning,
                  strengths = EXCLUDED.strengths,
                  missing_concepts = EXCLUDED.missing_concepts,
                  skill_evidence = EXCLUDED.skill_evidence,
                  confidence = EXCLUDED.confidence,
                  evaluator_type = EXCLUDED.evaluator_type,
                  model_name = EXCLUDED.model_name,
                  evaluator_version = EXCLUDED.evaluator_version,
                  prompt_version = EXCLUDED.prompt_version,
                  updated_at = EXCLUDED.updated_at;`,
              [
                responseId,
                evaluation.evaluationStatus,
                evaluation.score,
                evaluation.correctness,
                evaluation.reasoning,
                JSON.stringify(evaluation.strengths),
                JSON.stringify(evaluation.missingConcepts),
                JSON.stringify(evaluation.skillEvidence),
                evaluation.confidence,
                evaluation.evaluatorType,
                evaluation.modelName || null,
                evaluation.evaluatorVersion,
                evaluation.promptVersion || null,
                now,
                now,
              ]
            );
          } catch (saveErr) {
            // Store in-memory
            mockAnswerEvaluationsStore.set(responseId, {
              id: mockEvalIdCounter++,
              assessmentResponseId: responseId,
              ...evaluation,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // Track summary metrics
      if (evaluation.evaluationStatus === 'evaluated' && evaluation.score !== null) {
        evaluatedCount++;
        scoreSum += evaluation.score;
      } else if (evaluation.evaluationStatus === 'not_evaluable') {
        notEvaluableCount++;
      } else if (evaluation.evaluationStatus === 'evaluator_error') {
        errorCount++;
      }

      evaluationResults.push({
        questionId: question.id!,
        questionOrder: question.order,
        questionType: question.type,
        questionText: question.question,
        studentAnswer: answer,
        status: evaluation.evaluationStatus,
        score: evaluation.score,
        correctness: evaluation.correctness,
        reasoning: evaluation.reasoning,
        strengths: evaluation.strengths,
        missingConcepts: evaluation.missingConcepts,
        skillEvidence: evaluation.skillEvidence,
        confidence: evaluation.confidence,
        evaluatorType: evaluation.evaluatorType,
      });
    }

    const averageScore = evaluatedCount > 0
      ? Number((scoreSum / evaluatedCount).toFixed(3))
      : 0.0;

    return {
      status: 'success',
      attemptId,
      totalQuestions: questionsWithResponses.length,
      evaluatedQuestions: evaluatedCount,
      notEvaluableQuestions: notEvaluableCount,
      evaluationErrors: errorCount,
      averageScore,
      results: evaluationResults,
    };
  }

  /**
   * Helper to retrieve all evaluations for an attempt's responses.
   */
  public static async getEvaluationsForAttempt(
    attemptId: number
  ): Promise<Map<string, AnswerEvaluationResult>> {
    const map = new Map<string, AnswerEvaluationResult>();

    try {
      const res = await pool.query(
        `SELECT r.question_id as "questionId",
                e.evaluation_status as "evaluationStatus", e.score::float as score,
                e.correctness, e.reasoning, e.strengths, e.missing_concepts as "missingConcepts",
                e.skill_evidence as "skillEvidence", e.confidence::float as confidence,
                e.evaluator_type as "evaluatorType", e.model_name as "modelName",
                e.evaluator_version as "evaluatorVersion", e.prompt_version as "promptVersion"
         FROM answer_evaluations e
         JOIN assessment_responses r ON e.assessment_response_id = r.id
         WHERE r.attempt_id = $1;`,
        [attemptId]
      );

      for (const row of res.rows) {
        map.set(String(row.questionId), {
          evaluationStatus: row.evaluationStatus,
          score: row.score,
          correctness: row.correctness,
          reasoning: row.reasoning,
          strengths: Array.isArray(row.strengths) ? row.strengths : [],
          missingConcepts: Array.isArray(row.missingConcepts) ? row.missingConcepts : [],
          skillEvidence: Array.isArray(row.skillEvidence) ? row.skillEvidence : [],
          confidence: row.confidence,
          evaluatorType: row.evaluatorType,
          modelName: row.modelName,
          evaluatorVersion: row.evaluatorVersion,
          promptVersion: row.promptVersion,
        });
      }
    } catch (dbErr) {
      // In-memory fallback
      for (const [respId, evalRec] of mockAnswerEvaluationsStore.entries()) {
        const mockAttempt = mockAttemptsStore.get(attemptId);
        if (mockAttempt) {
          // If in-memory, respId was computed as 1000 * attemptId + offset
          // Match by scanning questions
          for (const [qId] of mockAttempt.responses.entries()) {
            map.set(qId, evalRec);
          }
        }
      }
    }

    return map;
  }
}
