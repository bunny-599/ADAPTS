export interface StructuredTopic {
  status: 'success';
  field: string;
  domain: string;
  topic: string;
  subtopics: string[];
}

export interface ClarificationRequired {
  status: 'clarification_required';
  message: string;
  options: string[];
}

export interface InvalidTopic {
  status: 'invalid';
  message: string;
}

export type TopicAnalysisResult = StructuredTopic | ClarificationRequired | InvalidTopic;

export function isStructuredTopic(result: TopicAnalysisResult): result is StructuredTopic {
  return result.status === 'success';
}

export function isClarification(result: TopicAnalysisResult): result is ClarificationRequired {
  return result.status === 'clarification_required';
}

export function isClarificationRequired(result: TopicAnalysisResult): result is ClarificationRequired {
  return result.status === 'clarification_required';
}

export function isInvalidTopic(result: TopicAnalysisResult): result is InvalidTopic {
  return result.status === 'invalid';
}

export interface Topic {
  id: number;
  input: string;
  field?: string | null;
  domain?: string | null;
  topic?: string | null;
  subtopics?: string[] | null;
  created_at: string;
}

export interface CreateTopicPayload {
  input: string;
  field?: string;
  domain?: string;
  topic?: string;
  subtopics?: string[];
}
