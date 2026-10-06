import { pool } from '../db';
import {
  TrendType,
  AdvancedSkillStatus,
  SkillHistoryRecord,
  AssessmentPerformanceRecord,
  SkillHistoryObservation,
  SkillProgressSummary,
  TopicProgressSummary,
  ChronologicalAssessmentHistoryItem,
} from '../types/progress';
import { PerformanceAnalysisResult } from '../types/analysis';
import { mockSkillProfilesStore } from './performanceService';

// In-memory mock stores for test resilience and offline testing
export const mockSkillHistoryStore: SkillHistoryRecord[] = [];
export const mockAssessmentPerformanceStore: AssessmentPerformanceRecord[] = [];
let mockHistoryIdCounter = 1;
let mockPerfIdCounter = 1;

export interface TrendConfig {
  recentWindow: number;
  improvementThreshold: number;
  declineThreshold: number;
  masteryScore: number;
  masteryConfidence: number;
  masteryMinEvidence: number;
  weaknessThreshold: number;
  persistentWeaknessCount: number;
}

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  recentWindow: 3,
  improvementThreshold: 0.08,
  declineThreshold: -0.08,
  masteryScore: 0.85,
  masteryConfidence: 0.80,
  masteryMinEvidence: 5,
  weaknessThreshold: 0.60,
  persistentWeaknessCount: 3,
};

export class ProgressAnalysisService {
  /**
   * Idempotently appends an analyzed assessment's results into append-only historical tables.
   */
  public static async recordAssessmentPerformance(
    attemptId: number,
    analysis: PerformanceAnalysisResult,
    topicId: number,
    averageDifficulty = 0.50
  ): Promise<void> {
    if (!attemptId || !analysis) return;

    // Check in-memory store for duplicate
    const alreadyRecordedInMemory = mockAssessmentPerformanceStore.some(
      (r) => r.attemptId === attemptId
    );

    const now = new Date().toISOString();

    let userId: number | null = null;
    try {
      const userRes = await pool.query('SELECT user_id FROM assessment_attempts WHERE id = $1;', [attemptId]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].user_id || null;
      }
    } catch {
      // ignore
    }

    // 1. Persist AssessmentPerformanceRecord with user_id
    try {
      await pool.query(
        `INSERT INTO assessment_performance_history (
           user_id, topic_id, attempt_id, overall_accuracy, completion_rate,
           evaluated_questions, correct_answers, total_questions,
           duration_seconds, average_difficulty, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (attempt_id) DO UPDATE SET
           user_id = COALESCE(EXCLUDED.user_id, assessment_performance_history.user_id),
           overall_accuracy = EXCLUDED.overall_accuracy,
           completion_rate = EXCLUDED.completion_rate,
           evaluated_questions = EXCLUDED.evaluated_questions,
           correct_answers = EXCLUDED.correct_answers,
           total_questions = EXCLUDED.total_questions,
           duration_seconds = EXCLUDED.duration_seconds,
           average_difficulty = EXCLUDED.average_difficulty;`,
        [
          userId,
          topicId,
          attemptId,
          analysis.overall.accuracy,
          analysis.overall.completionRate,
          analysis.overall.evaluatedQuestions,
          analysis.overall.correctAnswers,
          analysis.overall.totalQuestions,
          analysis.overall.durationSeconds,
          averageDifficulty,
          now,
        ]
      );
    } catch (dbErr) {
      if (!alreadyRecordedInMemory) {
        mockAssessmentPerformanceStore.push({
          id: mockPerfIdCounter++,
          topicId,
          attemptId,
          overallAccuracy: analysis.overall.accuracy,
          completionRate: analysis.overall.completionRate,
          evaluatedQuestions: analysis.overall.evaluatedQuestions,
          correctAnswers: analysis.overall.correctAnswers,
          totalQuestions: analysis.overall.totalQuestions,
          durationSeconds: analysis.overall.durationSeconds,
          averageDifficulty,
          createdAt: now,
        });
      }
    }

    // 2. Persist SkillHistoryRecord for each evaluated skill with user_id
    if (analysis.skills && typeof analysis.skills === 'object') {
      for (const [skillName, skillData] of Object.entries(analysis.skills)) {
        try {
          await pool.query(
            `INSERT INTO skill_history (
               user_id, topic_id, attempt_id, skill, score, confidence,
               evidence_count, status, assessed_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
            [
              userId,
              topicId,
              attemptId,
              skillName,
              skillData.score,
              skillData.confidence,
              skillData.evidence,
              skillData.status,
              now,
            ]
          );

          // Also upsert user skill profile
          await pool.query(
            `INSERT INTO skill_profiles (
               user_id, topic_id, skill, score, confidence, status,
               evaluated_questions, correct_answers, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (topic_id, skill) DO UPDATE SET
               user_id = COALESCE(EXCLUDED.user_id, skill_profiles.user_id),
               score = EXCLUDED.score,
               confidence = EXCLUDED.confidence,
               status = EXCLUDED.status,
               evaluated_questions = EXCLUDED.evaluated_questions,
               correct_answers = EXCLUDED.correct_answers,
               updated_at = EXCLUDED.updated_at;`,
            [
              userId,
              topicId,
              skillName,
              skillData.score,
              skillData.confidence,
              skillData.status,
              skillData.evidence,
              skillData.correctCount || 0,
              now,
            ]
          );
        } catch (dbErr) {
          if (!alreadyRecordedInMemory) {
            mockSkillHistoryStore.push({
              id: mockHistoryIdCounter++,
              topicId,
              attemptId,
              skill: skillName,
              score: skillData.score,
              confidence: skillData.confidence,
              evidenceCount: skillData.evidence,
              status: skillData.status,
              assessedAt: now,
            });
          }
        }
      }
    }
  }

  /**
   * Analyzes longitudinal trend from an array of chronological observations.
   */
  public static analyzeSkillTrend(
    history: { score: number; difficulty?: number }[],
    config: TrendConfig = DEFAULT_TREND_CONFIG
  ): { trend: TrendType; change: number; recentAvg: number; prevAvg: number } {
    if (!history || history.length < 2) {
      const singleScore = history && history.length === 1 ? history[0].score : 0;
      return {
        trend: 'INSUFFICIENT_DATA',
        change: 0,
        recentAvg: singleScore,
        prevAvg: singleScore,
      };
    }

    const n = history.length;
    let recentAvg = 0;
    let prevAvg = 0;
    let change = 0;

    if (n === 2) {
      prevAvg = history[0].score;
      recentAvg = history[1].score;
      change = Number((recentAvg - prevAvg).toFixed(3));
    } else {
      const windowSize = Math.min(config.recentWindow, n - 1);
      const recentSlice = history.slice(n - windowSize);
      const prevSlice = history.slice(0, n - windowSize);

      recentAvg = Number((recentSlice.reduce((sum, h) => sum + h.score, 0) / recentSlice.length).toFixed(3));
      prevAvg = Number((prevSlice.reduce((sum, h) => sum + h.score, 0) / prevSlice.length).toFixed(3));
      change = Number((recentAvg - prevAvg).toFixed(3));
    }

    let trend: TrendType = 'STABLE';
    if (change >= config.improvementThreshold) {
      trend = 'IMPROVING';
    } else if (change <= config.declineThreshold) {
      trend = 'DECLINING';
    }

    return { trend, change, recentAvg, prevAvg };
  }

  /**
   * Classifies advanced skill status: MASTERED, PERSISTENT_WEAKNESS, RECOVERING, REGRESSION, etc.
   */
  public static classifyAdvancedSkillStatus(
    currentScore: number,
    confidence: number,
    evidence: number,
    trend: TrendType,
    historyScores: number[],
    config: TrendConfig = DEFAULT_TREND_CONFIG
  ): AdvancedSkillStatus {
    // 1. Check for Insufficient Evidence
    if (evidence < 2 || confidence < 0.40) {
      return 'INSUFFICIENT_EVIDENCE';
    }

    // 2. Check for Mastered
    // Score >= 0.85, Confidence >= 0.80, Evidence >= 5, Trend not declining
    if (
      currentScore >= config.masteryScore &&
      confidence >= config.masteryConfidence &&
      evidence >= config.masteryMinEvidence &&
      trend !== 'DECLINING'
    ) {
      return 'MASTERED';
    }

    // 3. Check for Persistent Weakness
    // Weakness across at least 3 assessments
    if (historyScores.length >= config.persistentWeaknessCount) {
      const recentAttempts = historyScores.slice(-config.persistentWeaknessCount);
      const allRecentWeak = recentAttempts.every((s) => s < config.weaknessThreshold);
      if (allRecentWeak && currentScore < config.weaknessThreshold && trend !== 'IMPROVING') {
        return 'PERSISTENT_WEAKNESS';
      }
    }

    // 4. Check for Regression
    // Previously strong/mastered, but now declining
    const hadHighMastery = historyScores.slice(0, -1).some((s) => s >= 0.80);
    if (hadHighMastery && trend === 'DECLINING' && currentScore < 0.80) {
      return 'REGRESSION';
    }

    // 5. Check for Recovering
    // Previously weak (< 0.60), but recent trend is improving
    const hadWeakness = historyScores.slice(0, -1).some((s) => s < config.weaknessThreshold);
    if (hadWeakness && trend === 'IMPROVING' && currentScore < 0.85) {
      return 'RECOVERING';
    }

    // 6. Base States
    if (currentScore < config.weaknessThreshold) {
      return 'WEAK';
    }
    if (currentScore < 0.80) {
      return 'DEVELOPING';
    }
    return 'STRONG';
  }

  /**
   * Retrieves comprehensive longitudinal progress for a topic.
   */
  public static async getTopicProgress(
    topicId: number,
    config: TrendConfig = DEFAULT_TREND_CONFIG
  ): Promise<TopicProgressSummary> {
    if (!topicId || isNaN(topicId)) {
      throw new Error('Invalid topic ID.');
    }

    // 1. Fetch Topic Name
    let topicName = 'Computer Science';
    try {
      const tRes = await pool.query('SELECT topic FROM topics WHERE id = $1', [topicId]);
      if (tRes.rows.length > 0 && tRes.rows[0].topic) {
        topicName = tRes.rows[0].topic;
      }
    } catch (e) {
      // In-memory fallback
    }

    // 2. Fetch Assessment History
    let perfRecords: AssessmentPerformanceRecord[] = [];
    try {
      const perfRes = await pool.query(
        `SELECT id, topic_id as "topicId", attempt_id as "attemptId",
                overall_accuracy::float as "overallAccuracy",
                completion_rate::float as "completionRate",
                evaluated_questions as "evaluatedQuestions",
                correct_answers as "correctAnswers",
                total_questions as "totalQuestions",
                duration_seconds as "durationSeconds",
                average_difficulty::float as "averageDifficulty",
                created_at as "createdAt"
         FROM assessment_performance_history
         WHERE topic_id = $1
         ORDER BY created_at ASC, id ASC;`,
        [topicId]
      );
      perfRecords = perfRes.rows;
    } catch (dbErr) {
      perfRecords = mockAssessmentPerformanceStore.filter((r) => r.topicId === topicId);
    }

    // 3. Fetch Skill History
    let skillHistoryRecords: SkillHistoryRecord[] = [];
    try {
      const skillHistRes = await pool.query(
        `SELECT id, topic_id as "topicId", attempt_id as "attemptId",
                skill, score::float as score, confidence::float as confidence,
                evidence_count as "evidenceCount", status, assessed_at as "assessedAt"
         FROM skill_history
         WHERE topic_id = $1
         ORDER BY assessed_at ASC, id ASC;`,
        [topicId]
      );
      skillHistoryRecords = skillHistRes.rows;
    } catch (dbErr) {
      skillHistoryRecords = mockSkillHistoryStore.filter((r) => r.topicId === topicId);
    }

    // 4. Calculate Overall Assessment Metrics
    const totalAssessments = perfRecords.length;
    let averageAccuracy = 0;
    let latestAccuracy = 0;
    let improvement = 0;
    let averageDifficulty = 0.50;
    let latestDifficulty = 0.50;

    if (totalAssessments > 0) {
      averageAccuracy = Number(
        (perfRecords.reduce((sum, r) => sum + r.overallAccuracy, 0) / totalAssessments).toFixed(3)
      );
      latestAccuracy = perfRecords[totalAssessments - 1].overallAccuracy;
      const firstAccuracy = perfRecords[0].overallAccuracy;
      improvement = Number((latestAccuracy - firstAccuracy).toFixed(3));

      averageDifficulty = Number(
        (perfRecords.reduce((sum, r) => sum + r.averageDifficulty, 0) / totalAssessments).toFixed(3)
      );
      latestDifficulty = perfRecords[totalAssessments - 1].averageDifficulty;
    }

    // 5. Group Skill History and Evaluate Trends per Skill
    const skillMap = new Map<string, SkillHistoryRecord[]>();
    for (const record of skillHistoryRecords) {
      const list = skillMap.get(record.skill) || [];
      list.push(record);
      skillMap.set(record.skill, list);
    }

    // Also verify against current aggregate skill profiles
    for (const [key, profile] of mockSkillProfilesStore.entries()) {
      if (key.startsWith(`${topicId}:`)) {
        if (!skillMap.has(profile.skill)) {
          skillMap.set(profile.skill, []);
        }
      }
    }

    const skills: SkillProgressSummary[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const improving: string[] = [];
    const recovering: string[] = [];
    const regressions: string[] = [];
    const persistentWeaknesses: string[] = [];
    const mastered: string[] = [];

    for (const [skillName, records] of skillMap.entries()) {
      const historyObs: SkillHistoryObservation[] = records.map((r) => ({
        attemptId: r.attemptId,
        score: r.score,
        confidence: r.confidence,
        evidenceCount: r.evidenceCount,
        assessedAt: r.assessedAt,
      }));

      // Current values
      let currentScore = 0;
      let currentConfidence = 0;
      let currentEvidence = 0;

      if (records.length > 0) {
        const latest = records[records.length - 1];
        currentScore = latest.score;
        currentConfidence = latest.confidence;
        currentEvidence = latest.evidenceCount;
      } else {
        const profile = mockSkillProfilesStore.get(`${topicId}:${skillName}`);
        if (profile) {
          currentScore = profile.score;
          currentConfidence = profile.confidence;
          currentEvidence = profile.evaluatedQuestions;
        }
      }

      const scores = records.map((r) => r.score);
      const { trend, change } = this.analyzeSkillTrend(historyObs, config);
      const advancedStatus = this.classifyAdvancedSkillStatus(
        currentScore,
        currentConfidence,
        currentEvidence,
        trend,
        scores,
        config
      );

      const previousScore = records.length >= 2 ? records[records.length - 2].score : null;

      skills.push({
        skill: skillName,
        score: currentScore,
        confidence: currentConfidence,
        status: advancedStatus,
        trend,
        change,
        evidence: currentEvidence,
        previousScore,
        history: historyObs,
      });

      // Categorize
      if (advancedStatus === 'MASTERED') mastered.push(skillName);
      if (advancedStatus === 'MASTERED' || advancedStatus === 'STRONG') strengths.push(skillName);
      if (advancedStatus === 'WEAK' || advancedStatus === 'PERSISTENT_WEAKNESS') weaknesses.push(skillName);
      if (trend === 'IMPROVING') improving.push(skillName);
      if (advancedStatus === 'RECOVERING') recovering.push(skillName);
      if (advancedStatus === 'REGRESSION') regressions.push(skillName);
      if (advancedStatus === 'PERSISTENT_WEAKNESS') persistentWeaknesses.push(skillName);
    }

    // Sort skills: high priority/weakness first, then developing, then strong/mastered
    skills.sort((a, b) => a.score - b.score);

    return {
      status: 'success',
      topicId,
      topic: topicName,
      assessments: {
        total: totalAssessments,
        averageAccuracy,
        latestAccuracy,
        improvement,
        averageDifficulty,
        latestDifficulty,
      },
      skills,
      strengths,
      weaknesses,
      improving,
      recovering,
      regressions,
      persistentWeaknesses,
      mastered,
    };
  }

  /**
   * Retrieves chronological assessment history for chart plotting.
   */
  public static async getTopicHistory(topicId: number): Promise<{ history: ChronologicalAssessmentHistoryItem[] }> {
    let perfRecords: AssessmentPerformanceRecord[] = [];
    try {
      const perfRes = await pool.query(
        `SELECT id, topic_id as "topicId", attempt_id as "attemptId",
                overall_accuracy::float as "overallAccuracy",
                completion_rate::float as "completionRate",
                evaluated_questions as "evaluatedQuestions",
                total_questions as "totalQuestions",
                duration_seconds as "durationSeconds",
                average_difficulty::float as "averageDifficulty",
                created_at as "createdAt"
         FROM assessment_performance_history
         WHERE topic_id = $1
         ORDER BY created_at ASC, id ASC;`,
        [topicId]
      );
      perfRecords = perfRes.rows;
    } catch (dbErr) {
      perfRecords = mockAssessmentPerformanceStore.filter((r) => r.topicId === topicId);
    }

    const history: ChronologicalAssessmentHistoryItem[] = perfRecords.map((r) => ({
      attemptId: r.attemptId,
      accuracy: r.overallAccuracy,
      difficulty: r.averageDifficulty,
      durationSeconds: r.durationSeconds,
      date: r.createdAt,
      evaluatedQuestions: r.evaluatedQuestions,
      totalQuestions: r.totalQuestions,
    }));

    return { history };
  }

  /**
   * Retrieves timeline and trend analysis for a single skill.
   */
  public static async getSkillHistory(
    topicId: number,
    skillName: string
  ): Promise<SkillProgressSummary> {
    const progress = await this.getTopicProgress(topicId);
    const found = progress.skills.find(
      (s) => s.skill.toLowerCase() === skillName.toLowerCase()
    );

    if (!found) {
      return {
        skill: skillName,
        score: 0,
        confidence: 0,
        status: 'INSUFFICIENT_EVIDENCE',
        trend: 'INSUFFICIENT_DATA',
        change: 0,
        evidence: 0,
        previousScore: null,
        history: [],
      };
    }

    return found;
  }
}
