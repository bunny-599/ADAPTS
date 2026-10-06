export type TrendType = 'IMPROVING' | 'DECLINING' | 'STABLE' | 'INSUFFICIENT_DATA';

export type AdvancedSkillStatus =
  | 'INSUFFICIENT_EVIDENCE'
  | 'WEAK'
  | 'DEVELOPING'
  | 'STRONG'
  | 'MASTERED'
  | 'RECOVERING'
  | 'PERSISTENT_WEAKNESS'
  | 'REGRESSION';

export interface SkillHistoryRecord {
  id?: number;
  topicId: number;
  attemptId: number;
  skill: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  status: string;
  assessedAt: string;
}

export interface AssessmentPerformanceRecord {
  id?: number;
  topicId: number;
  attemptId: number;
  overallAccuracy: number;
  completionRate: number;
  evaluatedQuestions: number;
  correctAnswers: number;
  totalQuestions: number;
  durationSeconds: number;
  averageDifficulty: number;
  createdAt: string;
}

export interface SkillHistoryObservation {
  attemptId: number;
  score: number;
  confidence: number;
  evidenceCount: number;
  difficulty?: number;
  assessedAt: string;
}

export interface SkillProgressSummary {
  skill: string;
  score: number;
  confidence: number;
  status: AdvancedSkillStatus;
  trend: TrendType;
  change: number;
  evidence: number;
  previousScore: number | null;
  history: SkillHistoryObservation[];
}

export interface TopicProgressSummary {
  status: 'success';
  topicId: number;
  topic: string;
  assessments: {
    total: number;
    averageAccuracy: number;
    latestAccuracy: number;
    improvement: number;
    averageDifficulty: number;
    latestDifficulty: number;
  };
  skills: SkillProgressSummary[];
  strengths: string[];
  weaknesses: string[];
  improving: string[];
  recovering: string[];
  regressions: string[];
  persistentWeaknesses: string[];
  mastered: string[];
}

export interface ChronologicalAssessmentHistoryItem {
  attemptId: number;
  accuracy: number;
  difficulty: number;
  durationSeconds: number;
  date: string;
  evaluatedQuestions: number;
  totalQuestions: number;
}

export interface AssessmentHistoryResponse {
  status: 'success';
  topicId: number;
  history: ChronologicalAssessmentHistoryItem[];
}

export interface SkillHistoryResponse {
  status: 'success';
  topicId: number;
  skill: string;
  progress: SkillProgressSummary;
}
