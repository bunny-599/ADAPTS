import { matchMCQAnswer } from '../../utils/answerMatcher';
import { Question, QuestionType } from '../../types/question';
import {
  AnswerEvaluationResult,
  EvaluationContext,
} from '../../types/evaluation';
import { ILLMProvider } from '../llm/llmProvider';
import { GeminiProvider } from '../llm/geminiProvider';
import { EvaluationPromptBuilder, EVALUATOR_VERSION, PROMPT_VERSION } from './evaluationPrompts';
import { EvaluationValidator } from '../../validators/evaluationValidator';

export interface IAnswerEvaluator {
  evaluate(
    question: Question,
    response: string | null,
    context?: EvaluationContext
  ): Promise<AnswerEvaluationResult>;
}

/**
 * Deterministic answer evaluator for MCQ questions.
 * Fast, 100% reliable, zero LLM token cost.
 */
export class DeterministicAnswerEvaluator implements IAnswerEvaluator {
  public async evaluate(
    question: Question,
    response: string | null,
    _context?: EvaluationContext
  ): Promise<AnswerEvaluationResult> {
    const isUnanswered = response === null || response === undefined || response.trim() === '';
    const allowedSkills = Array.isArray(question.skills) && question.skills.length > 0
      ? question.skills
      : [question.subtopic];

    if (isUnanswered) {
      return {
        evaluationStatus: 'evaluated',
        score: 0.0,
        correctness: 'incorrect',
        reasoning: 'No answer was provided for this question.',
        strengths: [],
        missingConcepts: [question.concept || question.subtopic],
        skillEvidence: allowedSkills.map((s) => ({ skill: s, score: 0.0 })),
        confidence: 1.0,
        evaluatorType: 'deterministic',
        evaluatorVersion: EVALUATOR_VERSION,
        promptVersion: 'deterministic-rule-v1',
      };
    }

    const trimmedAnswer = response.trim();

    if (question.type === 'MCQ') {
      const isCorrect = matchMCQAnswer(trimmedAnswer, question.correctAnswer, question.options);

      return {
        evaluationStatus: 'evaluated',
        score: isCorrect ? 1.0 : 0.0,
        correctness: isCorrect ? 'correct' : 'incorrect',
        reasoning: isCorrect
          ? 'Selected option matches the correct ground truth answer.'
          : `Selected option does not match the correct answer (${question.correctAnswer}).`,
        strengths: isCorrect ? [question.concept || question.subtopic] : [],
        missingConcepts: isCorrect ? [] : [question.concept || question.subtopic],
        skillEvidence: allowedSkills.map((s) => ({
          skill: s,
          score: isCorrect ? 1.0 : 0.0,
        })),
        confidence: 1.0,
        evaluatorType: 'deterministic',
        evaluatorVersion: EVALUATOR_VERSION,
        promptVersion: 'deterministic-rule-v1',
      };
    }

    // For non-MCQs passed to deterministic evaluator: return not_evaluable
    return {
      evaluationStatus: 'not_evaluable',
      score: null,
      correctness: 'not_evaluable',
      reasoning: `Question type "${question.type}" requires qualitative LLM evaluation.`,
      strengths: [],
      missingConcepts: [],
      skillEvidence: [],
      confidence: 1.0,
      evaluatorType: 'deterministic',
      evaluatorVersion: EVALUATOR_VERSION,
    };
  }
}

/**
 * LLM-powered answer evaluator for free-text question types:
 * CONCEPTUAL, OUTPUT_PREDICTION, DEBUGGING, and SCENARIO.
 * Uses research grounding, rubric guidance, and strict output validation.
 */
export class LLMAnswerEvaluator implements IAnswerEvaluator {
  private llmProvider: ILLMProvider;
  private modelName: string;

  constructor(llmProvider?: ILLMProvider, modelName?: string) {
    const selectedModel = modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    this.llmProvider = llmProvider || new GeminiProvider(undefined, selectedModel);
    this.modelName = selectedModel;
  }

  public setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  public async evaluate(
    question: Question,
    response: string | null,
    context?: EvaluationContext
  ): Promise<AnswerEvaluationResult> {
    const isUnanswered = response === null || response === undefined || response.trim() === '';
    const allowedSkills = Array.isArray(question.skills) && question.skills.length > 0
      ? question.skills
      : [question.subtopic];

    // Unanswered free-text: no need to spend LLM tokens
    if (isUnanswered) {
      return {
        evaluationStatus: 'evaluated',
        score: 0.0,
        correctness: 'incorrect',
        reasoning: 'No answer was provided for this question.',
        strengths: [],
        missingConcepts: [question.concept || question.subtopic],
        skillEvidence: allowedSkills.map((s) => ({ skill: s, score: 0.0 })),
        confidence: 1.0,
        evaluatorType: 'llm',
        modelName: this.modelName,
        evaluatorVersion: EVALUATOR_VERSION,
        promptVersion: PROMPT_VERSION,
      };
    }

    const trimmedAnswer = response.trim();

    try {
      const systemPrompt = EvaluationPromptBuilder.buildSystemPrompt();
      const userPrompt = EvaluationPromptBuilder.buildUserPrompt(question, trimmedAnswer, context);

      const rawResponse = await this.llmProvider.generateStructuredResponse(systemPrompt, userPrompt);
      const validation = EvaluationValidator.validate(rawResponse, allowedSkills, this.modelName);

      return validation.result;
    } catch (error: any) {
      console.warn(`[LLMAnswerEvaluator] Evaluation failed gracefully for question ${question.id}:`, error.message);

      // Return evaluator_error without crashing or lowering score
      return EvaluationValidator.createErrorResult(
        `Automated evaluation could not complete: ${error.message || 'Unknown LLM error'}`,
        this.modelName,
        'evaluator_error'
      );
    }
  }
}

import { CodeExecutionEvaluator } from './codeExecutionEvaluator';
import { ICodeExecutionSandbox } from '../sandbox/codeExecutionSandbox';

/**
 * Factory for selecting the optimal evaluator based on question type.
 */
export class AnswerEvaluatorFactory {
  private static deterministicInstance = new DeterministicAnswerEvaluator();
  private static defaultLLMInstance = new LLMAnswerEvaluator();

  public static getEvaluator(
    questionType: QuestionType,
    customLLMProvider?: ILLMProvider,
    customSandbox?: ICodeExecutionSandbox
  ): IAnswerEvaluator {
    if (questionType === 'MCQ') {
      return this.deterministicInstance;
    }

    if (questionType === 'CODING') {
      return new CodeExecutionEvaluator(customSandbox);
    }

    if (customLLMProvider) {
      return new LLMAnswerEvaluator(customLLMProvider);
    }

    return this.defaultLLMInstance;
  }
}

