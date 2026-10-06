import { Question } from '../types/question';
import {
  ValidatedQuestionResult,
  ValidationStatus,
  ValidationIssue,
  QuestionValidationSummary,
  QuestionAnswerConsistencyResult,
} from '../types/validation';
import { CodingQuestionValidator } from '../validators/codingQuestionValidator';
import { SemanticConsistencyValidator } from '../validators/semanticConsistencyValidator';
import { ILLMProvider } from './llm/llmProvider';
import { pool, isDatabaseAvailable } from '../db';
import { QuestionGeneratorService } from './questionGeneratorService';

export interface ValidationContext {
  validKnowledgeUrls?: Set<string>;
  knownSubtopics?: Set<string>;
  knowledge?: any[];
  llmProvider?: ILLMProvider;
}

export class QuestionValidationEngine {
  /**
   * Evaluates a pool of candidate questions against multiple quality dimensions:
   * 1. Structural validity
   * 2. Ambiguity & clarity
   * 3. Distractor plausibility & distinctness
   * 4. Source grounding verification
   * 5. Explanation consistency
   * 6. Duplicate & near-duplicate detection
   */
  public validatePool(
    questions: Question[],
    context: ValidationContext = {}
  ): {
    summary: QuestionValidationSummary;
    validQuestions: ValidatedQuestionResult[];
    flaggedQuestions: ValidatedQuestionResult[];
    invalidQuestions: ValidatedQuestionResult[];
  } {
    const validQuestions: ValidatedQuestionResult[] = [];
    const flaggedQuestions: ValidatedQuestionResult[] = [];
    const invalidQuestions: ValidatedQuestionResult[] = [];

    const seenQuestionTexts = new Map<string, number>();

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      const result = this.validateSingleQuestion(q, index, seenQuestionTexts, context);

      if (result.status === 'VALID') {
        validQuestions.push(result);
      } else if (result.status === 'FLAGGED') {
        flaggedQuestions.push(result);
      } else {
        invalidQuestions.push(result);
      }
    }

    const totalAnalyzed = questions.length;
    const allResults = [...validQuestions, ...flaggedQuestions, ...invalidQuestions];
    const totalScore = allResults.reduce((acc, r) => acc + r.qualityScore, 0);
    const averageQualityScore =
      totalAnalyzed > 0 ? Number((totalScore / totalAnalyzed).toFixed(3)) : 0;

    const summary: QuestionValidationSummary = {
      totalAnalyzed,
      validCount: validQuestions.length,
      flaggedCount: flaggedQuestions.length,
      invalidCount: invalidQuestions.length,
      averageQualityScore,
    };

    return {
      summary,
      validQuestions,
      flaggedQuestions,
      invalidQuestions,
    };
  }

  /**
   * Validates a single question across all criteria.
   */
  public validateSingleQuestion(
    q: Question,
    index: number,
    seenQuestionTexts: Map<string, number>,
    context: ValidationContext
  ): ValidatedQuestionResult {
    const issues: ValidationIssue[] = [];

    let structuralScore = 1.0;
    let clarityScore = 1.0;
    let groundingScore = 1.0;
    let distractorScore = 1.0;

    // 1. Structure & Difficulty Checks
    if (!q.question || q.question.trim().length === 0) {
      issues.push({
        code: 'MISSING_QUESTION_TEXT',
        severity: 'ERROR',
        message: 'Question text is empty.',
      });
      structuralScore -= 0.5;
    }

    if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
      issues.push({
        code: 'MISSING_CORRECT_ANSWER',
        severity: 'ERROR',
        message: 'Question is missing correct answer.',
      });
      structuralScore -= 0.5;
    }

    if (typeof q.difficulty !== 'number' || isNaN(q.difficulty) || q.difficulty < 0.0 || q.difficulty > 1.0) {
      issues.push({
        code: 'INVALID_DIFFICULTY',
        severity: 'ERROR',
        message: `Difficulty ${q.difficulty} is not within [0.0, 1.0].`,
      });
      structuralScore -= 0.3;
    }

    // 2. MCQ Specific Checks: Option count, distinctness, and exact match
    if (q.type === 'MCQ') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        issues.push({
          code: 'INVALID_MCQ_OPTIONS_COUNT',
          severity: 'ERROR',
          message: `MCQ has ${q.options?.length || 0} options; exactly 4 required.`,
        });
        distractorScore -= 0.5;
      } else {
        const trimmedOptions = q.options.map((o) => o.trim());
        const lowerOptions = trimmedOptions.map((o) => o.toLowerCase());

        // Check for duplicate options among distractors
        const uniqueSet = new Set(lowerOptions);
        if (uniqueSet.size < 4) {
          issues.push({
            code: 'DUPLICATE_OPTIONS',
            severity: 'ERROR',
            message: 'MCQ contains duplicate options.',
          });
          distractorScore -= 0.4;
        }

        // Check if correctAnswer matches one option exactly
        const matchingIndex = lowerOptions.indexOf(q.correctAnswer.trim().toLowerCase());
        if (matchingIndex === -1) {
          issues.push({
            code: 'CORRECT_ANSWER_NOT_IN_OPTIONS',
            severity: 'ERROR',
            message: `Correct answer "${q.correctAnswer}" does not match any of the 4 options.`,
          });
          distractorScore -= 0.5;
        }

        // Check for trivial/lazy distractors (e.g. "None of the above", "All of the above", or single-word non-answers)
        const hasTrivialOptions = lowerOptions.some(
          (opt) => opt === 'none of the above' || opt === 'all of the above' || opt === 'n/a'
        );
        if (hasTrivialOptions) {
          issues.push({
            code: 'TRIVIAL_DISTRACTOR',
            severity: 'WARNING',
            message: 'Option contains generic/trivial distractor ("All/None of the above").',
          });
          distractorScore -= 0.2;
        }
      }
    }

    // 2b. CODING Specific Checks using CodingQuestionValidator
    if (q.type === 'CODING') {
      const codingValidation = CodingQuestionValidator.validate(q as any);
      for (const err of codingValidation.errors) {
        issues.push({
          code: 'CODING_VALIDATION_ERROR',
          severity: 'ERROR',
          message: err,
        });
        structuralScore -= 0.3;
      }
      for (const warn of codingValidation.warnings) {
        issues.push({
          code: 'CODING_VALIDATION_WARNING',
          severity: 'WARNING',
          message: warn,
        });
        structuralScore -= 0.1;
      }
    }

    // 3. Ambiguity & Clarity Checks
    const normalizedText = q.question
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalizedText.length < 15) {
      issues.push({
        code: 'QUESTION_TOO_BRIEF',
        severity: 'WARNING',
        message: 'Question text is unusually brief or terse.',
      });
      clarityScore -= 0.2;
    }

    // Ambiguity indicator check
    if (
      normalizedText.includes('which of the following is true or false') ||
      normalizedText.includes('might or might not') ||
      normalizedText.endsWith('why?') ||
      normalizedText.endsWith('how?')
    ) {
      issues.push({
        code: 'AMBIGUOUS_QUESTION_PHRASING',
        severity: 'WARNING',
        message: 'Question phrasing may be ambiguous or open-ended.',
      });
      clarityScore -= 0.25;
    }

    // Duplicate detection in batch
    if (seenQuestionTexts.has(normalizedText)) {
      issues.push({
        code: 'DUPLICATE_QUESTION',
        severity: 'ERROR',
        message: `Duplicate of question #${seenQuestionTexts.get(normalizedText)! + 1} in this pool.`,
      });
      clarityScore -= 0.5;
    } else {
      seenQuestionTexts.set(normalizedText, index);
    }

    // 4. Source Grounding & Subtopic Checks
    if (!Array.isArray(q.sourceReferences) || q.sourceReferences.length === 0) {
      issues.push({
        code: 'MISSING_SOURCE_REFERENCE',
        severity: 'ERROR',
        message: 'Question lacks source references grounding it to research knowledge.',
      });
      groundingScore -= 0.5;
    } else if (context.validKnowledgeUrls && context.validKnowledgeUrls.size > 0) {
      const hasValidRef = q.sourceReferences.some(
        (ref) => context.validKnowledgeUrls!.has(ref.trim()) || context.validKnowledgeUrls!.has(ref.trim().replace(/\/$/, ''))
      );
      if (!hasValidRef) {
        issues.push({
          code: 'UNVERIFIED_SOURCE_REFERENCE',
          severity: 'WARNING',
          message: 'Source reference does not match any URL from the research session.',
        });
        groundingScore -= 0.25;
      }
    }

    // Subtopic assignment check
    if (!q.subtopic || q.subtopic.trim().length === 0) {
      issues.push({
        code: 'MISSING_SUBTOPIC',
        severity: 'WARNING',
        message: 'Question is missing a designated subtopic.',
      });
      groundingScore -= 0.2;
    } else if (context.knownSubtopics && context.knownSubtopics.size > 0) {
      const matched = Array.from(context.knownSubtopics).some((s) =>
        s.toLowerCase().includes(q.subtopic.toLowerCase()) || q.subtopic.toLowerCase().includes(s.toLowerCase())
      );
      if (!matched) {
        issues.push({
          code: 'POOR_SUBTOPIC_ALIGNMENT',
          severity: 'WARNING',
          message: `Subtopic "${q.subtopic}" does not match recognized topic subtopics.`,
        });
        groundingScore -= 0.15;
      }
    }

    // 5. Explanation Consistency
    if (!q.explanation || q.explanation.trim().length === 0) {
      issues.push({
        code: 'MISSING_EXPLANATION',
        severity: 'WARNING',
        message: 'Question is missing an explanatory rationale.',
      });
      clarityScore -= 0.15;
    } else {
      // If explanation explicitly negates or contradicts the correct answer
      const lowerExplanation = q.explanation.toLowerCase();
      const lowerAnswer = q.correctAnswer.toLowerCase();
      if (
        (lowerExplanation.includes('is incorrect') && lowerExplanation.includes(lowerAnswer)) ||
        (lowerExplanation.includes('not true') && lowerExplanation.includes(lowerAnswer))
      ) {
        issues.push({
          code: 'EXPLANATION_CONTRADICTS_ANSWER',
          severity: 'ERROR',
          message: 'Explanation appears to contradict or negate the correct answer.',
        });
        clarityScore -= 0.4;
      }
    }

    // 6. Question-Answer Semantic Consistency Check
    const consistencyResult: QuestionAnswerConsistencyResult = SemanticConsistencyValidator.validateConsistency(q, context);
    let consistencyScore = consistencyResult.questionAnswerConsistency ? 1.0 : 0.0;

    if (!consistencyResult.questionAnswerConsistency) {
      issues.push({
        code: 'QUESTION_ANSWER_INCONSISTENCY',
        severity: 'ERROR',
        message: consistencyResult.reason || 'Proposed correct answer is conceptually or factually inconsistent with the question.',
      });
      structuralScore -= 0.6;
    }

    // Calculate clamped dimension scores
    structuralScore = Math.max(0.0, Math.min(1.0, structuralScore));
    clarityScore = Math.max(0.0, Math.min(1.0, clarityScore));
    groundingScore = Math.max(0.0, Math.min(1.0, groundingScore));
    distractorScore = Math.max(0.0, Math.min(1.0, distractorScore));

    // Overall quality score weighted combination
    const qualityScore = consistencyScore === 0.0 ? 0.0 : Number(
      (
        structuralScore * 0.30 +
        distractorScore * 0.20 +
        clarityScore * 0.15 +
        groundingScore * 0.15 +
        consistencyScore * 0.20
      ).toFixed(3)
    );

    // Determine status
    let status: ValidationStatus = 'VALID';
    const hasError = issues.some((i) => i.severity === 'ERROR');
    const hasWarning = issues.some((i) => i.severity === 'WARNING');

    if (hasError || qualityScore < 0.6) {
      status = 'INVALID';
    } else if (hasWarning || qualityScore < 0.85) {
      status = 'FLAGGED';
    }

    return {
      question: q,
      status,
      qualityScore,
      issues,
      questionAnswerConsistency: consistencyResult,
      metrics: {
        structuralScore: Number(structuralScore.toFixed(3)),
        clarityScore: Number(clarityScore.toFixed(3)),
        groundingScore: Number(groundingScore.toFixed(3)),
        distractorScore: Number(distractorScore.toFixed(3)),
        consistencyScore: Number(consistencyScore.toFixed(3)),
      },
    };
  }

  /**
   * Revalidates all persisted candidate questions in PostgreSQL and in-memory stores.
   * Marks inconsistent questions as INVALID so they cannot reach the Genetic Algorithm.
   */
  public async revalidatePersistedQuestions(): Promise<{
    revalidated: number;
    markedInvalid: number;
    markedValid: number;
  }> {
    let revalidated = 0;
    let markedInvalid = 0;
    let markedValid = 0;

    // 1. PostgreSQL candidate questions
    if (isDatabaseAvailable()) {
      try {
        const dbResult = await pool.query(
          `SELECT id, type, question, options, correct_answer as "correctAnswer",
                  explanation, difficulty::float, concept, subtopic, skills,
                  cognitive_level as "cognitiveLevel", source_references as "sourceReferences",
                  code_snippet as "codeSnippet", scenario_text as "scenarioText"
           FROM candidate_questions;`
        );

        for (const row of dbResult.rows) {
          const validated = this.validateSingleQuestion(row, 0, new Map(), {});
          revalidated++;
          if (validated.status === 'INVALID') {
            markedInvalid++;
          } else if (validated.status === 'VALID') {
            markedValid++;
          }

          await pool.query(
            `UPDATE candidate_questions
             SET validation_status = $1,
                 quality_score = $2,
                 validation_issues = $3
             WHERE id = $4;`,
            [validated.status, validated.qualityScore, JSON.stringify(validated.issues), row.id]
          );
        }
      } catch (err: any) {
        console.warn('[QuestionValidationEngine] Revalidation DB warning:', err.message);
      }
    }

    // 2. In-Memory candidate questions
    for (const [key, poolList] of QuestionGeneratorService.mockCandidateQuestions.entries()) {
      const updatedList = poolList.map((q) => {
        const validated = this.validateSingleQuestion(q, 0, new Map(), {});
        revalidated++;
        if (validated.status === 'INVALID') {
          markedInvalid++;
        } else if (validated.status === 'VALID') {
          markedValid++;
        }
        return {
          ...q,
          validationStatus: validated.status,
          qualityScore: validated.qualityScore,
          validationIssues: validated.issues,
        };
      });
      QuestionGeneratorService.mockCandidateQuestions.set(key, updatedList);
    }

    return { revalidated, markedInvalid, markedValid };
  }
}

export const questionValidationEngine = new QuestionValidationEngine();
