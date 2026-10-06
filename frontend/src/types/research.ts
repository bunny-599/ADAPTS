export type SourceType = 'official_documentation' | 'academic' | 'technical_article' | 'other';

export interface ResearchSource {
  id?: number;
  title: string;
  url: string;
  domain: string;
  sourceType: SourceType;
  retrievedAt?: string;
}

export interface ResearchKnowledgeItem {
  id?: number;
  concept: string;
  summary: string;
  subtopic?: string;
  sourceUrl: string;
  sourceTitle: string;
}

export interface ResearchTopicPayload {
  id?: number;
  field: string;
  domain: string;
  topic: string;
  subtopics: string[];
}

export interface ResearchResult {
  status: 'success';
  topic: string;
  sessionId?: number;
  sources: ResearchSource[];
  knowledge: ResearchKnowledgeItem[];
}
