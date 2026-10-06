import { QuestionType, CognitiveLevel } from './question';

export interface FitnessBreakdown {
  coverage: number;
  difficulty: number;
  typeDiversity: number;
  cognitiveDiversity: number;
  redundancy: number;
  time: number;
  skillTargets: number;
}

export interface OptimizedQuestionItem {
  id: number | string;
  order: number;
  type: QuestionType;
  question: string;
  options?: string[];
  difficulty: number;
  concept: string;
  subtopic: string;
  skills: string[];
  cognitiveLevel: CognitiveLevel;
  codeSnippet?: string;
  scenarioText?: string;
  estimatedTimeSeconds?: number;
}

export interface OptimizeAssessmentRequest {
  topicId?: number;
  researchRunId?: number;
  targetQuestionCount?: number;
  targetDifficulty?: number;
  skillTargets?: Record<string, number>;
  questions?: any[];
}

export interface OptimizeAssessmentResponse {
  status: 'success';
  assessmentId?: number;
  topicId?: number;
  questionCount: number;
  targetDifficulty: number;
  averageDifficulty: number;
  fitness: number;
  fitnessBreakdown: FitnessBreakdown;
  questions: OptimizedQuestionItem[];
  generationCount: number;
  subtopicsCovered: string[];
  typesCovered: string[];
  cognitiveLevelsCovered: string[];
  estimatedTotalTimeSeconds: number;
}
