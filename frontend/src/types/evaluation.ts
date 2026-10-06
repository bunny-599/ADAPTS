export type EvaluationStatusType =
  | 'evaluated'
  | 'not_evaluable'
  | 'evaluator_error';

export type CorrectnessType =
  | 'correct'
  | 'mostly_correct'
  | 'partially_correct'
  | 'incorrect'
  | 'not_evaluable'
  | 'evaluator_error';

export interface SkillEvidenceItem {
  skill: string;
  score: number;
}

export interface AnswerEvaluationResult {
  evaluationStatus: EvaluationStatusType;
  score: number | null;
  correctness: CorrectnessType;
  reasoning: string;
  strengths: string[];
  missingConcepts: string[];
  skillEvidence: SkillEvidenceItem[];
  confidence: number;
  evaluatorType: 'deterministic' | 'llm' | 'code_execution';
  modelName?: string;
  evaluatorVersion: string;
  promptVersion?: string;
}

export interface QuestionEvaluationSummaryItem {
  questionId: number | string;
  questionOrder?: number;
  questionType: string;
  questionText: string;
  studentAnswer: string | null;
  status: EvaluationStatusType;
  score: number | null;
  correctness: CorrectnessType;
  reasoning: string;
  strengths: string[];
  missingConcepts: string[];
  skillEvidence: SkillEvidenceItem[];
  confidence: number;
  evaluatorType: 'deterministic' | 'llm' | 'code_execution';
}

export interface EvaluateAttemptResponse {
  status: 'success';
  attemptId: number;
  totalQuestions: number;
  evaluatedQuestions: number;
  notEvaluableQuestions: number;
  evaluationErrors: number;
  averageScore: number;
  results: QuestionEvaluationSummaryItem[];
}
