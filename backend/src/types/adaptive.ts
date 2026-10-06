import { Question } from './question';

export type SkillPriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

export interface AdaptiveSkillPriority {
  skill: string;
  priority: SkillPriorityLevel;
  weight: number;
  reasoning: string;
  currentScore: number;
  confidence: number;
  evidenceCount: number;
}

export interface TargetAssessmentProfile {
  targetDifficulty: number;
  skillTargets: Record<string, number>;
  questionTypeTargets: Record<string, number>;
  cognitiveTargets: Record<string, number>;
  questionCount: number;
}

export interface DifficultyOptions {
  minimumDifficulty: number;
  maximumDifficulty: number;
  difficultyStep: number;
}

export interface AdaptiveAssessmentRunRecord {
  id?: number;
  topicId: number;
  previousAttemptId?: number | null;
  generatedAssessmentId: number;
  targetDifficulty: number;
  skillTargets: Record<string, number>;
  questionTypeTargets: Record<string, number>;
  cognitiveTargets: Record<string, number>;
  reasoning: string[];
  createdAt: string;
}

export interface AdaptiveAssessmentRequest {
  topicId: number;
  questionCount?: number;
  previousAttemptId?: number;
  questions?: Question[];
  targetDifficulty?: number;
}

export interface AdaptiveAssessmentResponse {
  status: 'success';
  assessmentId: number;
  runId?: number;
  adaptiveProfile: TargetAssessmentProfile;
  reasoning: string[];
  assessment: {
    questionCount: number;
    fitness: number;
    averageDifficulty: number;
    generationCount: number;
    subtopicsCovered: string[];
    typesCovered: string[];
    cognitiveLevelsCovered: string[];
    estimatedTotalTimeSeconds: number;
  };
}
