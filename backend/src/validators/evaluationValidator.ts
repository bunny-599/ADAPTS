import {
  AnswerEvaluationResult,
  EvaluationStatusType,
  CorrectnessType,
  SkillEvidenceItem,
} from '../types/evaluation';
import { EVALUATOR_VERSION, PROMPT_VERSION } from '../services/evaluator/evaluationPrompts';

export interface ValidationResult {
  isValid: boolean;
  result: AnswerEvaluationResult;
  errors?: string[];
}

const ALLOWED_EVALUATION_STATUSES: EvaluationStatusType[] = [
  'evaluated',
  'not_evaluable',
  'evaluator_error',
];

const ALLOWED_CORRECTNESS_VALUES: CorrectnessType[] = [
  'correct',
  'mostly_correct',
  'partially_correct',
  'incorrect',
  'not_evaluable',
  'evaluator_error',
];

export class EvaluationValidator {
  /**
   * Validates and sanitizes raw LLM evaluation output.
   * If invalid, creates an 'evaluator_error' result to protect student score.
   */
  public static validate(
    raw: unknown,
    allowedSkills: string[],
    modelName: string = 'gemini'
  ): ValidationResult {
    const errors: string[] = [];

    if (!raw || typeof raw !== 'object') {
      return {
        isValid: false,
        errors: ['Raw evaluation output is not an object or is empty.'],
        result: this.createErrorResult(
          'Evaluation response was empty or not a valid JSON object.',
          modelName
        ),
      };
    }

    const data = raw as Record<string, any>;

    // 1. Validate evaluationStatus
    let evaluationStatus: EvaluationStatusType = data.evaluationStatus;
    if (!ALLOWED_EVALUATION_STATUSES.includes(evaluationStatus)) {
      errors.push(`Invalid or missing evaluationStatus: "${data.evaluationStatus}".`);
      evaluationStatus = 'evaluator_error';
    }

    // 2. Validate correctness
    let correctness: CorrectnessType = data.correctness;
    if (!ALLOWED_CORRECTNESS_VALUES.includes(correctness)) {
      errors.push(`Invalid or missing correctness value: "${data.correctness}".`);
      correctness = 'evaluator_error';
    }

    // 3. Validate score
    let score: number | null = null;
    if (evaluationStatus === 'evaluated') {
      if (typeof data.score !== 'number' || isNaN(data.score) || !isFinite(data.score)) {
        errors.push(`Score must be a finite number; got ${typeof data.score}.`);
      } else if (data.score < 0.0 || data.score > 1.0) {
        errors.push(`Score ${data.score} is outside required bounds [0.0, 1.0].`);
      } else {
        score = Number(data.score.toFixed(3));
      }
    }

    // 4. Validate confidence
    let confidence = 0.85;
    if (typeof data.confidence === 'number' && !isNaN(data.confidence) && isFinite(data.confidence)) {
      confidence = Math.max(0.0, Math.min(1.0, Number(data.confidence.toFixed(3))));
    } else {
      errors.push(`Confidence is not a valid number; defaulted to 0.85.`);
    }

    // If critical validation errors occurred on an evaluated result, degrade safely to evaluator_error
    if (errors.length > 0 && evaluationStatus === 'evaluated' && score === null) {
      return {
        isValid: false,
        errors,
        result: this.createErrorResult(
          `Evaluator output failed schema validation: ${errors.join(' ')}`,
          modelName
        ),
      };
    }

    // 5. Sanitize strengths & missingConcepts
    const strengths: string[] = Array.isArray(data.strengths)
      ? data.strengths.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      : [];

    const missingConcepts: string[] = Array.isArray(data.missingConcepts)
      ? data.missingConcepts.filter((m: any) => typeof m === 'string' && m.trim().length > 0)
      : [];

    const reasoning = typeof data.reasoning === 'string' && data.reasoning.trim().length > 0
      ? data.reasoning.trim()
      : 'Evaluation completed.';

    // 6. Filter skillEvidence against allowedSkills
    const sanitizedSkillEvidence: SkillEvidenceItem[] = [];
    const normalizedAllowed = new Map(allowedSkills.map((s) => [s.toLowerCase().trim(), s]));

    if (Array.isArray(data.skillEvidence)) {
      for (const item of data.skillEvidence) {
        if (!item || typeof item !== 'object') continue;
        const rawSkill = typeof item.skill === 'string' ? item.skill.trim() : '';
        const canonicalSkill = normalizedAllowed.get(rawSkill.toLowerCase());

        if (canonicalSkill) {
          const itemScore = typeof item.score === 'number' && isFinite(item.score)
            ? Math.max(0.0, Math.min(1.0, Number(item.score.toFixed(3))))
            : (score ?? 0.5);

          sanitizedSkillEvidence.push({
            skill: canonicalSkill,
            score: itemScore,
          });
        } else {
          // Unknown or hallucinated skill returned by LLM: safely ignored to protect skill profile
          console.warn(`[EvaluationValidator] Ignored unknown LLM-generated skill: "${rawSkill}".`);
        }
      }
    }

    // If no skill evidence survived filter, fallback to allocating the question score to known allowed skills
    if (sanitizedSkillEvidence.length === 0 && score !== null && allowedSkills.length > 0) {
      for (const skill of allowedSkills) {
        sanitizedSkillEvidence.push({
          skill,
          score,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      result: {
        evaluationStatus,
        score,
        correctness,
        reasoning,
        strengths,
        missingConcepts,
        skillEvidence: sanitizedSkillEvidence,
        confidence,
        evaluatorType: 'llm',
        modelName,
        evaluatorVersion: EVALUATOR_VERSION,
        promptVersion: PROMPT_VERSION,
      },
    };
  }

  /**
   * Helper to construct safe evaluator_error result that prevents penalizing the student.
   */
  public static createErrorResult(
    reason: string,
    modelName: string = 'gemini',
    status: EvaluationStatusType = 'evaluator_error'
  ): AnswerEvaluationResult {
    return {
      evaluationStatus: status,
      score: null,
      correctness: status === 'not_evaluable' ? 'not_evaluable' : 'evaluator_error',
      reasoning: reason,
      strengths: [],
      missingConcepts: [],
      skillEvidence: [],
      confidence: 0.0,
      evaluatorType: 'llm',
      modelName,
      evaluatorVersion: EVALUATOR_VERSION,
      promptVersion: PROMPT_VERSION,
    };
  }
}
