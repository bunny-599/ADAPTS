import { pool, isDatabaseAvailable } from '../db';
import { Question } from '../types/question';
import {
  OptimizeAssessmentRequest,
  OptimizeAssessmentResponse,
  OptimizedQuestionItem,
} from '../types/assessment';
import {
  GeneticAssessmentOptimizer,
  DEFAULT_TIME_ESTIMATES,
} from './geneticAssessmentOptimizer';
import { mockAssessmentsStore } from './attemptService';
import { QuestionGeneratorService } from './questionGeneratorService';
import { questionValidationEngine } from './questionValidationEngine';

export class AssessmentService {
  private static inMemoryAssessmentCounter = 1;
  /**
   * Fetches valid questions and runs Genetic Algorithm optimization to select the best assessment.
   */
  public static async optimizeAssessment(
    request: OptimizeAssessmentRequest
  ): Promise<OptimizeAssessmentResponse> {
    const targetQuestionCount = request.targetQuestionCount && request.targetQuestionCount > 0
      ? request.targetQuestionCount
      : 10;
    const targetDifficulty = typeof request.targetDifficulty === 'number'
      ? Math.max(0, Math.min(1, request.targetDifficulty))
      : 0.5;
    const skillTargets = request.skillTargets || {};
    const config = request.config || {};

    let validQuestions: Question[] = [];

    // 1. Load questions: from request body, PostgreSQL, or in-memory candidate store
    if (Array.isArray(request.questions) && request.questions.length > 0) {
      validQuestions = request.questions.filter(
        (q: any) => !q.validationStatus || q.validationStatus === 'VALID'
      );
      let idCounter = 1;
      for (const q of validQuestions) {
        if (q.id === undefined || q.id === null) {
          q.id = idCounter++;
        }
      }
    } else {
      if (isDatabaseAvailable()) {
        try {
          const dbResult = await pool.query(
            `SELECT id, type, question, options, correct_answer as "correctAnswer",
                    explanation, difficulty::float, concept, subtopic, skills,
                    cognitive_level as "cognitiveLevel", source_references as "sourceReferences",
                    code_snippet as "codeSnippet", scenario_text as "scenarioText"
             FROM candidate_questions
             WHERE validation_status = 'VALID'
               AND ($1::int IS NULL OR topic_id = $1)
               AND ($2::int IS NULL OR research_session_id = $2)
             ORDER BY id ASC;`,
            [request.topicId || null, request.researchRunId || null]
          );
          validQuestions = dbResult.rows;
        } catch (dbErr: any) {
          console.warn('[AssessmentService] DB query failed in optimizeAssessment, falling back to memory pool:', dbErr.message);
        }
      }

      // If DB was offline or returned empty, check QuestionGeneratorService.mockCandidateQuestions
      if (validQuestions.length === 0) {
        const topicKey = request.topicId ? String(request.topicId) : 'default';
        const inMemPool = QuestionGeneratorService.mockCandidateQuestions.get(topicKey)
          || QuestionGeneratorService.mockCandidateQuestions.get('default')
          || Array.from(QuestionGeneratorService.mockCandidateQuestions.values()).flat();

        if (inMemPool && inMemPool.length > 0) {
          validQuestions = inMemPool.filter(
            (q: any) => !q.validationStatus || q.validationStatus === 'VALID'
          );
        }
      }
    }

    // Ensure all candidate questions are strictly validated (semantic consistency + structural)
    validQuestions = validQuestions.filter((q) => {
      if ((q as any).validationStatus === 'INVALID') return false;
      const val = questionValidationEngine.validateSingleQuestion(q, 0, new Map(), {});
      return val.status === 'VALID';
    });


    // 2. Check if questions exist
    if (validQuestions.length === 0) {
      throw new Error(
        'No valid questions available to build the assessment. Please generate questions first.'
      );
    }

    if (validQuestions.length < targetQuestionCount) {
      throw new Error(
        `Not enough valid questions to build the requested assessment. (Available: ${validQuestions.length}, Requested: ${targetQuestionCount})`
      );
    }

    // 3. Execute Genetic Algorithm optimization
    const defaultTypeTargets: Record<string, number> = {
      MCQ: 0.70,
      CONCEPTUAL: 0.10,
      OUTPUT_PREDICTION: 0.10,
      DEBUGGING: 0.05,
      SCENARIO: 0.05,
    };
    const optimizer = new GeneticAssessmentOptimizer(
      validQuestions,
      targetQuestionCount,
      targetDifficulty,
      skillTargets,
      config,
      request.questionTypeTargets || defaultTypeTargets,
      request.cognitiveTargets
    );

    const { best, generationsRun } = optimizer.optimize();

    // Map question lookup
    const questionMap = new Map<string, Question>();
    for (const q of validQuestions) {
      questionMap.set(String(q.id), q);
    }

    // 4. Build ordered list of questions without exposing answers/explanations
    const timeEstimates = { ...DEFAULT_TIME_ESTIMATES, ...(config.timeEstimates || {}) };
    let totalEstimatedTime = 0;
    const orderedQuestions: OptimizedQuestionItem[] = [];

    best.chromosome.forEach((qId, index) => {
      const q = questionMap.get(String(qId));
      if (q) {
        const estTime = timeEstimates[q.type] || 60;
        totalEstimatedTime += estTime;

        orderedQuestions.push({
          id: q.id!,
          order: index + 1,
          type: q.type,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          concept: q.concept,
          subtopic: q.subtopic,
          skills: q.skills || [],
          cognitiveLevel: q.cognitiveLevel,
          codeSnippet: q.codeSnippet,
          scenarioText: q.scenarioText,
          estimatedTimeSeconds: estTime,
        });
      }
    });

    const subtopicsCovered = Array.from(new Set(orderedQuestions.map((q) => q.subtopic)));
    const typesCovered = Array.from(new Set(orderedQuestions.map((q) => q.type)));
    const cognitiveLevelsCovered = Array.from(new Set(orderedQuestions.map((q) => q.cognitiveLevel)));
    const averageDifficulty = orderedQuestions.length > 0
      ? Number((orderedQuestions.reduce((sum, q) => sum + q.difficulty, 0) / orderedQuestions.length).toFixed(3))
      : 0;

    // 5. Persist Assessment and Join Records to PostgreSQL (if database is available)
    let assessmentId: number | undefined = undefined;
    if (isDatabaseAvailable()) {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

        const insertAssessmentRes = await client.query(
          `INSERT INTO assessments (
             topic_id, target_question_count, target_difficulty, fitness_score,
             fitness_breakdown, configuration
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id;`,
          [
            request.topicId || null,
            targetQuestionCount,
            targetDifficulty,
            best.fitness.total,
            JSON.stringify(best.fitness.breakdown),
            JSON.stringify({
              generationsRun,
              skillTargets,
              config,
            }),
          ]
        );

        assessmentId = insertAssessmentRes.rows[0].id;

        // Persist question join items with question_order
        for (const item of orderedQuestions) {
          const numericQuestionId = typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10);
          if (!isNaN(numericQuestionId)) {
            // Check if question exists in candidate_questions table to prevent foreign key violation
            const existsRes = await client.query('SELECT id FROM candidate_questions WHERE id = $1;', [numericQuestionId]);
            let finalQId = numericQuestionId;

            if (existsRes.rows.length === 0) {
              const qObj = questionMap.get(String(item.id));
              const insQRes = await client.query(
                `INSERT INTO candidate_questions (
                  topic_id, type, question, options, correct_answer, explanation, difficulty, concept, subtopic, skills, cognitive_level, code_snippet, scenario_text, validation_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'VALID')
                RETURNING id;`,
                [
                  request.topicId || null,
                  item.type,
                  item.question,
                  item.options ? JSON.stringify(item.options) : null,
                  (qObj as any)?.correctAnswer || 'N/A',
                  (qObj as any)?.explanation || 'N/A',
                  item.difficulty,
                  item.concept,
                  item.subtopic,
                  JSON.stringify(item.skills || []),
                  item.cognitiveLevel,
                  item.codeSnippet || null,
                  item.scenarioText || null,
                ]
              );
              finalQId = insQRes.rows[0].id;
              item.id = finalQId;
            }

            await client.query(
              `INSERT INTO assessment_questions (assessment_id, question_id, question_order)
               VALUES ($1, $2, $3)
               ON CONFLICT (assessment_id, question_id) DO NOTHING;`,
              [assessmentId, finalQId, item.order]
            );
          }
        }

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.warn('Database persistence skipped or failed for assessment:', dbErr);
      } finally {
        client.release();
      }
      } catch (connErr) {
        console.warn('Could not connect to database to persist assessment:', connErr);
      }
    }

    if (!assessmentId) {
      assessmentId = AssessmentService.inMemoryAssessmentCounter++;
    }

    // Always register in mockAssessmentsStore for instant access in attemptService
    mockAssessmentsStore.set(assessmentId, {
      id: assessmentId,
      topicId: request.topicId || 1,
      topicName: 'Computer Science Assessment',
      questionCount: orderedQuestions.length,
      targetDifficulty,
      questions: orderedQuestions.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: (q as any).correctAnswer,
        explanation: (q as any).explanation,
        difficulty: q.difficulty,
        subtopic: q.subtopic,
        concept: q.concept,
        codeSnippet: q.codeSnippet,
        scenarioText: q.scenarioText,
        constraints: (q as any).constraints,
        estimatedTimeSeconds: q.estimatedTimeSeconds,
      })),
    });

    return {
      status: 'success',
      assessmentId,
      topicId: request.topicId,
      questionCount: orderedQuestions.length,
      targetDifficulty,
      averageDifficulty,
      fitness: best.fitness.total,
      fitnessBreakdown: best.fitness.breakdown,
      questions: orderedQuestions,
      generationCount: generationsRun,
      subtopicsCovered,
      typesCovered,
      cognitiveLevelsCovered,
      estimatedTotalTimeSeconds: totalEstimatedTime,
    };
  }
}
