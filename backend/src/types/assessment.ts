import { Question, QuestionType, CognitiveLevel } from './question';

export interface GAWeights {
  coverage: number;           // Subtopic coverage reward (default: 0.25)
  difficulty: number;         // Closeness to target difficulty (default: 0.20)
  typeDiversity: number;      // Variety across question types (default: 0.15)
  cognitiveDiversity: number; // Variety across cognitive levels (default: 0.10)
  redundancy: number;         // Penalty for duplicate concepts/skills (default: 0.15)
  time: number;               // Completion time reasonableness (default: 0.05)
  skillTargets: number;       // Matching optional skill targets (default: 0.10)
}

export interface FitnessBreakdown {
  coverage: number;
  difficulty: number;
  typeDiversity: number;
  cognitiveDiversity: number;
  redundancy: number;
  time: number;
  skillTargets: number;
}

export interface FitnessResult {
  total: number;
  breakdown: FitnessBreakdown;
}

export interface GAConfig {
  populationSize: number;       // Default: 50
  generations: number;          // Default: 100
  mutationRate: number;         // Default: 0.10
  crossoverRate: number;        // Default: 0.80
  elitismCount: number;         // Default: 2
  tournamentSize: number;       // Default: 3
  stagnationLimit?: number;     // Early stopping if no improvement for N gens (default: 20)
  weights?: Partial<GAWeights>;
  timeEstimates?: Record<QuestionType, number>;
  seed?: number;                // Optional seed for deterministic execution
  questionTypeTargets?: Record<string, number>; // Trial 10: Adaptive question type targets
  cognitiveTargets?: Record<string, number>;    // Trial 10: Adaptive cognitive level targets
}

export type Chromosome = (string | number)[];

export interface Individual {
  chromosome: Chromosome;
  fitness: FitnessResult;
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
  questionTypeTargets?: Record<string, number>; // Trial 10
  cognitiveTargets?: Record<string, number>;    // Trial 10
  config?: Partial<GAConfig>;
  questions?: Question[];
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
