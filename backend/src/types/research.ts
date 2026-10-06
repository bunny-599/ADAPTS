export type SourceType = 'official_documentation' | 'academic' | 'technical_article' | 'other';

export interface ResearchSource {
  id?: number;
  title: string;
  url: string;
  domain: string;
  sourceType: SourceType;
  retrievedAt?: string | Date;
}

export interface ResearchKnowledgeItem {
  id?: number;
  concept: string;
  summary: string;
  subtopic?: string;
  sourceUrl: string;
  sourceTitle: string;
}

export interface ResearchTopicDTO {
  id?: number;
  field: string;
  domain: string;
  topic: string;
  subtopics: string[];
}

export interface ResearchRequest {
  topic: ResearchTopicDTO;
}

export interface ResearchResult {
  status: 'success';
  topic: string;
  sessionId?: number;
  sources: ResearchSource[];
  knowledge: ResearchKnowledgeItem[];
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  sourceType?: SourceType;
}

export interface ISearchProvider {
  search(query: string, maxResults?: number): Promise<SearchResultItem[]>;
  fetchSource?(url: string): Promise<string>;
}
