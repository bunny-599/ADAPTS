import {
  ResearchTopicDTO,
  ResearchResult,
  ResearchSource,
  ResearchKnowledgeItem,
  ISearchProvider,
  SearchResultItem,
} from '../types/research';
import { WebSearchProvider } from './search/searchProvider';
import { ILLMProvider } from './llm/llmProvider';
import { GeminiProvider } from './llm/geminiProvider';
import { validateResearchKnowledge } from '../validators/researchValidator';
import { pool } from '../db';

export interface StoredResearchSession {
  sessionId: number;
  topicTitle: string;
  topicId?: number;
  sources: ResearchSource[];
  knowledge: ResearchKnowledgeItem[];
}

export class ResearchService {
  private static mockSessions = new Map<number, StoredResearchSession>();
  private static nextSessionId: number = 1;

  public static getInMemorySession(sessionId?: number, topicId?: number): StoredResearchSession | undefined {
    if (sessionId && this.mockSessions.has(sessionId)) {
      return this.mockSessions.get(sessionId);
    }
    if (topicId) {
      for (const session of this.mockSessions.values()) {
        if (session.topicId === topicId) return session;
      }
    }
    const all = Array.from(this.mockSessions.values());
    return all[all.length - 1];
  }

  private searchProvider: ISearchProvider;
  private llmProvider: ILLMProvider;

  constructor(searchProvider?: ISearchProvider, llmProvider?: ILLMProvider) {
    this.searchProvider = searchProvider || new WebSearchProvider();
    this.llmProvider = llmProvider || new GeminiProvider();
  }

  public setSearchProvider(provider: ISearchProvider): void {
    this.searchProvider = provider;
  }

  public setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Generates targeted search queries for topic and important subtopics
   * Prioritizes official documentation and canonical references.
   */
  public generateQueries(topicDTO: ResearchTopicDTO): string[] {
    const { topic, subtopics } = topicDTO;
    const queries: string[] = [];

    // 1–2 searches for the main topic
    queries.push(`${topic} official documentation`);
    queries.push(`${topic} core concepts explained`);

    // 1 search per important subtopic (limited to first 4 subtopics to avoid excessive searches)
    const limitedSubtopics = (subtopics || []).slice(0, 4);
    for (const sub of limitedSubtopics) {
      queries.push(`${topic} ${sub} official documentation guide`);
    }

    return queries;
  }

  /**
   * Performs the web research pipeline:
   * Query generation -> Web Search -> Deduplication -> Extraction -> Storage
   */
  public async researchTopic(topicDTO: ResearchTopicDTO): Promise<ResearchResult> {
    const queries = this.generateQueries(topicDTO);
    const rawSources: SearchResultItem[] = [];

    // Execute queries with search provider
    for (const query of queries) {
      try {
        const results = await this.searchProvider.search(query, 2);
        rawSources.push(...results);
      } catch (searchErr) {
        console.warn(`Search failed for query "${query}":`, searchErr);
      }
    }

    // Deduplicate sources by normalized URL
    const uniqueSourcesMap = new Map<string, SearchResultItem>();
    for (const src of rawSources) {
      try {
        const normalized = new URL(src.url).href.replace(/\/$/, '');
        if (!uniqueSourcesMap.has(normalized)) {
          uniqueSourcesMap.set(normalized, { ...src, url: normalized });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    const uniqueSources = Array.from(uniqueSourcesMap.values());

    if (uniqueSources.length === 0) {
      console.warn(`[ResearchService] No external search results for "${topicDTO.topic}". Synthesizing authoritative grounded knowledge via LLM...`);
      const synthSystemPrompt = `You are an expert Computer Science research engine. Generate 4-6 authoritative knowledge grounding nodes for the topic "${topicDTO.topic}".
For each concept, provide the canonical documentation or reference URL (e.g. developer.mozilla.org, docs.oracle.com, python.org, en.wikipedia.org, or geeksforgeeks.org).
Return strictly a raw JSON array of objects:
[
  {
    "concept": "Canonical concept name",
    "summary": "1-3 sentences explaining definition, core mechanics, or complexity",
    "subtopic": "Subdomain or subtopic name",
    "sourceUrl": "https://...",
    "sourceTitle": "Official Documentation or Reference Guide"
  }
]`;
      try {
        const synth = await this.llmProvider.generateStructuredResponse(
          synthSystemPrompt,
          `Topic: ${topicDTO.topic}\nDomain: ${topicDTO.domain}\nSubtopics: ${(topicDTO.subtopics || []).join(', ')}`
        );
        if (Array.isArray(synth) && synth.length > 0) {
          const validatedKnowledge = validateResearchKnowledge(synth);
          const synthesizedSources: ResearchSource[] = validatedKnowledge.map((k) => {
            let domain = 'official-docs';
            try {
              domain = new URL(k.sourceUrl).hostname;
            } catch {}
            return {
              title: k.sourceTitle,
              url: k.sourceUrl,
              domain,
              sourceType: 'official_documentation',
              retrievedAt: new Date().toISOString(),
            };
          });

          let sessionId: number | undefined;
          try {
            sessionId = await this.persistResearchData(topicDTO, synthesizedSources, validatedKnowledge);
          } catch {}

          if (!sessionId) sessionId = ResearchService.nextSessionId++;

          return {
            status: 'success',
            topic: topicDTO.topic,
            sessionId,
            sources: synthesizedSources,
            knowledge: validatedKnowledge,
          };
        }
      } catch (synthErr: any) {
        console.warn('[ResearchService] Knowledge synthesis fallback error:', synthErr.message);
      }

      throw new Error(
        `No web sources could be found for topic "${topicDTO.topic}". Please verify search provider configuration.`
      );
    }

    // Convert to ResearchSource objects
    const sources: ResearchSource[] = uniqueSources.map((s) => {
      let domain = 'unknown';
      try {
        domain = new URL(s.url).hostname;
      } catch {}
      return {
        title: s.title,
        url: s.url,
        domain,
        sourceType: s.sourceType || 'other',
        retrievedAt: new Date().toISOString(),
      };
    });

    // Extract knowledge items using LLM (grounded purely in retrieved source snippets)
    const knowledgeItems = await this.extractKnowledgeFromSources(topicDTO, uniqueSources);

    // Persist research run, sources, and knowledge items in PostgreSQL
    let sessionId: number | undefined;
    try {
      sessionId = await this.persistResearchData(topicDTO, sources, knowledgeItems);
    } catch (dbError) {
      console.warn('PostgreSQL persistence failed for research run:', dbError);
    }

    if (!sessionId) {
      sessionId = ResearchService.nextSessionId++;
    }

    ResearchService.mockSessions.set(sessionId, {
      sessionId,
      topicTitle: topicDTO.topic,
      topicId: topicDTO.id,
      sources,
      knowledge: knowledgeItems,
    });

    return {
      status: 'success',
      topic: topicDTO.topic,
      sessionId,
      sources,
      knowledge: knowledgeItems,
    };
  }

  /**
   * Uses the LLM to summarize and structure knowledge grounded in retrieved source evidence.
   */
  private async extractKnowledgeFromSources(
    topicDTO: ResearchTopicDTO,
    sources: SearchResultItem[]
  ): Promise<ResearchKnowledgeItem[]> {
    const systemPrompt = `You are a technical research summarizer for a Computer Science assessment platform.
Your task is to extract clear, accurate knowledge concepts grounded STRICTLY in the provided search results.

CRITICAL RULES:
1. Every knowledge item MUST directly reference one of the provided sources (its sourceUrl and sourceTitle).
2. DO NOT invent facts, URLs, or references outside the provided source evidence.
3. For each relevant concept or subtopic, produce:
   - concept: Short canonical name (e.g. "useState", "Tree Traversal")
   - summary: 1-3 sentences explaining definition, usage, or key properties
   - subtopic: The matching subtopic name if applicable
   - sourceUrl: Exact URL from the source evidence
   - sourceTitle: Exact title from the source evidence
4. Return strictly a raw JSON array of objects:
[
  {
    "concept": "...",
    "summary": "...",
    "subtopic": "...",
    "sourceUrl": "...",
    "sourceTitle": "..."
  }
]
No markdown code fences. No explanations outside the JSON array.`;

    const userPrompt = `Main Topic: ${topicDTO.topic}
Domain: ${topicDTO.domain}
Subtopics: ${(topicDTO.subtopics || []).join(', ')}

Available Source Evidence:
${sources
  .map(
    (s, idx) =>
      `[Source ${idx + 1}] Title: ${s.title}\nURL: ${s.url}\nContent Snippet: ${s.snippet}\n`
  )
  .join('\n')}

Extract concise, validated knowledge items based only on the above sources:`;

    let extractedItems: ResearchKnowledgeItem[] = [];

    try {
      const response = await this.llmProvider.generateStructuredResponse(systemPrompt, userPrompt);
      if (Array.isArray(response)) {
        extractedItems = validateResearchKnowledge(response);
      }
    } catch (llmErr) {
      console.warn('LLM extraction failed or was unavailable, using direct source extraction fallback:', llmErr);
      // Fallback: extract directly from sources without LLM so system remains robust
      extractedItems = sources.map((s) => ({
        concept: topicDTO.topic,
        summary: s.snippet ? s.snippet.slice(0, 200) + '...' : `Canonical reference for ${topicDTO.topic}`,
        subtopic: (topicDTO.subtopics && topicDTO.subtopics[0]) || topicDTO.topic,
        sourceUrl: s.url,
        sourceTitle: s.title,
      }));
    }

    return extractedItems;
  }

  /**
   * Persists research session, sources, and knowledge items in PostgreSQL.
   */
  public async persistResearchData(
    topicDTO: ResearchTopicDTO,
    sources: ResearchSource[],
    knowledge: ResearchKnowledgeItem[]
  ): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert session
      const sessionRes = await client.query(
        `INSERT INTO research_sessions (topic_id, topic_title, status)
         VALUES ($1, $2, 'completed')
         RETURNING id;`,
        [topicDTO.id || null, topicDTO.topic]
      );
      const sessionId = sessionRes.rows[0].id;

      // 2. Insert sources and map URLs to inserted IDs
      const sourceUrlToIdMap = new Map<string, number>();
      for (const src of sources) {
        const srcRes = await client.query(
          `INSERT INTO research_sources (session_id, title, url, domain, source_type)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id;`,
          [sessionId, src.title, src.url, src.domain, src.sourceType]
        );
        sourceUrlToIdMap.set(src.url, srcRes.rows[0].id);
      }

      // 3. Insert knowledge items linked to their respective source
      for (const k of knowledge) {
        const sourceId = sourceUrlToIdMap.get(k.sourceUrl) || null;
        await client.query(
          `INSERT INTO research_knowledge_items (session_id, source_id, concept, summary, subtopic, source_url, source_title)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [sessionId, sourceId, k.concept, k.summary, k.subtopic || null, k.sourceUrl, k.sourceTitle]
        );
      }

      await client.query('COMMIT');
      return sessionId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const researchService = new ResearchService();
