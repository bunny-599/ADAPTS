import { QuestionType, CognitiveLevel } from './question';
import { AnswerEvaluationResult } from './evaluation';

export type EvaluationStatus =
  | 'correct'
  | 'incorrect'
  | 'unanswered'
  | 'not_auto_evaluable'
  | 'evaluated'
  | 'not_evaluable'
  | 'evaluator_error';

export type SkillStatus = 'strong' | 'developing' | 'weak' | 'insufficient_evidence';

export interface QuestionEvaluationResult {
  questionId: number | string;
  order?: number;
  questionText?: string;
  answer: string | null;
  expectedAnswer?: string;
  evaluationStatus: EvaluationStatus;
  score: number | null; // 1.0 for correct, 0.0 for incorrect/unanswered, null for not_auto_evaluable/evaluator_error
  subtopic: string;
  skills: string[];
  cognitiveLevel: CognitiveLevel;
  questionType: QuestionType;
  difficulty: number;
  evaluationDetails?: AnswerEvaluationResult;
}

export interface OverallMetrics {
  accuracy: number;            // correct / evaluated (0.0 to 1.0)
  completionRate: number;      // answered / total (0.0 to 1.0)
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  evaluatedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  durationSeconds: number;
  eloScore?: number;
  eloDelta?: number;
}

export interface TypeBreakdownItem {
  total: number;
  evaluated: number;
  correct: number;
  accuracy: number | null;
}

export interface SubtopicBreakdownItem {
  total: number;
  evaluated: number;
  correct: number;
  accuracy: number | null;
  evidence: number;
}

export interface SkillAnalysisItem {
  skill: string;
  score: number;
  confidence: number;
  status: SkillStatus;
  evidence: number;
  correctCount: number;
}

export interface CognitiveBreakdownItem {
  total: number;
  evaluated: number;
  correct: number;
  accuracy: number | null;
}

export interface DifficultyBreakdownItem {
  total: number;
  evaluated: number;
  correct: number;
  accuracy: number | null;
}

export interface PerformanceAnalysisResult {
  status: 'success';
  attemptId: number;
  topicId?: number;
  topicName?: string;
  overall: OverallMetrics;
  questionTypes: Record<string, TypeBreakdownItem>;
  subtopics: Record<string, SubtopicBreakdownItem>;
  skills: Record<string, SkillAnalysisItem>;
  cognitiveLevels: Record<string, CognitiveBreakdownItem>;
  difficultyRanges: Record<string, DifficultyBreakdownItem>;
  strengths: string[];
  weaknesses: string[];
  evaluatedResponses: QuestionEvaluationResult[];
  createdAt?: string;
}

export interface SkillProfileRecord {
  id?: number;
  topicId: number;
  skill: string;
  score: number;
  confidence: number;
  status: SkillStatus;
  evaluatedQuestions: number;
  correctAnswers: number;
  lastAssessedAt: string;
}
