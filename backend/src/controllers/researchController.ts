import { Request, Response } from 'express';
import { researchService, ResearchService } from '../services/researchService';
import { quickRevisionService } from '../services/quickRevisionService';
import { ResearchTopicDTO } from '../types/research';
import { pool, isDatabaseAvailable } from '../db';

export class ResearchController {
  /**
   * POST /api/research
   * Researches a structured topic using the search provider and extracts verified knowledge
   */
  public static async research(req: Request, res: Response): Promise<void> {
    try {
      const { topic } = req.body;

      if (!topic || typeof topic !== 'object') {
        console.warn(`[ResearchController.research] Validation failed: missing topic object`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "topic" object is required in request body.',
        });
        return;
      }

      if (!topic.topic || typeof topic.topic !== 'string' || topic.topic.trim().length === 0) {
        console.warn(`[ResearchController.research] Validation failed: missing topic.topic string`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "topic.topic" field is required and must not be empty.',
        });
        return;
      }

      const topicDTO: ResearchTopicDTO = {
        id: typeof topic.id === 'number' ? topic.id : undefined,
        field: topic.field ? String(topic.field).trim() : 'Computer Science',
        domain: topic.domain ? String(topic.domain).trim() : 'General',
        topic: String(topic.topic).trim(),
        subtopics: Array.isArray(topic.subtopics)
          ? topic.subtopics.map((s: unknown) => String(s).trim())
          : [],
      };

      console.log(`[ResearchController.research] Starting research | topic="${topicDTO.topic}" | field=${topicDTO.field} | domain=${topicDTO.domain} | subtopics=${topicDTO.subtopics.length}`);

      const result = await researchService.researchTopic(topicDTO);

      console.log(`[ResearchController.research] Research complete | topic="${topicDTO.topic}" | knowledgeItems=${(result as any)?.knowledge?.length ?? 'N/A'} | sources=${(result as any)?.sources?.length ?? 'N/A'}`);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('[ResearchController.research] Error in research endpoint:', error.message);

      if (error?.name === 'SearchProviderError' || error?.message?.includes('Search provider is not configured')) {
        res.status(503).json({
          error: 'Search Service Unavailable',
          message: error.message || 'Search provider is not configured. Please check backend/.env.',
        });
        return;
      }

      if (error?.name === 'ResearchValidationError') {
        res.status(502).json({
          error: 'Invalid Research Output',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to research topic.',
      });
    }
  }

  /**
   * POST /api/research/revision
   * Generates a 4-6 bullet point Quick Revision refresher grounded in research knowledge
   */
  public static async getRevision(req: Request, res: Response): Promise<void> {
    try {
      const topicId = req.params?.topicId || req.body?.topicId;
      const { topicTitle, knowledgeItems } = req.body || {};

      let topic = topicTitle || 'Computer Science Concept';
      let items = Array.isArray(knowledgeItems) ? knowledgeItems : [];

      console.log(`[ResearchController.getRevision] Generating quick revision | topicId=${topicId} | topicTitle="${topic}" | inlineItems=${items.length}`);

      if (items.length === 0 && topicId) {
        // Try to fetch from research sessions
        const session = ResearchService.getInMemorySession(undefined, Number(topicId));
        if (session && session.knowledge) {
          items = session.knowledge;
          topic = session.topicTitle || topic;
          console.log(`[ResearchController.getRevision] Loaded ${items.length} items from in-memory session | topicId=${topicId}`);
        } else if (isDatabaseAvailable()) {
          try {
            const dbRes = await pool.query(
              `SELECT k.concept, k.summary, k.subtopic, k.source_url as "sourceUrl", k.source_title as "sourceTitle",
                      t.topic as "topicTitle"
               FROM research_knowledge_items k
               JOIN research_sessions s ON k.session_id = s.id
               LEFT JOIN topics t ON s.topic_id = t.id
               WHERE s.topic_id = $1
               ORDER BY k.id ASC;`,
              [Number(topicId)]
            );
            if (dbRes.rows.length > 0) {
              items = dbRes.rows;
              if (dbRes.rows[0].topicTitle) topic = dbRes.rows[0].topicTitle;
              console.log(`[ResearchController.getRevision] Loaded ${items.length} items from DB | topicId=${topicId}`);
            }
          } catch (dbErr) {
            console.warn('[ResearchController.getRevision] Failed to load knowledge from DB:', dbErr);
          }
        }
      }

      if (items.length === 0) {
        // Check latest session
        const latest = ResearchService.getInMemorySession();
        if (latest && latest.knowledge) {
          items = latest.knowledge;
          topic = latest.topicTitle || topic;
          console.log(`[ResearchController.getRevision] Loaded ${items.length} items from latest in-memory session`);
        }
      }

      if (items.length === 0) {
        console.warn(`[ResearchController.getRevision] No knowledge items found | topicId=${topicId} | topic="${topic}"`);
        res.status(400).json({
          error: 'Revision Error',
          message: 'No verified research knowledge found to generate Quick Revision. Please run research first.',
        });
        return;
      }

      console.log(`[ResearchController.getRevision] Generating revision with ${items.length} knowledge items | topic="${topic}"`);
      const revision = await quickRevisionService.generateRevision(topic, items);
      console.log(`[ResearchController.getRevision] Revision generated | bulletPoints=${(revision as any)?.bullets?.length ?? 'N/A'}`);
      res.status(200).json({
        status: 'success',
        revision,
      });
    } catch (err: any) {
      console.error('[ResearchController.getRevision] Error generating quick revision:', err.message);
      res.status(500).json({
        error: 'Revision Generation Failed',
        message: err.message || 'Failed to generate Quick Revision.',
      });
    }
  }

  /**
   * GET /api/research/:researchRunId
   * Fetches research run metadata, sources, and knowledge items.
   */
  public static async getResearchRun(req: Request, res: Response): Promise<void> {
    try {
      const runId = parseInt(req.params.researchRunId, 10);
      if (isNaN(runId) || runId <= 0) {
        console.warn(`[ResearchController.getResearchRun] Invalid researchRunId="${req.params.researchRunId}"`);
        res.status(400).json({ error: 'Validation Error', message: 'Invalid researchRunId.' });
        return;
      }

      console.log(`[ResearchController.getResearchRun] Fetching research run | runId=${runId}`);

      if (isDatabaseAvailable()) {
        const sessionRes = await pool.query(
          `SELECT s.id, s.topic_id as "topicId", s.status, s.created_at as "createdAt", t.topic as "topicTitle"
           FROM research_sessions s
           LEFT JOIN topics t ON s.topic_id = t.id
           WHERE s.id = $1`,
          [runId]
        );
        if (sessionRes.rows.length > 0) {
          const session = sessionRes.rows[0];
          const sourcesRes = await pool.query(
            `SELECT id, title, url, domain, authority_score as "authorityScore", credibility
             FROM research_sources WHERE session_id = $1`,
            [runId]
          );
          const knowledgeRes = await pool.query(
            `SELECT id, concept, summary, subtopic, source_url as "sourceUrl", source_title as "sourceTitle"
             FROM research_knowledge_items WHERE session_id = $1`,
            [runId]
          );
          console.log(`[ResearchController.getResearchRun] Found in DB | runId=${runId} | topic="${session.topicTitle}" | sources=${sourcesRes.rows.length} | knowledge=${knowledgeRes.rows.length}`);
          res.status(200).json({
            status: 'success',
            data: {
              ...session,
              sources: sourcesRes.rows,
              knowledge: knowledgeRes.rows,
            },
          });
          return;
        }
      }

      const inMemory = ResearchService.getInMemorySession(runId);
      if (inMemory) {
        console.log(`[ResearchController.getResearchRun] Found in memory | runId=${runId}`);
        res.status(200).json({ status: 'success', data: inMemory });
        return;
      }

      console.warn(`[ResearchController.getResearchRun] Research run not found | runId=${runId}`);
      res.status(404).json({ error: 'Not Found', message: `Research run #${runId} not found.` });
    } catch (err: any) {
      console.error('[ResearchController.getResearchRun] Error fetching research run:', err.message);
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  }
}
