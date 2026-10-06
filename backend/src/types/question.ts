export type QuestionType =
  | 'MCQ'
  | 'OUTPUT_PREDICTION'
  | 'CONCEPTUAL'
  | 'DEBUGGING'
  | 'SCENARIO'
  | 'CODING';

export type CognitiveLevel = 'remember' | 'understand' | 'apply' | 'analyze';

export interface CodingTestCase {
  id?: number | string;
  questionId?: number | string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight?: number;
  order?: number;
}

export interface BaseQuestion {
  id?: number | string;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  explanation: string;
  difficulty: number; // 0.0 to 1.0 continuous
  concept: string;
  subtopic: string;
  skills: string[];
  cognitiveLevel: CognitiveLevel;
  sourceReferences: string[];
  codeSnippet?: string;
  scenarioText?: string;
  options?: string[];
}

export interface MCQQuestion extends BaseQuestion {
  type: 'MCQ';
  options: [string, string, string, string]; // exactly 4 options
}

export interface OutputPredictionQuestion extends BaseQuestion {
  type: 'OUTPUT_PREDICTION';
  codeSnippet?: string;
  options?: string[];
}

export interface ConceptualQuestion extends BaseQuestion {
  type: 'CONCEPTUAL';
  options?: string[];
}

export interface DebuggingQuestion extends BaseQuestion {
  type: 'DEBUGGING';
  codeSnippet?: string;
  options?: string[];
}

export interface ScenarioQuestion extends BaseQuestion {
  type: 'SCENARIO';
  scenarioText?: string;
  options?: string[];
}

export interface CodingQuestion extends BaseQuestion {
  type: 'CODING';
  language: 'cpp';
  starterCode?: string;
  functionSignature?: string;
  constraints?: string;
  expectedComplexity?: {
    time?: string;
    space?: string;
  };
  testCases?: CodingTestCase[];
}

export type Question =
  | MCQQuestion
  | OutputPredictionQuestion
  | ConceptualQuestion
  | DebuggingQuestion
  | ScenarioQuestion
  | CodingQuestion;

export interface GenerateQuestionsRequest {
  topicId?: number;
  researchRunId?: number;
  count?: number;
  topicTitle?: string;
  knowledgeItems?: Array<{
    id?: number | string;
    concept: string;
    summary: string;
    subtopic?: string;
    source_url?: string;
    sourceUrl?: string;
    source_title?: string;
    sourceTitle?: string;
  }>;
}

export interface GenerateQuestionsResponse {
  status: 'success';
  topic: string;
  generatedCount: number;
  questions: Question[];
  distribution: Record<QuestionType, number>;
}
