import { Question, QuestionType, CognitiveLevel } from '../types/question';
import { matchMCQAnswer } from '../utils/answerMatcher';
import {
  EvaluationStatus,
  QuestionEvaluationResult,
  OverallMetrics,
  TypeBreakdownItem,
  SubtopicBreakdownItem,
  SkillAnalysisItem,
  CognitiveBreakdownItem,
  DifficultyBreakdownItem,
  PerformanceAnalysisResult,
} from '../types/analysis';

export interface IAnswerEvaluator {
  evaluate(question: Question, answer: string | null): QuestionEvaluationResult;
}

/**
 * Deterministic answer evaluator for Trial 9.
 * Strictly evaluates MCQs, marks free-form questions as not_auto_evaluable,
 * and handles unanswered questions.
 */
export class DeterministicAnswerEvaluator implements IAnswerEvaluator {
  public evaluate(question: Question, answer: string | null): QuestionEvaluationResult {
    const isUnanswered = answer === null || answer === undefined || answer.trim() === '';
    const qText = question.question || (question as any).text || '';
    const expAns = question.correctAnswer || (question as any).expectedAnswer || '';

    if (isUnanswered) {
      return {
        questionId: question.id!,
        questionText: qText,
        answer: null,
        expectedAnswer: expAns,
        evaluationStatus: 'unanswered',
        score: 0.0,
        subtopic: question.subtopic,
        skills: Array.isArray(question.skills) ? question.skills : [question.subtopic],
        cognitiveLevel: question.cognitiveLevel,
        questionType: question.type,
        difficulty: question.difficulty,
      };
    }

    const trimmedAnswer = answer.trim();

    if (question.type === 'MCQ') {
      const isCorrect = matchMCQAnswer(trimmedAnswer, question.correctAnswer, question.options);

      return {
        questionId: question.id!,
        questionText: qText,
        answer: trimmedAnswer,
        expectedAnswer: expAns,
        evaluationStatus: isCorrect ? 'correct' : 'incorrect',
        score: isCorrect ? 1.0 : 0.0,
        subtopic: question.subtopic,
        skills: Array.isArray(question.skills) ? question.skills : [question.subtopic],
        cognitiveLevel: question.cognitiveLevel,
        questionType: question.type,
        difficulty: question.difficulty,
      };
    }

    // For non-MCQ free text: do not fabricate correctness
    return {
      questionId: question.id!,
      questionText: qText,
      answer: trimmedAnswer,
      expectedAnswer: expAns,
      evaluationStatus: 'not_auto_evaluable',
      score: null,
      subtopic: question.subtopic,
      skills: Array.isArray(question.skills) ? question.skills : [question.subtopic],
      cognitiveLevel: question.cognitiveLevel,
      questionType: question.type,
      difficulty: question.difficulty,
    };
  }
}

export interface EngineConfig {
  evidenceTarget?: number;               // Evidence count needed for 1.0 confidence (default: 5)
  minEvidenceForClassification?: number; // Minimum evaluated questions to declare strong/weak (default: 2)
  strengthAccuracyThreshold?: number;    // Accuracy threshold for strength (default: 0.80)
  weaknessAccuracyThreshold?: number;    // Accuracy threshold below which is weakness (default: 0.60)
}

export class PerformanceAnalysisEngine {
  private config: Required<EngineConfig>;
  private evaluator: IAnswerEvaluator;

  constructor(evaluator: IAnswerEvaluator = new DeterministicAnswerEvaluator(), config: EngineConfig = {}) {
    this.evaluator = evaluator;
    this.config = {
      evidenceTarget: config.evidenceTarget ?? 5,
      minEvidenceForClassification: config.minEvidenceForClassification ?? 2,
      strengthAccuracyThreshold: config.strengthAccuracyThreshold ?? 0.8,
      weaknessAccuracyThreshold: config.weaknessAccuracyThreshold ?? 0.6,
    };
  }

  /**
   * Evaluates an array of questions and their respective submitted student answers.
   */
  public evaluateResponses(
    questions: (Question & { order?: number })[],
    responsesMap: Map<string, string | null>
  ): QuestionEvaluationResult[] {
    return questions.map((q) => {
      const ans = responsesMap.get(String(q.id)) ?? null;
      const res = this.evaluator.evaluate(q, ans);
      res.order = q.order;
      return res;
    });
  }

  /**
   * Analyzes evaluated responses into multidimensional metrics.
   */
  public analyze(
    attemptId: number,
    evaluations: QuestionEvaluationResult[],
    durationSeconds = 0,
    topicId?: number,
    topicName?: string
  ): PerformanceAnalysisResult {
    const totalQuestions = evaluations.length;
    let answeredQuestions = 0;
    let unansweredQuestions = 0;
    let evaluatedQuestions = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let scoreSum = 0;

    for (const item of evaluations) {
      if (item.evaluationStatus === 'unanswered') {
        unansweredQuestions++;
      } else if (item.evaluationStatus === 'evaluator_error' || item.evaluationStatus === 'not_evaluable' || item.evaluationStatus === 'not_auto_evaluable') {
        answeredQuestions++;
        // Do NOT treat evaluator_error or not_evaluable as incorrect, do NOT increment evaluatedQuestions
      } else {
        answeredQuestions++;
        evaluatedQuestions++;
        const itemScore = item.score !== null ? item.score : (item.evaluationStatus === 'correct' ? 1.0 : 0.0);
        scoreSum += itemScore;

        const isCorrectResult =
          itemScore >= 0.60 ||
          item.evaluationStatus === 'correct' ||
          (item.evaluationDetails &&
            (item.evaluationDetails.correctness === 'correct' ||
              item.evaluationDetails.correctness === 'mostly_correct'));

        if (isCorrectResult) {
          correctAnswers++;
        } else {
          incorrectAnswers++;
        }
      }
    }

    const accuracy = evaluatedQuestions > 0 ? Number((scoreSum / evaluatedQuestions).toFixed(3)) : 0;
    const completionRate = totalQuestions > 0 ? Number((answeredQuestions / totalQuestions).toFixed(3)) : 0;

    const overall: OverallMetrics = {
      accuracy,
      completionRate,
      totalQuestions,
      answeredQuestions,
      unansweredQuestions,
      evaluatedQuestions,
      correctAnswers,
      incorrectAnswers,
      durationSeconds: Math.max(0, durationSeconds),
    };

    // Helper for evaluation check
    const isItemEvaluated = (status: EvaluationStatus, score: number | null): boolean => {
      if (status === 'unanswered' || status === 'evaluator_error' || status === 'not_evaluable' || status === 'not_auto_evaluable') {
        return false;
      }
      return true;
    };

    const getItemScore = (status: EvaluationStatus, score: number | null): number => {
      if (score !== null) return score;
      return status === 'correct' ? 1.0 : 0.0;
    };

    // 1. Question Type Breakdown
    const questionTypes: Record<string, TypeBreakdownItem & { scoreSum?: number }> = {};
    for (const item of evaluations) {
      const t = item.questionType;
      if (!questionTypes[t]) {
        questionTypes[t] = { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 };
      }
      questionTypes[t].total++;
      if (isItemEvaluated(item.evaluationStatus, item.score)) {
        const itemScore = getItemScore(item.evaluationStatus, item.score);
        questionTypes[t].evaluated++;
        questionTypes[t].scoreSum! += itemScore;
        if (itemScore >= 0.60 || item.evaluationStatus === 'correct') questionTypes[t].correct++;
      }
    }
    for (const t of Object.keys(questionTypes)) {
      const item = questionTypes[t];
      item.accuracy = item.evaluated > 0 ? Number(((item.scoreSum ?? item.correct) / item.evaluated).toFixed(3)) : null;
      delete item.scoreSum;
    }

    // 2. Subtopic Breakdown
    const subtopics: Record<string, SubtopicBreakdownItem & { scoreSum?: number }> = {};
    for (const item of evaluations) {
      const s = item.subtopic;
      if (!subtopics[s]) {
        subtopics[s] = { total: 0, evaluated: 0, correct: 0, accuracy: null, evidence: 0, scoreSum: 0 };
      }
      subtopics[s].total++;
      if (isItemEvaluated(item.evaluationStatus, item.score)) {
        const itemScore = getItemScore(item.evaluationStatus, item.score);
        subtopics[s].evaluated++;
        subtopics[s].evidence++;
        subtopics[s].scoreSum! += itemScore;
        if (itemScore >= 0.60 || item.evaluationStatus === 'correct') subtopics[s].correct++;
      }
    }
    for (const s of Object.keys(subtopics)) {
      const item = subtopics[s];
      item.accuracy = item.evaluated > 0 ? Number(((item.scoreSum ?? item.correct) / item.evaluated).toFixed(3)) : null;
      delete item.scoreSum;
    }

    // 3. Skill Breakdown
    const skillsAccumulator: Record<
      string,
      { total: number; evaluated: number; correctCount: number; scoreSum: number }
    > = {};

    for (const item of evaluations) {
      const isEval = isItemEvaluated(item.evaluationStatus, item.score);
      const itemScore = getItemScore(item.evaluationStatus, item.score);

      // Check if item has specific skillEvidence from LLM evaluation
      const skillEvidence = item.evaluationDetails?.skillEvidence;

      if (skillEvidence && skillEvidence.length > 0) {
        for (const se of skillEvidence) {
          if (!skillsAccumulator[se.skill]) {
            skillsAccumulator[se.skill] = { total: 0, evaluated: 0, correctCount: 0, scoreSum: 0 };
          }
          skillsAccumulator[se.skill].total++;
          if (isEval) {
            skillsAccumulator[se.skill].evaluated++;
            skillsAccumulator[se.skill].scoreSum += se.score;
            if (se.score >= 0.70) skillsAccumulator[se.skill].correctCount++;
          }
        }
      } else {
        const itemSkills = Array.isArray(item.skills) && item.skills.length > 0
          ? item.skills
          : [item.subtopic];

        for (const skillName of itemSkills) {
          if (!skillsAccumulator[skillName]) {
            skillsAccumulator[skillName] = { total: 0, evaluated: 0, correctCount: 0, scoreSum: 0 };
          }
          skillsAccumulator[skillName].total++;
          if (isEval) {
            skillsAccumulator[skillName].evaluated++;
            skillsAccumulator[skillName].scoreSum += itemScore;
            if (itemScore >= 0.70 || item.evaluationStatus === 'correct') {
              skillsAccumulator[skillName].correctCount++;
            }
          }
        }
      }
    }

    const skills: Record<string, SkillAnalysisItem> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const [skillName, data] of Object.entries(skillsAccumulator)) {
      const score = data.evaluated > 0 ? Number((data.scoreSum / data.evaluated).toFixed(3)) : 0;
      const confidence = Math.min(1.0, Number((data.evaluated / this.config.evidenceTarget).toFixed(3)));

      let status: SkillAnalysisItem['status'] = 'insufficient_evidence';
      if (data.evaluated < this.config.minEvidenceForClassification) {
        status = 'insufficient_evidence';
      } else if (score >= this.config.strengthAccuracyThreshold) {
        status = 'strong';
        strengths.push(skillName);
      } else if (score >= this.config.weaknessAccuracyThreshold) {
        status = 'developing';
      } else {
        status = 'weak';
        weaknesses.push(skillName);
      }

      skills[skillName] = {
        skill: skillName,
        score,
        confidence,
        status,
        evidence: data.evaluated,
        correctCount: data.correctCount,
      };
    }

    // 4. Cognitive Level Breakdown
    const cognitiveLevels: Record<string, CognitiveBreakdownItem & { scoreSum?: number }> = {
      remember: { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
      understand: { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
      apply: { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
      analyze: { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
    };

    for (const item of evaluations) {
      const lvl = item.cognitiveLevel;
      if (cognitiveLevels[lvl]) {
        cognitiveLevels[lvl].total++;
        if (isItemEvaluated(item.evaluationStatus, item.score)) {
          const itemScore = getItemScore(item.evaluationStatus, item.score);
          cognitiveLevels[lvl].evaluated++;
          cognitiveLevels[lvl].scoreSum! += itemScore;
          if (itemScore >= 0.70 || item.evaluationStatus === 'correct') cognitiveLevels[lvl].correct++;
        }
      }
    }
    for (const lvl of Object.keys(cognitiveLevels)) {
      const item = cognitiveLevels[lvl];
      item.accuracy = item.evaluated > 0 ? Number(((item.scoreSum ?? item.correct) / item.evaluated).toFixed(3)) : null;
      delete item.scoreSum;
    }

    // 5. Difficulty Range Breakdown
    const difficultyRanges: Record<string, DifficultyBreakdownItem & { scoreSum?: number }> = {
      'Easy (0.00 - 0.33)': { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
      'Medium (0.34 - 0.66)': { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
      'Hard (0.67 - 1.00)': { total: 0, evaluated: 0, correct: 0, accuracy: null, scoreSum: 0 },
    };

    for (const item of evaluations) {
      let bucket = 'Medium (0.34 - 0.66)';
      if (item.difficulty <= 0.33) bucket = 'Easy (0.00 - 0.33)';
      else if (item.difficulty >= 0.67) bucket = 'Hard (0.67 - 1.00)';

      difficultyRanges[bucket].total++;
      if (isItemEvaluated(item.evaluationStatus, item.score)) {
        const itemScore = getItemScore(item.evaluationStatus, item.score);
        difficultyRanges[bucket].evaluated++;
        difficultyRanges[bucket].scoreSum! += itemScore;
        if (itemScore >= 0.70 || item.evaluationStatus === 'correct') difficultyRanges[bucket].correct++;
      }
    }
    for (const bucket of Object.keys(difficultyRanges)) {
      const item = difficultyRanges[bucket];
      item.accuracy = item.evaluated > 0 ? Number(((item.scoreSum ?? item.correct) / item.evaluated).toFixed(3)) : null;
      delete item.scoreSum;
    }

    return {
      status: 'success',
      attemptId,
      topicId,
      topicName,
      overall,
      questionTypes,
      subtopics,
      skills,
      cognitiveLevels,
      difficultyRanges,
      strengths,
      weaknesses,
      evaluatedResponses: evaluations,
      createdAt: new Date().toISOString(),
    };
  }
}
