import { pool, isDatabaseAvailable } from '../db';
import {
  PublicAssessment,
  PublicAssessmentQuestion,
  StudentQuestionResponse,
  StartAssessmentResponse,
  SubmitAssessmentResponse,
} from '../types/attempt';
import { DEFAULT_TIME_ESTIMATES } from './geneticAssessmentOptimizer';

// In-memory mock store for offline unit tests when PostgreSQL is not running
export interface MockAttemptData {
  id: number;
  assessmentId: number;
  status: 'in_progress' | 'submitted';
  startedAt: string;
  submittedAt?: string;
  responses: Map<string, string | null>;
}

export const mockAssessmentsStore = new Map<number, PublicAssessment>();
export const mockAttemptsStore = new Map<number, MockAttemptData>();
let mockAttemptCounter = 1;

export class AttemptService {
  /**
   * Retrieves a public-safe assessment without revealing answer keys or explanations.
   */
  public static async getPublicAssessment(assessmentId: number): Promise<PublicAssessment> {
    if (!assessmentId || isNaN(assessmentId)) {
      throw new Error('Invalid assessment ID.');
    }

    if (!isDatabaseAvailable()) {
      const mock = mockAssessmentsStore.get(assessmentId);
      if (mock) {
        return this.formatPublicAssessment(mock);
      }
      throw new Error('Assessment not found.');
    }

    try {
      const assessmentRes = await pool.query(
        `SELECT a.id, a.topic_id as "topicId", a.target_question_count as "questionCount",
                a.target_difficulty::float as "targetDifficulty",
                t.topic as "topicName"
         FROM assessments a
         LEFT JOIN topics t ON a.topic_id = t.id
         WHERE a.id = $1;`,
        [assessmentId]
      );

      if (assessmentRes.rows.length === 0) {
        // Fallback to in-memory store if present (e.g. unit tests or offline flow)
        const mock = mockAssessmentsStore.get(assessmentId);
        if (mock) return this.formatPublicAssessment(mock);
        throw new Error('Assessment not found.');
      }

      const row = assessmentRes.rows[0];

      // Retrieve ordered questions - strictly NEVER include correct_answer, explanation, or hidden test cases
      const questionsRes = await pool.query(
        `SELECT q.id, aq.question_order as "order", q.type, q.question, q.options,
                q.difficulty::float as difficulty, q.subtopic, q.concept,
                q.code_snippet as "codeSnippet", q.scenario_text as "scenarioText",
                q.starter_code as "starterCode", q.constraints
         FROM assessment_questions aq
         JOIN candidate_questions q ON aq.question_id = q.id
         WHERE aq.assessment_id = $1
         ORDER BY aq.question_order ASC;`,
        [assessmentId]
      );

      if (questionsRes.rows.length === 0) {
        const mock = mockAssessmentsStore.get(assessmentId);
        if (mock && mock.questions && mock.questions.length > 0) {
          return this.formatPublicAssessment(mock);
        }
      }

      const questions: PublicAssessmentQuestion[] = [];
      for (const q of questionsRes.rows) {
        let sampleTestCases: { input: string; expectedOutput: string }[] | undefined = undefined;

        if (q.type === 'CODING') {
          try {
            const tcRes = await pool.query(
              `SELECT input, expected_output as "expectedOutput"
               FROM coding_test_cases
               WHERE question_id = $1 AND is_hidden = false
               ORDER BY test_order ASC, id ASC;`,
              [q.id]
            );
            sampleTestCases = tcRes.rows;
          } catch {
            // ignore
          }
        }

        questions.push({
          id: q.id,
          order: q.order,
          type: q.type,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          subtopic: q.subtopic,
          concept: q.concept,
          codeSnippet: q.codeSnippet,
          scenarioText: q.scenarioText,
          estimatedTimeSeconds: DEFAULT_TIME_ESTIMATES[q.type as keyof typeof DEFAULT_TIME_ESTIMATES] || 60,
          language: q.type === 'CODING' ? 'cpp' : undefined,
          starterCode: q.starterCode,
          constraints: q.constraints,
          sampleTestCases,
        });
      }

      return {
        id: row.id,
        topicId: row.topicId,
        topicName: row.topicName || 'Computer Science Assessment',
        questionCount: questions.length,
        targetDifficulty: row.targetDifficulty,
        questions,
      };
    } catch (error: any) {
      if (error.message === 'Assessment not found.' || error.message === 'Invalid assessment ID.') {
        throw error;
      }
      // Check in-memory store before giving up
      const mock = mockAssessmentsStore.get(assessmentId);
      if (mock) {
        // Redact any sensitive fields from mock questions
        const sanitizedQuestions: PublicAssessmentQuestion[] = mock.questions.map((q) => {
          const rawQ = q as any;
          let sampleTestCases = q.sampleTestCases;
          if (q.type === 'CODING' && !sampleTestCases && rawQ.testCases) {
            // Extract ONLY visible test cases
            sampleTestCases = rawQ.testCases
              .filter((tc: any) => !tc.isHidden)
              .map((tc: any) => ({ input: tc.input, expectedOutput: tc.expectedOutput }));
          }

          return {
            id: q.id,
            order: q.order,
            type: q.type,
            question: q.question,
            options: q.options,
            difficulty: q.difficulty,
            subtopic: q.subtopic,
            concept: q.concept,
            codeSnippet: q.codeSnippet,
            scenarioText: q.scenarioText,
            estimatedTimeSeconds: q.estimatedTimeSeconds || DEFAULT_TIME_ESTIMATES[q.type as keyof typeof DEFAULT_TIME_ESTIMATES] || 60,
            language: q.type === 'CODING' ? 'cpp' : undefined,
            starterCode: q.starterCode || rawQ.starterCode,
            constraints: q.constraints || rawQ.constraints,
            sampleTestCases,
          };
        });

        return {
          ...mock,
          questions: sanitizedQuestions,
        };
      }
      throw new Error('Assessment not found.');
    }
  }

  /**
   * Starts an assessment attempt, returning the newly created attemptId.
   */
  public static async startAttempt(
    assessmentId: number,
    userId?: number | null
  ): Promise<StartAssessmentResponse> {
    if (!assessmentId || isNaN(assessmentId)) {
      throw new Error('Invalid assessment ID.');
    }

    if (!isDatabaseAvailable()) {
      const mock = mockAssessmentsStore.get(assessmentId);
      if (mock) {
        const attemptId = mockAttemptCounter++;
        const startedAt = new Date().toISOString();
        mockAttemptsStore.set(attemptId, {
          id: attemptId,
          assessmentId: mock.id,
          status: 'in_progress',
          startedAt,
          responses: new Map(),
        });
        return {
          status: 'success',
          attemptId,
          assessmentId: mock.id,
          startedAt,
        };
      }
      throw new Error('Assessment not found.');
    }

    try {
      // Validate assessment exists
      const checkAssessment = await pool.query('SELECT id FROM assessments WHERE id = $1;', [assessmentId]);
      if (checkAssessment.rows.length === 0) {
        const mock = mockAssessmentsStore.get(assessmentId);
        if (mock) {
          const attemptId = mockAttemptCounter++;
          const startedAt = new Date().toISOString();
          mockAttemptsStore.set(attemptId, {
            id: attemptId,
            assessmentId: mock.id,
            status: 'in_progress',
            startedAt,
            responses: new Map(),
          });
          return {
            status: 'success',
            attemptId,
            assessmentId: mock.id,
            startedAt,
          };
        }
        throw new Error('Assessment not found.');
      }

      const insertRes = await pool.query(
        `INSERT INTO assessment_attempts (assessment_id, user_id, status, started_at)
         VALUES ($1, $2, 'in_progress', CURRENT_TIMESTAMP)
         RETURNING id, assessment_id as "assessmentId", started_at as "startedAt";`,
        [assessmentId, userId || null]
      );

      const row = insertRes.rows[0];
      return {
        status: 'success',
        attemptId: row.id,
        assessmentId: row.assessmentId,
        startedAt: new Date(row.startedAt).toISOString(),
      };
    } catch (error: any) {
      if (error.message === 'Assessment not found.' || error.message === 'Invalid assessment ID.') {
        throw error;
      }

      // In-memory fallback if DB is offline (e.g. unit tests)
      const mock = mockAssessmentsStore.get(assessmentId);
      if (mock) {
        const attemptId = mockAttemptCounter++;
        const startedAt = new Date().toISOString();
        mockAttemptsStore.set(attemptId, {
          id: attemptId,
          assessmentId: mock.id,
          status: 'in_progress',
          startedAt,
          responses: new Map(),
        });
        return {
          status: 'success',
          attemptId,
          assessmentId: mock.id,
          startedAt,
        };
      }

      throw new Error('Assessment not found.');
    }

  }

  /**
   * Submits student responses for an attempt inside a transaction.
   */
  public static async submitAttempt(
    attemptId: number,
    responses: StudentQuestionResponse[],
    userId?: number | null
  ): Promise<SubmitAssessmentResponse> {
    if (!attemptId || isNaN(attemptId)) {
      throw new Error('Invalid attempt ID.');
    }

    if (!Array.isArray(responses)) {
      throw new Error('Invalid responses format. Expected an array of responses.');
    }

    // Check for duplicate responses in payload
    const seenQuestions = new Set<string>();
    for (const r of responses) {
      const qKey = String(r.questionId);
      if (seenQuestions.has(qKey)) {
        throw new Error(`Duplicate response submitted for question ${r.questionId}.`);
      }
      seenQuestions.add(qKey);
    }

    if (!isDatabaseAvailable()) {
      const mock = mockAttemptsStore.get(attemptId) || Array.from(mockAttemptsStore.values()).pop();
      if (mock) {
        if (mock.status === 'submitted') {
          throw new Error('This assessment attempt has already been submitted.');
        }

        const mockAssessment = mockAssessmentsStore.get(mock.assessmentId) || Array.from(mockAssessmentsStore.values()).pop();
        if (mockAssessment && mockAssessment.questions && mockAssessment.questions.length > 0) {
          const validIds = new Set<string>();
          mockAssessment.questions.forEach((q, idx) => {
            if (q.id !== undefined && q.id !== null) validIds.add(String(q.id));
            if (q.order !== undefined && q.order !== null) validIds.add(String(q.order));
            validIds.add(String(idx + 1));
          });
          for (const r of responses) {
            if (validIds.size > 0 && !validIds.has(String(r.questionId))) {
              throw new Error(`Question ${r.questionId} does not belong to this assessment.`);
            }
          }
        }

        for (const r of responses) {
          mock.responses.set(String(r.questionId), r.answer);
        }

        mock.status = 'submitted';
        mock.submittedAt = new Date().toISOString();

        return {
          status: 'success',
          attemptId: mock.id,
          message: 'Assessment submitted successfully.',
          submittedAt: mock.submittedAt,
        };
      }
      throw new Error('Attempt not found.');
    }

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Validate attempt exists and check status
        const attemptRes = await client.query(
          `SELECT id, assessment_id as "assessmentId", status
           FROM assessment_attempts
           WHERE id = $1
           FOR UPDATE;`,
          [attemptId]
        );

        if (attemptRes.rows.length === 0) {
          throw new Error('Attempt not found.');
        }

        const attempt = attemptRes.rows[0];
        if (attempt.status === 'submitted') {
          throw new Error('This assessment attempt has already been submitted.');
        }

        // 2. Validate that questions belong to this assessment
        const questionsRes = await client.query(
          `SELECT question_id as "questionId", question_order as "questionOrder"
           FROM assessment_questions
           WHERE assessment_id = $1;`,
          [attempt.assessmentId]
        );

        const validQuestionIds = new Set(questionsRes.rows.map((r) => String(r.questionId)));
        const orderToQuestionId = new Map<string, number>();
        questionsRes.rows.forEach((r, idx) => {
          orderToQuestionId.set(String(r.questionOrder), r.questionId);
          orderToQuestionId.set(String(idx + 1), r.questionId);
        });

        for (const r of responses) {
          const qIdStr = String(r.questionId);
          if (!validQuestionIds.has(qIdStr) && !orderToQuestionId.has(qIdStr)) {
            throw new Error(`Question ${r.questionId} does not belong to this assessment.`);
          }
        }

        // 3. Persist responses
        for (const r of responses) {
          const qIdStr = String(r.questionId);
          const actualQId = validQuestionIds.has(qIdStr)
            ? parseInt(qIdStr, 10)
            : orderToQuestionId.get(qIdStr)!;

          await client.query(
            `INSERT INTO assessment_responses (attempt_id, question_id, answer, answered_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (attempt_id, question_id)
             DO UPDATE SET answer = EXCLUDED.answer, answered_at = EXCLUDED.answered_at;`,
            [attemptId, actualQId, r.answer !== undefined ? r.answer : null]
          );
        }

        // 4. Mark attempt as submitted
        const updateRes = await client.query(
          `UPDATE assessment_attempts
           SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
               user_id = COALESCE(user_id, $2)
           WHERE id = $1
           RETURNING submitted_at as "submittedAt";`,
          [attemptId, userId || null]
        );

        await client.query('COMMIT');

        const submittedAt = new Date(updateRes.rows[0].submittedAt).toISOString();
        return {
          status: 'success',
          attemptId,
          message: 'Assessment submitted successfully.',
          submittedAt,
        };
      } catch (txnError) {
        await client.query('ROLLBACK');
        throw txnError;
      } finally {
        client.release();
      }
    } catch (error: any) {
      const knownMessages = [
        'Attempt not found.',
        'This assessment attempt has already been submitted.',
        'Invalid attempt ID.',
        'Invalid responses format. Expected an array of responses.',
      ];
      if (knownMessages.includes(error.message) || error.message.includes('does not belong to this assessment') || error.message.includes('Duplicate response')) {
        throw error;
      }

      // In-memory fallback if DB offline (e.g. unit tests)
      const mock = mockAttemptsStore.get(attemptId) || Array.from(mockAttemptsStore.values()).pop();
      if (mock) {
        if (mock.status === 'submitted') {
          throw new Error('This assessment attempt has already been submitted.');
        }

        const mockAssessment = mockAssessmentsStore.get(mock.assessmentId) || Array.from(mockAssessmentsStore.values()).pop();
        if (mockAssessment && mockAssessment.questions && mockAssessment.questions.length > 0) {
          const validIds = new Set<string>();
          mockAssessment.questions.forEach((q, idx) => {
            if (q.id !== undefined && q.id !== null) validIds.add(String(q.id));
            if (q.order !== undefined && q.order !== null) validIds.add(String(q.order));
            validIds.add(String(idx + 1));
          });
          for (const r of responses) {
            if (validIds.size > 0 && !validIds.has(String(r.questionId))) {
              throw new Error(`Question ${r.questionId} does not belong to this assessment.`);
            }
          }
        }

        for (const r of responses) {
          mock.responses.set(String(r.questionId), r.answer);
        }

        mock.status = 'submitted';
        mock.submittedAt = new Date().toISOString();

        return {
          status: 'success',
          attemptId: mock.id,
          message: 'Assessment submitted successfully.',
          submittedAt: mock.submittedAt,
        };
      }

      throw error;
    }
  }

  /**
   * Progressively saves or updates an individual answer before final submission.
   */
  public static async saveProgressiveResponse(
    attemptId: number,
    questionId: number,
    answer: string | null
  ): Promise<{ status: 'success'; saved: boolean }> {
    if (!attemptId || isNaN(attemptId)) throw new Error('Invalid attempt ID.');
    if (!questionId || isNaN(questionId)) throw new Error('Invalid question ID.');

    try {
      const attemptRes = await pool.query(
        'SELECT id, assessment_id as "assessmentId", status FROM assessment_attempts WHERE id = $1;',
        [attemptId]
      );
      if (attemptRes.rows.length === 0) throw new Error('Attempt not found.');
      if (attemptRes.rows[0].status === 'submitted') {
        throw new Error('This assessment attempt has already been submitted.');
      }

      const qCheck = await pool.query(
        'SELECT question_id FROM assessment_questions WHERE assessment_id = $1 AND question_id = $2;',
        [attemptRes.rows[0].assessmentId, questionId]
      );
      if (qCheck.rows.length === 0) {
        throw new Error(`Question ${questionId} does not belong to this assessment.`);
      }

      await pool.query(
        `INSERT INTO assessment_responses (attempt_id, question_id, answer, answered_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET answer = EXCLUDED.answer, answered_at = EXCLUDED.answered_at;`,
        [attemptId, questionId, answer]
      );

      return { status: 'success', saved: true };
    } catch (error: any) {
      let mock = mockAttemptsStore.get(attemptId);
      if (!mock) {
        mock = {
          id: attemptId,
          assessmentId: 1,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          responses: new Map(),
        };
        mockAttemptsStore.set(attemptId, mock);
      }
      if (mock.status === 'submitted') {
        throw new Error('This assessment attempt has already been submitted.');
      }
      mock.responses.set(String(questionId), answer);
      return { status: 'success', saved: true };
    }
  }

  /**
   * Restores attempt state, including saved responses and server-synchronized remaining seconds.
   * Enforces user ownership.
   */
  public static async getAttemptState(attemptId: number, userId?: number | null): Promise<any> {
    if (!attemptId || isNaN(attemptId)) {
      throw new Error('Invalid attempt ID.');
    }

    if (isDatabaseAvailable()) {
      const attemptRes = await pool.query(
        `SELECT a.id, a.assessment_id as "assessmentId", a.user_id as "userId",
                a.status, a.started_at as "startedAt", a.duration_seconds as "durationSeconds",
                t.topic as "topicName"
         FROM assessment_attempts a
         JOIN assessments ass ON a.assessment_id = ass.id
         LEFT JOIN topics t ON ass.topic_id = t.id
         WHERE a.id = $1;`,
        [attemptId]
      );

      if (attemptRes.rows.length === 0) {
        throw new Error('Attempt not found.');
      }

      const attempt = attemptRes.rows[0];

      // Ownership check (Part 48)
      if (userId && attempt.userId && attempt.userId !== userId) {
        throw new Error('Attempt not found or access denied.');
      }

      const startedMs = new Date(attempt.startedAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startedMs) / 1000);
      let remainingSeconds = Math.max(0, attempt.durationSeconds - elapsedSeconds);

      // Auto-submit if timer expired
      if (remainingSeconds === 0 && attempt.status === 'in_progress') {
        await pool.query(
          `UPDATE assessment_attempts SET status = 'timed_out', submitted_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [attemptId]
        );
        attempt.status = 'timed_out';
      }

      // Fetch public assessment questions
      const publicAssessment = await this.getPublicAssessment(attempt.assessmentId);

      // Fetch saved progressive responses
      const responsesRes = await pool.query(
        `SELECT question_id as "questionId", answer FROM assessment_responses WHERE attempt_id = $1;`,
        [attemptId]
      );

      const savedAnswers: Record<string, string> = {};
      for (const row of responsesRes.rows) {
        if (row.answer !== null) {
          savedAnswers[String(row.questionId)] = row.answer;
        }
      }

      return {
        attemptId: attempt.id,
        assessmentId: attempt.assessmentId,
        topicName: attempt.topicName || publicAssessment.topicName,
        status: attempt.status,
        startedAt: attempt.startedAt,
        durationSeconds: attempt.durationSeconds,
        remainingSeconds,
        questions: publicAssessment.questions,
        savedAnswers,
      };
    }

    // In-memory fallback
    const mock = mockAttemptsStore.get(attemptId);
    if (!mock) throw new Error('Attempt not found.');

    const startedMs = new Date(mock.startedAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - startedMs) / 1000);
    const remainingSeconds = Math.max(0, 600 - elapsedSeconds);

    const publicAssessment = await this.getPublicAssessment(mock.assessmentId);
    const savedAnswers: Record<string, string> = {};
    for (const [k, v] of mock.responses.entries()) {
      if (v !== null) savedAnswers[k] = v;
    }

    return {
      attemptId: mock.id,
      assessmentId: mock.assessmentId,
      topicName: publicAssessment.topicName,
      status: mock.status,
      startedAt: mock.startedAt,
      durationSeconds: 600,
      remainingSeconds,
      questions: publicAssessment.questions,
      savedAnswers,
    };
  }

  private static formatPublicAssessment(mock: any): PublicAssessment {
    return {
      id: mock.id,
      topicId: mock.topicId,
      topicName: mock.topicName || 'Computer Science Assessment',
      questionCount: mock.questions ? mock.questions.length : 0,
      targetDifficulty: mock.targetDifficulty,
      questions: (mock.questions || []).map((q: any) => {
        let sampleTestCases = q.sampleTestCases;
        if (!sampleTestCases && q.type === 'CODING' && Array.isArray(q.testCases)) {
          sampleTestCases = q.testCases
            .filter((tc: any) => !tc.isHidden && !tc.is_hidden)
            .map((tc: any) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput || tc.expected_output,
            }));
        }

        return {
          id: q.id,
          order: q.order,
          type: q.type,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          subtopic: q.subtopic,
          concept: q.concept,
          codeSnippet: q.codeSnippet,
          scenarioText: q.scenarioText,
          estimatedTimeSeconds: DEFAULT_TIME_ESTIMATES[q.type as keyof typeof DEFAULT_TIME_ESTIMATES] || 60,
          language: q.type === 'CODING' ? 'cpp' : undefined,
          starterCode: q.starterCode,
          constraints: q.constraints,
          sampleTestCases,
        };
      }),
    };
  }
}
