import { Question } from '../../types/question';
import { AnswerEvaluationResult, EvaluationContext } from '../../types/evaluation';
import { IAnswerEvaluator } from './answerEvaluator';
import { CodingEvaluationService } from '../codingEvaluationService';
import { EVALUATOR_VERSION } from './evaluationPrompts';
import { ICodeExecutionSandbox } from '../sandbox/codeExecutionSandbox';

export class CodeExecutionEvaluator implements IAnswerEvaluator {
  private customSandbox?: ICodeExecutionSandbox;

  constructor(customSandbox?: ICodeExecutionSandbox) {
    this.customSandbox = customSandbox;
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

    if (isUnanswered) {
      return {
        evaluationStatus: 'evaluated',
        score: 0.0,
        correctness: 'incorrect',
        reasoning: 'No code solution was submitted for this coding question.',
        strengths: [],
        missingConcepts: [question.concept || question.subtopic],
        skillEvidence: allowedSkills.map((s) => ({ skill: s, score: 0.0 })),
        confidence: 1.0,
        evaluatorType: 'code_execution',
        evaluatorVersion: EVALUATOR_VERSION,
        promptVersion: 'deterministic-sandbox-v1',
      };
    }

    const attemptId = (context as any)?.attemptId || 1;
    const language = (question as any).language || 'cpp';

    const result = await CodingEvaluationService.evaluateSubmission(
      attemptId,
      question.id!,
      response,
      language,
      {
        customSandbox: this.customSandbox,
        forceReevaluate: (context as any)?.forceReevaluate,
      }
    );

    // If sandbox infrastructure error: mark as evaluator_error so student is not penalized
    if (result.evaluationStatus === 'sandbox_error') {
      return {
        evaluationStatus: 'evaluator_error',
        score: null,
        correctness: 'evaluator_error',
        reasoning: `Code execution sandbox unavailable: ${result.message || 'Sandbox error'}`,
        strengths: [],
        missingConcepts: [],
        skillEvidence: [],
        confidence: 1.0,
        evaluatorType: 'code_execution',
        evaluatorVersion: EVALUATOR_VERSION,
      };
    }

    // Determine qualitative correctness
    let correctness: 'correct' | 'mostly_correct' | 'partially_correct' | 'incorrect' = 'incorrect';
    if (result.score >= 0.99) {
      correctness = 'correct';
    } else if (result.score >= 0.70) {
      correctness = 'mostly_correct';
    } else if (result.score >= 0.30) {
      correctness = 'partially_correct';
    }

    // Build deterministic feedback
    let reasoning = `Passed ${result.passedTests} of ${result.totalTests} test cases (${Math.round(result.score * 100)}%).`;
    if (result.evaluationStatus === 'compilation_error') {
      reasoning = `Compilation failed: ${result.compilerOutput || 'Syntax error'}`;
    } else if (result.evaluationStatus === 'timeout') {
      reasoning = `Execution timed out on one or more test cases.`;
    } else if (result.evaluationStatus === 'runtime_error') {
      reasoning = `Runtime error / crash occurred during execution.`;
    }

    const strengths: string[] = [];
    if (result.passedTests > 0) {
      strengths.push(`Successfully passed ${result.passedTests} test cases`);
    }
    if (result.score >= 0.70) {
      strengths.push(`Solution demonstrates good core algorithmic logic`);
    }

    const missingConcepts: string[] = [];
    if (result.passedTests < result.totalTests) {
      if (result.evaluationStatus === 'compilation_error') {
        missingConcepts.push('Valid C++ syntax and compilation');
      } else if (result.evaluationStatus === 'timeout') {
        missingConcepts.push('Time complexity optimization');
      } else {
        missingConcepts.push('Edge case handling and boundary constraints');
      }
    }

    return {
      evaluationStatus: 'evaluated',
      score: result.score,
      correctness,
      reasoning,
      strengths,
      missingConcepts,
      skillEvidence: allowedSkills.map((s) => ({
        skill: s,
        score: result.score,
      })),
      confidence: 1.0,
      evaluatorType: 'code_execution',
      evaluatorVersion: EVALUATOR_VERSION,
      promptVersion: 'deterministic-sandbox-v1',
    };
  }
}
