import { Question } from './question';

export type ValidationStatus = 'VALID' | 'FLAGGED' | 'INVALID';

export interface ValidationIssue {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface QuestionAnswerConsistencyResult {
  questionAnswerConsistency: boolean;
  confidence: number;
  reason?: string;
  issues: string[];
}

export interface ValidatedQuestionResult {
  question: Question;
  status: ValidationStatus;
  qualityScore: number; // 0.0 to 1.0
  issues: ValidationIssue[];
  questionAnswerConsistency?: QuestionAnswerConsistencyResult;
  metrics: {
    structuralScore: number;
    clarityScore: number;
    groundingScore: number;
    distractorScore: number;
    consistencyScore?: number;
  };
}

export interface QuestionValidationSummary {
  totalAnalyzed: number;
  validCount: number;
  flaggedCount: number;
  invalidCount: number;
  averageQualityScore: number;
}

export interface ValidateQuestionPoolRequest {
  topicId?: number;
  researchRunId?: number;
  questions?: Question[];
}

export interface ValidateQuestionPoolResponse {
  status: 'success';
  summary: QuestionValidationSummary;
  validQuestions: ValidatedQuestionResult[];
  flaggedQuestions: ValidatedQuestionResult[];
  invalidQuestions: ValidatedQuestionResult[];
}
