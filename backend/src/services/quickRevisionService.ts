import { ResearchKnowledgeItem } from '../types/research';
import { QuickRevisionPoint, QuickRevisionResult } from '../types/revision';
import { ILLMProvider } from './llm/llmProvider';
import { GeminiProvider } from './llm/geminiProvider';

export class QuickRevisionService {
  private llmProvider: ILLMProvider;

  constructor(llmProvider?: ILLMProvider) {
    this.llmProvider = llmProvider || new GeminiProvider();
  }

  public setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Generates a grounded 4–6 point Quick Revision refresher from validated research knowledge.
   */
  public async generateRevision(
    topic: string,
    knowledgeItems: ResearchKnowledgeItem[]
  ): Promise<QuickRevisionResult> {
    if (!knowledgeItems || knowledgeItems.length === 0) {
      throw new Error(`Cannot generate Quick Revision: No validated research knowledge found for topic "${topic}".`);
    }

    // 1. Try generating with LLM if configured
    if (this.llmProvider && this.llmProvider.isConfigured?.()) {

      try {
        const systemPrompt = `You are an expert Computer Science educator.
Your task is to generate a concise "Quick Revision" refresher for a student who is about to take an assessment on the topic: "${topic}".

CRITICAL REQUIREMENTS:
1. Ground every single point STRICTLY in the provided research knowledge.
2. Generate between 4 and 6 concise bullet points (each 1-2 sentences maximum).
3. Cover:
   - Fundamental operational mechanisms / how the algorithm or data structure operates
   - Time & space complexity nuances (best-case vs worst-case)
   - Important prerequisites or constraints (e.g. sorted input requirement)
   - Practical trade-offs compared to alternatives
4. Do NOT include quiz questions, test questions, or answer keys.
5. Retain the sourceUrl and sourceTitle from the supporting knowledge items.
6. Return strictly valid JSON:
{
  "points": [
    {
      "text": "Linear search checks elements sequentially from start to end.",
      "concept": "Sequential Traversal",
      "sourceUrl": "...",
      "sourceTitle": "..."
    }
  ]
}`;

        const userPrompt = `Target Topic: ${topic}

Verified Research Knowledge:
${knowledgeItems
  .slice(0, 10)
  .map(
    (k, idx) =>
      `[Knowledge #${idx + 1}] Concept: ${k.concept} | Subtopic: ${k.subtopic || 'General'}
Summary: ${k.summary}
Source: ${k.sourceTitle} (${k.sourceUrl})`
  )
  .join('\n\n')}

Generate 4 to 6 concise Quick Revision points now:`;

        const response: any = await this.llmProvider.generateStructuredResponse(systemPrompt, userPrompt);
        let rawPoints: any[] = [];
        if (response && Array.isArray(response.points)) {
          rawPoints = response.points;
        } else if (Array.isArray(response)) {
          rawPoints = response;
        }

        if (rawPoints.length >= 3) {
          const sanitizedPoints: QuickRevisionPoint[] = rawPoints
            .filter((p) => p && typeof p.text === 'string' && p.text.trim().length > 10)
            .slice(0, 6)
            .map((p) => ({
              text: p.text.trim(),
              concept: p.concept ? String(p.concept).trim() : undefined,
              sourceUrl: p.sourceUrl || knowledgeItems[0]?.sourceUrl,
              sourceTitle: p.sourceTitle || knowledgeItems[0]?.sourceTitle,
            }));

          // If we got 4 to 6 points, return
          if (sanitizedPoints.length >= 4) {
            return {
              topic,
              points: sanitizedPoints,
              groundedSourceCount: new Set(sanitizedPoints.map((p) => p.sourceUrl)).size,
            };
          }
        }
      } catch (err: any) {
        console.warn('[QuickRevisionService] LLM generation failed, falling back to direct knowledge extraction:', err.message);
      }
    }

    // 2. Deterministic Grounded Synthesis Fallback
    // Directly synthesizes 4 to 6 concise points from the validated research knowledge
    return this.synthesizeFromKnowledge(topic, knowledgeItems);
  }

  /**
   * Deterministic grounded extraction from validated knowledge items.
   * Guarantees 4-6 concise bullet points with valid source references even when LLM is unavailable.
   */
  public synthesizeFromKnowledge(
    topic: string,
    knowledgeItems: ResearchKnowledgeItem[]
  ): QuickRevisionResult {
    const points: QuickRevisionPoint[] = [];

    // Distinct knowledge concepts
    const seenConcepts = new Set<string>();
    for (const item of knowledgeItems) {
      if (points.length >= 6) break;

      const normConcept = (item.concept || '').toLowerCase().trim();
      if (seenConcepts.has(normConcept) && points.length >= 4) continue;
      seenConcepts.add(normConcept);

      // Clean first sentence of summary for concise bullet
      const cleanSummary = item.summary.trim();
      const firstSentence = cleanSummary.split(/(?<=[.!?])\s+/)[0] || cleanSummary;
      const bulletText = firstSentence.length > 180 ? firstSentence.slice(0, 177) + '...' : firstSentence;

      points.push({
        text: bulletText,
        concept: item.concept,
        sourceUrl: item.sourceUrl,
        sourceTitle: item.sourceTitle,
      });
    }

    // Ensure at least 4 points if possible
    if (points.length < 4 && knowledgeItems.length > points.length) {
      for (const item of knowledgeItems) {
        if (points.length >= 4) break;
        if (!points.some((p) => p.text === item.summary)) {
          points.push({
            text: item.summary,
            concept: item.concept,
            sourceUrl: item.sourceUrl,
            sourceTitle: item.sourceTitle,
          });
        }
      }
    }

    return {
      topic,
      points: points.slice(0, 6),
      groundedSourceCount: new Set(points.map((p) => p.sourceUrl)).size,
    };
  }
}

export const quickRevisionService = new QuickRevisionService();
