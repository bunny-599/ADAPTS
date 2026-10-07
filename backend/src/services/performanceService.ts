import { pool } from '../db';
import { PerformanceAnalysisResult, SkillProfileRecord, QuestionEvaluationResult } from '../types/analysis';
import { Question } from '../types/question';
import { PerformanceAnalysisEngine, DeterministicAnswerEvaluator } from './performanceAnalysisEngine';
import { mockAttemptsStore, mockAssessmentsStore } from './attemptService';
import { ProgressAnalysisService } from './progressAnalysisService';
import { AnswerEvaluationService } from './answerEvaluationService';
import { AnswerEvaluationResult } from '../types/evaluation';
import { AuthService } from './authService';

// In-memory mock store for offline unit tests when PostgreSQL is offline
export const mockAnalysesStore = new Map<number, PerformanceAnalysisResult>();
export const mockSkillProfilesStore = new Map<string, SkillProfileRecord>(); // key: `${topicId}:${skill}`

export class PerformanceService {
  /**
   * Analyzes student responses for a submitted assessment attempt.
   */
  public static async analyzeAttempt(attemptId: number): Promise<PerformanceAnalysisResult> {
    if (!attemptId || isNaN(attemptId)) {
      throw new Error('Invalid attempt ID.');
    }

    try {
      // 1. Fetch attempt and assessment context
      let attemptData: any = null;

    try {
      const attemptRes = await pool.query(
        `SELECT a.id, a.assessment_id as "assessmentId", a.status, a.user_id as "userId",
                a.started_at as "startedAt", a.submitted_at as "submittedAt",
                asm.topic_id as "topicId", t.topic as "topicName"
         FROM assessment_attempts a
         JOIN assessments asm ON a.assessment_id = asm.id
         LEFT JOIN topics t ON asm.topic_id = t.id
         WHERE a.id = $1;`,
        [attemptId]
      );
      if (attemptRes.rows.length > 0) {
        attemptData = attemptRes.rows[0];

        // If topicId is missing or null, dynamically resolve from questions or latest topic
        if (!attemptData.topicId) {
          try {
            const qTopicRes = await pool.query(
              `SELECT q.topic_id, t.topic
               FROM assessment_questions aq
               JOIN candidate_questions q ON aq.question_id = q.id
               JOIN topics t ON q.topic_id = t.id
               WHERE aq.assessment_id = $1 AND q.topic_id IS NOT NULL
               LIMIT 1;`,
              [attemptData.assessmentId]
            );
            if (qTopicRes.rows.length > 0) {
              attemptData.topicId = qTopicRes.rows[0].topic_id;
              attemptData.topicName = qTopicRes.rows[0].topic;
              await pool.query('UPDATE assessments SET topic_id = $1 WHERE id = $2;', [attemptData.topicId, attemptData.assessmentId]);
            } else {
              const latestTopic = await pool.query('SELECT id, topic FROM topics ORDER BY id DESC LIMIT 1;');
              if (latestTopic.rows.length > 0) {
                attemptData.topicId = latestTopic.rows[0].id;
                attemptData.topicName = latestTopic.rows[0].topic;
                await pool.query('UPDATE assessments SET topic_id = $1 WHERE id = $2;', [attemptData.topicId, attemptData.assessmentId]);
              }
            }
          } catch {
            // Safe fallback
          }
        }
      }
    } catch (dbErr) {
      // Ignore DB error, proceed to in-memory fallback
    }

    if (!attemptData) {
      // Fallback to in-memory store
      const mockAttempt = mockAttemptsStore.get(attemptId);
      if (!mockAttempt) {
        throw new Error('Attempt not found.');
      }
      const mockAssessment = mockAssessmentsStore.get(mockAttempt.assessmentId);
      attemptData = {
        id: mockAttempt.id,
        assessmentId: mockAttempt.assessmentId,
        status: mockAttempt.status,
        startedAt: mockAttempt.startedAt,
        submittedAt: mockAttempt.submittedAt,
        topicId: mockAssessment?.topicId || 1,
        topicName: mockAssessment?.topicName || 'Computer Science',
      };
    }


      if (attemptData.status !== 'submitted') {
        throw new Error('Assessment attempt is still in progress and cannot be analyzed.');
      }

      // 2. Load questions and responses
      let questions: (Question & { order?: number })[] = [];
      const responsesMap = new Map<string, string | null>();

      try {
        const questionsRes = await pool.query(
          `SELECT q.id, q.type, q.question, q.options, q.correct_answer as "correctAnswer",
                  q.explanation, q.difficulty::float as difficulty, q.concept,
                  q.subtopic, q.skills, q.cognitive_level as "cognitiveLevel",
                  aq.question_order as "order",
                  r.answer
           FROM assessment_questions aq
           JOIN candidate_questions q ON aq.question_id = q.id
           LEFT JOIN assessment_responses r ON r.attempt_id = $1 AND r.question_id = q.id
           WHERE aq.assessment_id = $2
           ORDER BY aq.question_order ASC;`,
          [attemptId, attemptData.assessmentId]
        );

        if (questionsRes.rows.length > 0) {
          questions = questionsRes.rows;
          for (const row of questionsRes.rows) {
            responsesMap.set(String(row.id), row.answer ?? null);
          }
        }
      } catch (dbErr) {
        console.warn('DB load failed, checking in-memory stores:', dbErr);
      }

      // In-memory fallback if questions not found in DB
      if (questions.length === 0) {
        const mockAttempt = mockAttemptsStore.get(attemptId);
        const mockAssessment = mockAssessmentsStore.get(attemptData.assessmentId);
        if (mockAssessment) {
          questions = mockAssessment.questions.map((q) => ({
            id: q.id,
            order: q.order,
            type: q.type,
            question: q.question,
            options: q.options as any,
            correctAnswer: (q as any).correctAnswer || (q.options ? q.options[0] : ''),
            explanation: (q as any).explanation || 'Deterministic explanation',
            difficulty: q.difficulty,
            concept: q.concept || q.subtopic,
            subtopic: q.subtopic,
            skills: (q as any).skills || [q.subtopic],
            cognitiveLevel: (q as any).cognitiveLevel || 'apply',
            sourceReferences: [],
            codeSnippet: q.codeSnippet,
            scenarioText: q.scenarioText,
          })) as (Question & { order?: number })[];

          if (mockAttempt) {
            for (const [qId, ans] of mockAttempt.responses.entries()) {
              responsesMap.set(qId, ans);
            }
          }
        }
      }

      // 3. Compute response duration
      let durationSeconds = 0;
      if (attemptData.startedAt && attemptData.submittedAt) {
        const start = new Date(attemptData.startedAt).getTime();
        const end = new Date(attemptData.submittedAt).getTime();
        durationSeconds = Math.max(0, Math.round((end - start) / 1000));
      }

      // 4. Retrieve or compute AnswerEvaluations (Trial 12)
      let evalMap = new Map<string, AnswerEvaluationResult>();
      try {
        const evalBatch = await AnswerEvaluationService.evaluateAttempt(attemptId);
        for (const res of evalBatch.results) {
          evalMap.set(String(res.questionId), {
            evaluationStatus: res.status,
            score: res.score,
            correctness: res.correctness,
            reasoning: res.reasoning,
            strengths: res.strengths,
            missingConcepts: res.missingConcepts,
            skillEvidence: res.skillEvidence,
            confidence: res.confidence,
            evaluatorType: res.evaluatorType,
            evaluatorVersion: 'v1',
          });
        }
      } catch (evalErr) {
        // Fallback: check existing evaluations in map or in-memory
        try {
          evalMap = await AnswerEvaluationService.getEvaluationsForAttempt(attemptId);
        } catch {
          // Proceed with deterministic fallback
        }
      }

      const engine = new PerformanceAnalysisEngine();
      const evaluations: QuestionEvaluationResult[] = questions.map((q) => {
        const ans = responsesMap.get(String(q.id)) ?? null;
        const evalRes = evalMap.get(String(q.id));

        if (evalRes) {
          return {
            questionId: q.id!,
            order: q.order,
            questionText: q.question,
            answer: ans,
            expectedAnswer: q.correctAnswer,
            evaluationStatus: evalRes.evaluationStatus,
            score: evalRes.score,
            subtopic: q.subtopic,
            skills: Array.isArray(q.skills) ? q.skills : [q.subtopic],
            cognitiveLevel: q.cognitiveLevel,
            questionType: q.type,
            difficulty: q.difficulty,
            evaluationDetails: evalRes,
          };
        }

        const detEvaluator = new DeterministicAnswerEvaluator();
        const res = detEvaluator.evaluate(q, ans);
        res.order = q.order;
        res.questionText = q.question;
        res.expectedAnswer = q.correctAnswer;
        return res;
      });

      const analysis = engine.analyze(
        attemptId,
        evaluations,
        durationSeconds,
        attemptData.topicId,
        attemptData.topicName
      );

      // 5. Update Skill Profiles with historical weighted aggregation
      const topicId = attemptData.topicId || 1;

      for (const [skillName, skillData] of Object.entries(analysis.skills)) {
        if (skillData.evidence === 0) continue;

        try {
          // Check DB for existing skill profile
          const existingProfile = await pool.query(
            `SELECT id, score::float as score, confidence::float as confidence,
                    evaluated_questions as "evaluatedQuestions",
                    correct_answers as "correctAnswers"
             FROM skill_profiles
             WHERE topic_id = $1 AND skill = $2;`,
            [topicId, skillName]
          );

          if (existingProfile.rows.length > 0) {
            const prev = existingProfile.rows[0];
            const combinedEvaluated = prev.evaluatedQuestions + skillData.evidence;
            const combinedCorrect = prev.correctAnswers + skillData.correctCount;
            const combinedScore = combinedEvaluated > 0 ? Number((combinedCorrect / combinedEvaluated).toFixed(3)) : 0;
            const combinedConfidence = Math.min(1.0, Number((combinedEvaluated / 5).toFixed(3)));

            let status = 'insufficient_evidence';
            if (combinedEvaluated >= 2) {
              if (combinedScore >= 0.8) status = 'strong';
              else if (combinedScore >= 0.6) status = 'developing';
              else status = 'weak';
            }

            await pool.query(
              `UPDATE skill_profiles
               SET score = $1, confidence = $2, status = $3,
                   evaluated_questions = $4, correct_answers = $5,
                   last_assessed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
               WHERE id = $6;`,
              [combinedScore, combinedConfidence, status, combinedEvaluated, combinedCorrect, prev.id]
            );
          } else {
            await pool.query(
              `INSERT INTO skill_profiles (
                 topic_id, skill, score, confidence, status,
                 evaluated_questions, correct_answers, last_assessed_at
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP);`,
              [
                topicId,
                skillName,
                skillData.score,
                skillData.confidence,
                skillData.status,
                skillData.evidence,
                skillData.correctCount,
              ]
            );
          }
        } catch (skillDbErr) {
          // In-memory fallback
          const profileKey = `${topicId}:${skillName}`;
          const prev = mockSkillProfilesStore.get(profileKey);

          if (prev) {
            const combinedEvaluated = prev.evaluatedQuestions + skillData.evidence;
            const combinedCorrect = prev.correctAnswers + skillData.correctCount;
            const combinedScore = combinedEvaluated > 0 ? Number((combinedCorrect / combinedEvaluated).toFixed(3)) : 0;
            const combinedConfidence = Math.min(1.0, Number((combinedEvaluated / 5).toFixed(3)));

            let status: SkillProfileRecord['status'] = 'insufficient_evidence';
            if (combinedEvaluated >= 2) {
              if (combinedScore >= 0.8) status = 'strong';
              else if (combinedScore >= 0.6) status = 'developing';
              else status = 'weak';
            }

            mockSkillProfilesStore.set(profileKey, {
              topicId,
              skill: skillName,
              score: combinedScore,
              confidence: combinedConfidence,
              status,
              evaluatedQuestions: combinedEvaluated,
              correctAnswers: combinedCorrect,
              lastAssessedAt: new Date().toISOString(),
            });
          } else {
            mockSkillProfilesStore.set(profileKey, {
              topicId,
              skill: skillName,
              score: skillData.score,
              confidence: skillData.confidence,
              status: skillData.status,
              evaluatedQuestions: skillData.evidence,
              correctAnswers: skillData.correctCount,
              lastAssessedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 6. Persist Performance Analysis record (upsert)
      try {
        await pool.query(
          `INSERT INTO performance_analyses (
             attempt_id, overall_score, accuracy, completion_rate,
             total_questions, answered_questions, evaluated_questions,
             correct_answers, incorrect_answers, unanswered_questions,
             duration_seconds, type_breakdown, subtopic_breakdown,
             skill_breakdown, cognitive_breakdown, difficulty_breakdown,
             strengths, weaknesses
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (attempt_id)
           DO UPDATE SET
             overall_score = EXCLUDED.overall_score,
             accuracy = EXCLUDED.accuracy,
             completion_rate = EXCLUDED.completion_rate,
             total_questions = EXCLUDED.total_questions,
             answered_questions = EXCLUDED.answered_questions,
             evaluated_questions = EXCLUDED.evaluated_questions,
             correct_answers = EXCLUDED.correct_answers,
             incorrect_answers = EXCLUDED.incorrect_answers,
             unanswered_questions = EXCLUDED.unanswered_questions,
             duration_seconds = EXCLUDED.duration_seconds,
             type_breakdown = EXCLUDED.type_breakdown,
             subtopic_breakdown = EXCLUDED.subtopic_breakdown,
             skill_breakdown = EXCLUDED.skill_breakdown,
             cognitive_breakdown = EXCLUDED.cognitive_breakdown,
             difficulty_breakdown = EXCLUDED.difficulty_breakdown,
             strengths = EXCLUDED.strengths,
             weaknesses = EXCLUDED.weaknesses,
             created_at = CURRENT_TIMESTAMP;`,
          [
            attemptId,
            analysis.overall.accuracy,
            analysis.overall.accuracy,
            analysis.overall.completionRate,
            analysis.overall.totalQuestions,
            analysis.overall.answeredQuestions,
            analysis.overall.evaluatedQuestions,
            analysis.overall.correctAnswers,
            analysis.overall.incorrectAnswers,
            analysis.overall.unansweredQuestions,
            analysis.overall.durationSeconds,
            JSON.stringify(analysis.questionTypes),
            JSON.stringify(analysis.subtopics),
            JSON.stringify(analysis.skills),
            JSON.stringify(analysis.cognitiveLevels),
            JSON.stringify(analysis.difficultyRanges),
            JSON.stringify(analysis.strengths),
            JSON.stringify(analysis.weaknesses),
          ]
        );
      } catch (analysisDbErr) {
        mockAnalysesStore.set(attemptId, analysis);
      }

      // 7. Append-only Trial 11 progress recording
      const avgDifficulty = questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.difficulty || 0.5), 0) / questions.length
        : 0.50;

      try {
        await ProgressAnalysisService.recordAssessmentPerformance(
          attemptId,
          analysis,
          topicId,
          avgDifficulty
        );
      } catch (histErr) {
        // Safe failover
      }

      // 8. Elo Rating Calculation (Starts at 0, climbs as user performs)
      try {
        const userId = attemptData?.userId || 1;
        // Points calculated from: correct answers weighted by difficulty, accuracy, and completion bonus
        const correctWeight = analysis.overall.correctAnswers * 30 * (1 + avgDifficulty);
        const accuracyBonus = Math.round(analysis.overall.accuracy * 40);
        const completionBonus = analysis.overall.completionRate >= 1.0 ? 20 : 10;
        const eloDelta = Math.max(10, Math.round(correctWeight + accuracyBonus + completionBonus));

        const eloResult = await AuthService.updateUserElo(userId, eloDelta);
        analysis.overall.eloScore = eloResult.eloScore;
        analysis.overall.eloDelta = eloResult.eloDelta;
      } catch (eloErr) {
        analysis.overall.eloScore = 0;
        analysis.overall.eloDelta = 0;
      }

      mockAnalysesStore.set(attemptId, analysis);

      return analysis;
    } catch (error: any) {
      if (
        error.message === 'Attempt not found.' ||
        error.message === 'Invalid attempt ID.' ||
        error.message.includes('cannot be analyzed')
      ) {
        throw error;
      }

      // Check in-memory store before giving up
      const cached = mockAnalysesStore.get(attemptId);
      if (cached) return cached;

      if (error.code === 'ECONNREFUSED' || error.name === 'AggregateError' || error.message?.includes('connect ECONNREFUSED')) {
        throw new Error('Attempt not found.');
      }

      throw error;
    }
  }

  /**
   * Retrieves existing performance analysis, or triggers it if attempt is submitted.
   */
  public static async getAnalysis(attemptId: number): Promise<PerformanceAnalysisResult> {
    if (!attemptId || isNaN(attemptId)) {
      throw new Error('Invalid attempt ID.');
    }

    // Check in-memory store first
    if (mockAnalysesStore.has(attemptId)) {
      return mockAnalysesStore.get(attemptId)!;
    }

    try {
      const res = await pool.query(
        `SELECT attempt_id, accuracy::float as accuracy, completion_rate::float as "completionRate",
                total_questions as "totalQuestions", answered_questions as "answeredQuestions",
                evaluated_questions as "evaluatedQuestions", correct_answers as "correctAnswers",
                incorrect_answers as "incorrectAnswers", unanswered_questions as "unansweredQuestions",
                duration_seconds as "durationSeconds", type_breakdown as "typeBreakdown",
                subtopic_breakdown as "subtopicBreakdown", skill_breakdown as "skillBreakdown",
                cognitive_breakdown as "cognitiveBreakdown", difficulty_breakdown as "difficultyBreakdown",
                strengths, weaknesses, created_at as "createdAt"
         FROM performance_analyses
         WHERE attempt_id = $1;`,
        [attemptId]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          status: 'success',
          attemptId,
          overall: {
            accuracy: row.accuracy,
            completionRate: row.completionRate,
            totalQuestions: row.totalQuestions,
            answeredQuestions: row.answeredQuestions,
            unansweredQuestions: row.unansweredQuestions,
            evaluatedQuestions: row.evaluatedQuestions,
            correctAnswers: row.correctAnswers,
            incorrectAnswers: row.incorrectAnswers,
            durationSeconds: row.durationSeconds,
          },
          questionTypes: typeof row.typeBreakdown === 'string' ? JSON.parse(row.typeBreakdown) : row.typeBreakdown,
          subtopics: typeof row.subtopicBreakdown === 'string' ? JSON.parse(row.subtopicBreakdown) : row.subtopicBreakdown,
          skills: typeof row.skillBreakdown === 'string' ? JSON.parse(row.skillBreakdown) : row.skillBreakdown,
          cognitiveLevels: typeof row.cognitiveBreakdown === 'string' ? JSON.parse(row.cognitiveBreakdown) : row.cognitiveBreakdown,
          difficultyRanges: typeof row.difficultyBreakdown === 'string' ? JSON.parse(row.difficultyBreakdown) : row.difficultyBreakdown,
          strengths: Array.isArray(row.strengths) ? row.strengths : JSON.parse(row.strengths || '[]'),
          weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : JSON.parse(row.weaknesses || '[]'),
          evaluatedResponses: [],
          createdAt: new Date(row.createdAt).toISOString(),
        };
      }

      // If not yet analyzed in DB, run analysis
      return await this.analyzeAttempt(attemptId);
    } catch (error: any) {
      if (mockAnalysesStore.has(attemptId)) {
        return mockAnalysesStore.get(attemptId)!;
      }
      // If DB error, run analysis fallback
      return await this.analyzeAttempt(attemptId);
    }
  }
}
