export interface TargetAssessmentProfile {
  targetDifficulty: number;
  skillTargets: Record<string, number>;
  questionTypeTargets: Record<string, number>;
  cognitiveTargets: Record<string, number>;
  questionCount: number;
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
