import { pool, isDatabaseAvailable } from '../db';
import { Question } from '../types/question';
import { SkillProfileRecord, PerformanceAnalysisResult } from '../types/analysis';
import {
  AdaptiveSkillPriority,
  TargetAssessmentProfile,
  DifficultyOptions,
  AdaptiveAssessmentRunRecord,
  AdaptiveAssessmentRequest,
  AdaptiveAssessmentResponse,
} from '../types/adaptive';
import { AssessmentService } from './assessmentService';
import { mockSkillProfilesStore, mockAnalysesStore } from './performanceService';
import { ProgressAnalysisService } from './progressAnalysisService';
import { QuestionGeneratorService } from './questionGeneratorService';

export const DEFAULT_DIFFICULTY_OPTIONS: DifficultyOptions = {
  minimumDifficulty: 0.20,
  maximumDifficulty: 0.85,
  difficultyStep: 0.08,
};

// In-memory mock store for offline unit tests
export const mockAdaptiveRunsStore = new Map<number, AdaptiveAssessmentRunRecord>();
let mockRunIdCounter = 1;

export class AdaptiveAssessmentService {
  /**
   * Calculates the target difficulty for the next assessment based on previous performance.
   * Ensures gradual adjustments bounded by minimum and maximum thresholds.
   */
  public static calculateNextDifficulty(
    previousDifficulty: number,
    accuracy: number,
    options: Partial<DifficultyOptions> = {}
  ): { nextDifficulty: number; reasoning: string } {
    const config: DifficultyOptions = {
      ...DEFAULT_DIFFICULTY_OPTIONS,
      ...options,
    };

    const prev = Math.max(config.minimumDifficulty, Math.min(config.maximumDifficulty, previousDifficulty));
    let nextDifficulty = prev;
    let reasoning = '';

    if (accuracy >= 0.85) {
      // Strong performance: increase difficulty by a full step
      nextDifficulty = prev + config.difficultyStep;
      reasoning = `Target difficulty increased from ${prev.toFixed(2)} to ${Math.min(config.maximumDifficulty, nextDifficulty).toFixed(2)} (+${config.difficultyStep.toFixed(2)}) based on strong accuracy (${Math.round(accuracy * 100)}%).`;
    } else if (accuracy >= 0.70) {
      // Good performance: small gradual increase
      const halfStep = config.difficultyStep * 0.5;
      nextDifficulty = prev + halfStep;
      reasoning = `Target difficulty slightly increased from ${prev.toFixed(2)} to ${Math.min(config.maximumDifficulty, nextDifficulty).toFixed(2)} (+${halfStep.toFixed(2)}) to encourage continued growth.`;
    } else if (accuracy >= 0.50) {
      // Developing performance: small consolidation step
      const halfStep = config.difficultyStep * 0.5;
      nextDifficulty = prev - halfStep;
      reasoning = `Target difficulty slightly lowered from ${prev.toFixed(2)} to ${Math.max(config.minimumDifficulty, nextDifficulty).toFixed(2)} (-${halfStep.toFixed(2)}) to consolidate developing skills.`;
    } else {
      // Low performance: decrease difficulty by a full step for remediation
      nextDifficulty = prev - config.difficultyStep;
      reasoning = `Target difficulty decreased from ${prev.toFixed(2)} to ${Math.max(config.minimumDifficulty, nextDifficulty).toFixed(2)} (-${config.difficultyStep.toFixed(2)}) to provide foundational reinforcement.`;
    }

    // Strictly enforce minimum and maximum boundaries
    const clamped = Math.max(config.minimumDifficulty, Math.min(config.maximumDifficulty, Number(nextDifficulty.toFixed(3))));
    return {
      nextDifficulty: clamped,
      reasoning,
    };
  }

  /**
   * Calculates skill priorities and target weights from the student's SkillProfile records
   * and longitudinal trend signals.
   */
  public static calculateSkillPriorities(
    skillProfiles: SkillProfileRecord[],
    skillProgressSummaries?: import('../types/progress').SkillProgressSummary[]
  ): {
    priorities: Record<string, AdaptiveSkillPriority>;
    skillTargets: Record<string, number>;
    reasoning: string[];
  } {
    const priorities: Record<string, AdaptiveSkillPriority> = {};
    const skillTargets: Record<string, number> = {};
    const reasoning: string[] = [];

    if (!skillProfiles || skillProfiles.length === 0) {
      return { priorities, skillTargets, reasoning };
    }

    const progressMap = new Map<string, import('../types/progress').SkillProgressSummary>();
    if (skillProgressSummaries && Array.isArray(skillProgressSummaries)) {
      for (const p of skillProgressSummaries) {
        progressMap.set(p.skill.toLowerCase(), p);
      }
    }

    for (const record of skillProfiles) {
      const skillName = record.skill;
      const score = record.score;
      const confidence = record.confidence;
      const evidence = record.evaluatedQuestions || 0;
      const progress = progressMap.get(skillName.toLowerCase());

      // Trend-aware prioritization (Trial 11)
      if (progress) {
        if (progress.status === 'PERSISTENT_WEAKNESS') {
          priorities[skillName] = {
            skill: skillName,
            priority: 'HIGH',
            weight: 0.85,
            reasoning: `Skill "${skillName}" identified as a persistent weakness across multiple assessments; prioritized for targeted remediation.`,
            currentScore: score,
            confidence,
            evidenceCount: evidence,
          };
          skillTargets[skillName] = 0.85;
          reasoning.push(`Skill "${skillName}" identified as a persistent weakness; high priority set (weight: 0.85).`);
          continue;
        } else if (progress.status === 'REGRESSION') {
          priorities[skillName] = {
            skill: skillName,
            priority: 'HIGH',
            weight: 0.80,
            reasoning: `Skill "${skillName}" showed performance regression; prioritized for intervention.`,
            currentScore: score,
            confidence,
            evidenceCount: evidence,
          };
          skillTargets[skillName] = 0.80;
          reasoning.push(`Skill "${skillName}" showed recent regression; high priority set (weight: 0.80).`);
          continue;
        } else if (progress.status === 'RECOVERING') {
          priorities[skillName] = {
            skill: skillName,
            priority: 'MEDIUM',
            weight: 0.60,
            reasoning: `Skill "${skillName}" is recovering from prior weakness; medium priority assigned to support trajectory.`,
            currentScore: score,
            confidence,
            evidenceCount: evidence,
          };
          skillTargets[skillName] = 0.60;
          reasoning.push(`Skill "${skillName}" is recovering with positive trend; medium priority set (weight: 0.60).`);
          continue;
        } else if (progress.status === 'MASTERED') {
          if (progress.trend === 'DECLINING') {
            priorities[skillName] = {
              skill: skillName,
              priority: 'MEDIUM',
              weight: 0.65,
              reasoning: `Skill "${skillName}" reached mastery but showed recent dip; reassessment assigned.`,
              currentScore: score,
              confidence,
              evidenceCount: evidence,
            };
            skillTargets[skillName] = 0.65;
            reasoning.push(`Skill "${skillName}" has demonstrated mastery but showed a recent decline; reassessment priority set.`);
            continue;
          } else {
            priorities[skillName] = {
              skill: skillName,
              priority: 'LOW',
              weight: 0.10,
              reasoning: `Skill "${skillName}" has reached stable mastery; baseline maintenance weight assigned.`,
              currentScore: score,
              confidence,
              evidenceCount: evidence,
            };
            skillTargets[skillName] = 0.10;
            reasoning.push(`Skill "${skillName}" reached stable mastery; maintenance weight assigned (0.10).`);
            continue;
          }
        }
      }

      if (evidence < 2 || confidence < 0.40) {
        // Insufficient evidence: assign moderate diagnostic priority
        priorities[skillName] = {
          skill: skillName,
          priority: 'INSUFFICIENT_EVIDENCE',
          weight: 0.45,
          reasoning: `Skill "${skillName}" has insufficient evidence (${evidence} question${evidence === 1 ? '' : 's'} evaluated); assigned moderate priority to collect diagnostic data.`,
          currentScore: score,
          confidence,
          evidenceCount: evidence,
        };
        skillTargets[skillName] = 0.45;
        reasoning.push(`Skill "${skillName}" prioritized for evidence gathering (${evidence} question${evidence === 1 ? '' : 's'}).`);
      } else if (score < 0.60) {
        // Weak skill: High priority for remediation
        priorities[skillName] = {
          skill: skillName,
          priority: 'HIGH',
          weight: 0.80,
          reasoning: `Skill "${skillName}" identified as weak (score: ${score.toFixed(2)}); high priority assigned for targeted remediation.`,
          currentScore: score,
          confidence,
          evidenceCount: evidence,
        };
        skillTargets[skillName] = 0.80;
        reasoning.push(`Skill "${skillName}" identified as a weak skill (score: ${score.toFixed(2)}); high priority set.`);
      } else if (score < 0.80) {
        // Developing skill: Medium priority
        priorities[skillName] = {
          skill: skillName,
          priority: 'MEDIUM',
          weight: 0.50,
          reasoning: `Skill "${skillName}" is developing (score: ${score.toFixed(2)}); medium priority assigned to build consistency.`,
          currentScore: score,
          confidence,
          evidenceCount: evidence,
        };
        skillTargets[skillName] = 0.50;
        reasoning.push(`Skill "${skillName}" is developing (score: ${score.toFixed(2)}); medium priority set.`);
      } else {
        // Strong skill: Low priority maintenance weight (never completely eliminated)
        priorities[skillName] = {
          skill: skillName,
          priority: 'LOW',
          weight: 0.15,
          reasoning: `Skill "${skillName}" demonstrated strong mastery (score: ${score.toFixed(2)}); maintained at low weight to preserve competency.`,
          currentScore: score,
          confidence,
          evidenceCount: evidence,
        };
        skillTargets[skillName] = 0.15;
        reasoning.push(`Skill "${skillName}" maintained at baseline weight to preserve demonstrated mastery (score: ${score.toFixed(2)}).`);
      }
    }

    return { priorities, skillTargets, reasoning };
  }

  /**
   * Adapts target question types based on previous question-type performance.
   */
  public static calculateQuestionTypeTargets(
    previousAnalysis?: PerformanceAnalysisResult
  ): { targets: Record<string, number>; reasoning: string[] } {
    const defaultTargets: Record<string, number> = {
      MCQ: 0.70,
      CONCEPTUAL: 0.10,
      OUTPUT_PREDICTION: 0.10,
      DEBUGGING: 0.05,
      SCENARIO: 0.05,
    };

    if (!previousAnalysis || !previousAnalysis.questionTypes || Object.keys(previousAnalysis.questionTypes).length === 0) {
      return {
        targets: defaultTargets,
        reasoning: ['70/30 distribution rule applied: 70% MCQs and 30% descriptive formats for optimal engagement.'],
      };
    }

    const targets: Record<string, number> = { ...defaultTargets };
    const reasoning: string[] = [];

    // Analyze performance per type
    for (const [qType, stats] of Object.entries(previousAnalysis.questionTypes)) {
      if (stats.evaluated > 0 && stats.accuracy !== null) {
        if (stats.accuracy < 0.60) {
          targets[qType] = 0.35; // Weaker format: increase representation
          reasoning.push(`Question type "${qType}" weight increased to 35% due to lower previous accuracy (${Math.round(stats.accuracy * 100)}%).`);
        } else if (stats.accuracy >= 0.85) {
          targets[qType] = 0.10; // Mastered format: reduce slightly to avoid over-testing
          reasoning.push(`Question type "${qType}" weight reduced to 10% to prevent over-testing mastered format (${Math.round(stats.accuracy * 100)}%).`);
        } else {
          targets[qType] = 0.20;
        }
      }
    }

    // Normalize weights to sum to 1.0
    const totalWeight = Object.values(targets).reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      for (const k of Object.keys(targets)) {
        targets[k] = Number((targets[k] / totalWeight).toFixed(2));
      }
    }

    return { targets, reasoning };
  }

  /**
   * Adapts cognitive level targets based on previous cognitive-level performance.
   */
  public static calculateCognitiveTargets(
    previousAnalysis?: PerformanceAnalysisResult
  ): { targets: Record<string, number>; reasoning: string[] } {
    const defaultTargets: Record<string, number> = {
      remember: 0.25,
      understand: 0.25,
      apply: 0.25,
      analyze: 0.25,
    };

    if (!previousAnalysis || !previousAnalysis.cognitiveLevels || Object.keys(previousAnalysis.cognitiveLevels).length === 0) {
      return {
        targets: defaultTargets,
        reasoning: ['Balanced cognitive level distribution applied.'],
      };
    }

    const targets: Record<string, number> = { ...defaultTargets };
    const reasoning: string[] = [];

    const rememberAcc = previousAnalysis.cognitiveLevels['remember']?.accuracy ?? 0.5;
    const understandAcc = previousAnalysis.cognitiveLevels['understand']?.accuracy ?? 0.5;
    const applyAcc = previousAnalysis.cognitiveLevels['apply']?.accuracy ?? 0.5;
    const analyzeAcc = previousAnalysis.cognitiveLevels['analyze']?.accuracy ?? 0.5;

    // If foundational levels (remember/understand) are mastered, shift focus to apply/analyze
    if ((rememberAcc >= 0.80 || understandAcc >= 0.80) && (applyAcc < 0.75 || analyzeAcc < 0.75)) {
      targets['remember'] = 0.10;
      targets['understand'] = 0.15;
      targets['apply'] = 0.35;
      targets['analyze'] = 0.40;
      reasoning.push('Higher-order cognitive levels (application & analysis) emphasized over basic recall based on previous mastery.');
    } else if (rememberAcc < 0.60 || understandAcc < 0.60) {
      // Reinforce understanding if recall/comprehension were weak
      targets['remember'] = 0.35;
      targets['understand'] = 0.35;
      targets['apply'] = 0.15;
      targets['analyze'] = 0.15;
      reasoning.push('Foundational comprehension levels emphasized to address core concept gaps.');
    } else {
      reasoning.push('Cognitive level distribution balanced across recall, comprehension, and analytical evaluation.');
    }

    return { targets, reasoning };
  }

  /**
   * Generates an adaptive assessment for a topic by synthesizing SkillProfile and PerformanceAnalysis,
   * building a TargetAssessmentProfile, running the Genetic Algorithm, and persisting the decision.
   */
  public static async generateAdaptiveAssessment(
    params: AdaptiveAssessmentRequest
  ): Promise<AdaptiveAssessmentResponse> {
    const { topicId, questionCount = 10, previousAttemptId, questions } = params;

    if (!topicId || isNaN(topicId)) {
      throw new Error('Invalid topic ID.');
    }

    // 1. Fetch SkillProfile records for this topic
    let skillProfiles: SkillProfileRecord[] = [];
    if (isDatabaseAvailable()) {
      try {
        const skillsRes = await pool.query(
          `SELECT topic_id as "topicId", skill, score::float as score,
                  confidence::float as confidence, status,
                  evaluated_questions as "evaluatedQuestions",
                  correct_answers as "correctAnswers",
                  last_assessed_at as "lastAssessedAt"
           FROM skill_profiles
           WHERE topic_id = $1
           ORDER BY score ASC;`,
          [topicId]
        );
        skillProfiles = skillsRes.rows;
      } catch (dbErr) {
        // In-memory fallback
        for (const [key, profile] of mockSkillProfilesStore.entries()) {
          if (key.startsWith(`${topicId}:`)) {
            skillProfiles.push(profile);
          }
        }
      }
    } else {
      for (const [key, profile] of mockSkillProfilesStore.entries()) {
        if (key.startsWith(`${topicId}:`)) {
          skillProfiles.push(profile);
        }
      }
    }

    // 2. Fetch latest PerformanceAnalysis if available
    let previousAnalysis: PerformanceAnalysisResult | undefined = undefined;
    let attemptDifficulty = 0.50;

    if (previousAttemptId) {
      if (isDatabaseAvailable()) {
        try {
          const analysisRes = await pool.query(
            `SELECT p.*, a.target_difficulty as "targetDifficulty"
             FROM performance_analyses p
             JOIN assessment_attempts att ON p.attempt_id = att.id
             JOIN assessments a ON att.assessment_id = a.id
             WHERE p.attempt_id = $1;`,
            [previousAttemptId]
          );
          if (analysisRes.rows.length > 0) {
            const row = analysisRes.rows[0];
            attemptDifficulty = Number(row.targetDifficulty) || 0.50;
            previousAnalysis = {
              status: 'success',
              attemptId: previousAttemptId,
              overall: {
                accuracy: Number(row.accuracy),
                completionRate: Number(row.completion_rate),
                totalQuestions: row.total_questions,
                answeredQuestions: row.answered_questions,
                unansweredQuestions: row.unanswered_questions,
                evaluatedQuestions: row.evaluated_questions,
                correctAnswers: row.correct_answers,
                incorrectAnswers: row.incorrect_answers,
                durationSeconds: row.duration_seconds,
              },
              questionTypes: typeof row.type_breakdown === 'string' ? JSON.parse(row.type_breakdown) : row.type_breakdown,
              subtopics: typeof row.subtopic_breakdown === 'string' ? JSON.parse(row.subtopic_breakdown) : row.subtopic_breakdown,
              skills: typeof row.skill_breakdown === 'string' ? JSON.parse(row.skill_breakdown) : row.skill_breakdown,
              cognitiveLevels: typeof row.cognitive_breakdown === 'string' ? JSON.parse(row.cognitive_breakdown) : row.cognitive_breakdown,
              difficultyRanges: typeof row.difficulty_breakdown === 'string' ? JSON.parse(row.difficulty_breakdown) : row.difficulty_breakdown,
              strengths: row.strengths,
              weaknesses: row.weaknesses,
              evaluatedResponses: [],
              createdAt: new Date(row.created_at).toISOString(),
            };
          }
        } catch (dbErr) {
          previousAnalysis = mockAnalysesStore.get(previousAttemptId);
        }
      } else {
        previousAnalysis = mockAnalysesStore.get(previousAttemptId);
      }
    } else {
      // If no specific previousAttemptId is provided, check if there is an existing analysis for this topic
      for (const analysis of mockAnalysesStore.values()) {
        previousAnalysis = analysis;
      }
    }

    // 3. Build Target Assessment Profile & Explanation Reasoning
    const reasoning: string[] = [];

    // A. Determine Difficulty
    let targetDifficulty = typeof params.targetDifficulty === 'number' ? params.targetDifficulty : 0.50;
    if (previousAnalysis) {
      const diffResult = this.calculateNextDifficulty(
        attemptDifficulty,
        previousAnalysis.overall.accuracy
      );
      targetDifficulty = diffResult.nextDifficulty;
      reasoning.push(diffResult.reasoning);
    } else {
      reasoning.push('Cold-start diagnostic assessment: baseline difficulty set to 0.50.');
    }

    // B. Determine Skill Targets
    let skillTargets: Record<string, number> = {};
    if (skillProfiles.length > 0) {
      let progressSummaries: import('../types/progress').SkillProgressSummary[] | undefined = undefined;
      try {
        const topicProgress = await ProgressAnalysisService.getTopicProgress(topicId);
        progressSummaries = topicProgress.skills;
      } catch (e) {
        // Fallback
      }

      const skillRes = this.calculateSkillPriorities(skillProfiles, progressSummaries);
      skillTargets = skillRes.skillTargets;
      reasoning.push(...skillRes.reasoning);
    } else {
      reasoning.push('Broad diagnostic skill distribution applied for initial assessment.');
    }

    // C. Determine Question Type Targets
    const typeRes = this.calculateQuestionTypeTargets(previousAnalysis);
    const questionTypeTargets = typeRes.targets;
    reasoning.push(...typeRes.reasoning);

    // D. Determine Cognitive Targets
    const cogRes = this.calculateCognitiveTargets(previousAnalysis);
    const cognitiveTargets = cogRes.targets;
    reasoning.push(...cogRes.reasoning);

    const adaptiveProfile: TargetAssessmentProfile = {
      targetDifficulty,
      skillTargets,
      questionTypeTargets,
      cognitiveTargets,
      questionCount,
    };

    // 4. Pass Target Profile to Genetic Algorithm Optimizer
    const candidateQuestions = Array.isArray(questions) && questions.length > 0
      ? questions
      : (QuestionGeneratorService.mockCandidateQuestions.get(String(topicId))
         || QuestionGeneratorService.mockCandidateQuestions.get('default')
         || Array.from(QuestionGeneratorService.mockCandidateQuestions.values()).flat());

    const optimizationRes = await AssessmentService.optimizeAssessment({
      topicId,
      targetQuestionCount: questionCount,
      targetDifficulty,
      skillTargets,
      questionTypeTargets,
      cognitiveTargets,
      questions: candidateQuestions.length > 0 ? candidateQuestions : undefined,
    });

    const generatedAssessmentId = optimizationRes.assessmentId || 1;

    // 5. Persist Adaptive Run Record
    let runId: number | undefined = undefined;
    if (isDatabaseAvailable()) {
      try {
        const runRes = await pool.query(
          `INSERT INTO adaptive_assessment_runs (
             topic_id, previous_attempt_id, generated_assessment_id, target_difficulty,
             skill_targets, question_type_targets, cognitive_targets, reasoning
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, created_at;`,
          [
            topicId,
            previousAttemptId || null,
            generatedAssessmentId,
            targetDifficulty,
            JSON.stringify(skillTargets),
            JSON.stringify(questionTypeTargets),
            JSON.stringify(cognitiveTargets),
            JSON.stringify(reasoning),
          ]
        );
        if (runRes.rows.length > 0) {
          runId = runRes.rows[0].id;
        }
      } catch (dbErr) {
        // In-memory fallback
        runId = mockRunIdCounter++;
        mockAdaptiveRunsStore.set(runId, {
          id: runId,
          topicId,
          previousAttemptId: previousAttemptId || null,
          generatedAssessmentId,
          targetDifficulty,
          skillTargets,
          questionTypeTargets,
          cognitiveTargets,
          reasoning,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      // In-memory fallback
      runId = mockRunIdCounter++;
      mockAdaptiveRunsStore.set(runId, {
        id: runId,
        topicId,
        previousAttemptId: previousAttemptId || null,
        generatedAssessmentId,
        targetDifficulty,
        skillTargets,
        questionTypeTargets,
        cognitiveTargets,
        reasoning,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      status: 'success',
      assessmentId: generatedAssessmentId,
      runId,
      adaptiveProfile,
      reasoning,
      assessment: {
        questionCount: optimizationRes.questionCount,
        fitness: optimizationRes.fitness,
        averageDifficulty: optimizationRes.averageDifficulty,
        generationCount: optimizationRes.generationCount,
        subtopicsCovered: optimizationRes.subtopicsCovered,
        typesCovered: optimizationRes.typesCovered,
        cognitiveLevelsCovered: optimizationRes.cognitiveLevelsCovered,
        estimatedTotalTimeSeconds: optimizationRes.estimatedTotalTimeSeconds,
      },
    };
  }
}
