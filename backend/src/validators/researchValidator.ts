import { ResearchResult, ResearchSource, ResearchKnowledgeItem } from '../types/research';

export class ResearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResearchValidationError';
  }
}

/**
 * Validates that all research knowledge items strictly meet requirements:
 * - concept must exist and be non-empty
 * - summary must exist and be non-empty
 * - sourceUrl must exist and be a valid URL
 * - sourceTitle must exist and be non-empty
 */
export function validateResearchKnowledge(items: unknown[]): ResearchKnowledgeItem[] {
  if (!Array.isArray(items)) {
    throw new ResearchValidationError('Knowledge items must be an array.');
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ResearchValidationError(`Knowledge item at index ${index} must be an object.`);
    }

    const obj = item as Record<string, unknown>;

    if (typeof obj.concept !== 'string' || obj.concept.trim().length === 0) {
      throw new ResearchValidationError(`Knowledge item at index ${index} is missing a valid "concept".`);
    }

    if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
      throw new ResearchValidationError(`Knowledge item at index ${index} is missing a valid "summary".`);
    }

    if (typeof obj.sourceUrl !== 'string' || obj.sourceUrl.trim().length === 0) {
      throw new ResearchValidationError(`Knowledge item at index ${index} is missing a valid "sourceUrl".`);
    }

    if (typeof obj.sourceTitle !== 'string' || obj.sourceTitle.trim().length === 0) {
      throw new ResearchValidationError(`Knowledge item at index ${index} is missing a valid "sourceTitle".`);
    }

    return {
      concept: obj.concept.trim(),
      summary: obj.summary.trim(),
      subtopic: typeof obj.subtopic === 'string' ? obj.subtopic.trim() : undefined,
      sourceUrl: obj.sourceUrl.trim(),
      sourceTitle: obj.sourceTitle.trim(),
    };
  });
}

/**
 * Validates complete research result structure before returning to client or persisting
 */
export function validateResearchResult(data: unknown): ResearchResult {
  if (!data || typeof data !== 'object') {
    throw new ResearchValidationError('Research result must be an object.');
  }

  const obj = data as Record<string, unknown>;

  if (obj.status !== 'success') {
    throw new ResearchValidationError('Research status must be "success".');
  }

  if (typeof obj.topic !== 'string' || obj.topic.trim().length === 0) {
    throw new ResearchValidationError('Research result is missing a valid "topic".');
  }

  if (!Array.isArray(obj.sources)) {
    throw new ResearchValidationError('Research result is missing a valid "sources" array.');
  }

  const validatedSources: ResearchSource[] = obj.sources.map((s, idx) => {
    const src = s as Record<string, unknown>;
    if (typeof src.title !== 'string' || typeof src.url !== 'string') {
      throw new ResearchValidationError(`Source at index ${idx} is missing title or url.`);
    }
    return {
      id: typeof src.id === 'number' ? src.id : undefined,
      title: src.title.trim(),
      url: src.url.trim(),
      domain: typeof src.domain === 'string' ? src.domain.trim() : 'unknown',
      sourceType: (src.sourceType as any) || 'other',
      retrievedAt: src.retrievedAt ? String(src.retrievedAt) : new Date().toISOString(),
    };
  });

  const validatedKnowledge = validateResearchKnowledge(obj.knowledge as unknown[]);

  return {
    status: 'success',
    topic: obj.topic.trim(),
    sessionId: typeof obj.sessionId === 'number' ? obj.sessionId : undefined,
    sources: validatedSources,
    knowledge: validatedKnowledge,
  };
}
