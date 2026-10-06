import { QuestionType } from './question';

export interface PublicAssessmentQuestion {
  id: number | string;
  order: number;
  type: QuestionType;
  question: string;
  options?: string[];
  difficulty: number;
  subtopic: string;
  concept?: string;
  codeSnippet?: string;
  scenarioText?: string;
  estimatedTimeSeconds?: number;
  language?: string;
  starterCode?: string;
  constraints?: string;
  sampleTestCases?: { input: string; expectedOutput: string }[];
}

export interface PublicAssessment {
  id: number;
  topicId?: number;
  topicName?: string;
  questionCount: number;
  targetDifficulty: number;
  questions: PublicAssessmentQuestion[];
}

export interface GetAssessmentResponse {
  status: 'success';
  assessment: PublicAssessment;
}

export interface StartAssessmentResponse {
  status: 'success';
  attemptId: number;
  assessmentId: number;
  startedAt: string;
}

export interface StudentQuestionResponse {
  questionId: number | string;
  answer: string | null;
}

export interface SubmitAssessmentRequest {
  responses: StudentQuestionResponse[];
}

export interface SubmitAssessmentResponse {
  status: 'success';
  attemptId: number;
  message: string;
  submittedAt: string;
}
