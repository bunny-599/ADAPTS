import { Request, Response } from 'express';
import { TopicService } from '../services/topicService';
import { analyzeTopic } from '../services/topicAnalyzer';
import { CreateTopicDTO } from '../types/topic';

export class TopicController {
  /**
   * POST /api/topics/analyze
   * Analyzes the topic input and returns a structured breakdown or clarification request.
   */
  public static async analyze(req: Request, res: Response): Promise<void> {
    try {
      const { input } = req.body;

      if (!input || typeof input !== 'string' || input.trim().length === 0) {
        console.warn(`⚠️ Topic analyze request rejected — the input field was empty or missing`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "input" field is required and must be a non-empty string.',
        });
        return;
      }

      console.log(`🤔 Analyzing topic: "${input.trim().substring(0, 80)}" — asking AI to break it down...`);
      const result = await analyzeTopic(input.trim());
      console.log(`✅ Topic analysis done`);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('[TopicController.analyze] Error analyzing topic:', error.message);;

      // Handle missing API key or validation errors
      if (error?.message?.includes('GEMINI_API_KEY is not configured')) {
        res.status(503).json({
          error: 'LLM Service Unavailable',
          message: 'GEMINI_API_KEY is not configured on the server. Please check backend/.env.',
        });
        return;
      }

      if (error?.name === 'ValidationError') {
        res.status(502).json({
          error: 'Invalid Model Output',
          message: 'The AI model returned a response that did not match the expected schema.',
          details: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error?.message || 'Failed to analyze topic.',
      });
    }
  }

  /**
   * POST /api/topics
   * Persists a confirmed (or basic) topic into PostgreSQL.
   */
  public static async createTopic(req: Request, res: Response): Promise<void> {
    try {
      const { input, field, domain, topic, subtopics } = req.body;

      if (!input || typeof input !== 'string' || input.trim().length === 0) {
        console.warn(`⚠️ Topic create rejected — the input field was empty or missing`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "input" field is required and must not be empty.',
        });
        return;
      }

      // If structured fields are provided, validate their types
      if (field !== undefined && typeof field !== 'string') {
        console.warn(`⚠️ Topic create rejected — field must be text`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "field" must be a string if provided.',
        });
        return;
      }

      if (domain !== undefined && typeof domain !== 'string') {
        console.warn(`⚠️ Topic create rejected — domain must be text`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "domain" must be a string if provided.',
        });
        return;
      }

      if (topic !== undefined && typeof topic !== 'string') {
        console.warn(`⚠️ Topic create rejected — topic name must be text`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "topic" must be a string if provided.',
        });
        return;
      }

      if (subtopics !== undefined && !Array.isArray(subtopics)) {
        console.warn(`⚠️ Topic create rejected — subtopics must be a list`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'The "subtopics" must be an array of strings if provided.',
        });
        return;
      }

      const dto: CreateTopicDTO = {
        input: input.trim(),
        field: field ? String(field).trim() : undefined,
        domain: domain ? String(domain).trim() : undefined,
        topic: topic ? String(topic).trim() : undefined,
        subtopics: Array.isArray(subtopics) ? subtopics.map((s) => String(s).trim()) : undefined,
      };

      console.log(`💾 Saving new topic to database: "${dto.input.substring(0, 80)}" | field: ${dto.field} | subtopics: ${dto.subtopics?.length ?? 0}`);

      const newTopic = await TopicService.createTopic(dto);

      console.log(`✅ Topic saved! Got id: ${newTopic?.id ?? 'unknown'}`);
      res.status(201).json(newTopic);
    } catch (error: any) {
      console.error('❌ Could not save topic —', error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create topic in database.',
        details: error?.message,
      });
    }
  }

  /**
   * GET /api/topics
   * Retrieves all saved topics.
   */
  public static async getTopics(_req: Request, res: Response): Promise<void> {
    console.log(`📚 Fetching all saved topics from the database`);
    try {
      const topics = await TopicService.getAllTopics();
      console.log(`✅ Found ${topics.length} topics`);
      res.status(200).json(topics);
    } catch (error: any) {
      console.error('❌ Could not fetch topics —', error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch topics from database.',
        details: error?.message,
      });
    }
  }

  /**
   * GET /api/topics/:topicId
   * Retrieves a topic by its ID.
   */
  public static async getTopicById(req: Request, res: Response): Promise<void> {
    try {
      const topicId = parseInt(req.params.topicId, 10);
      if (isNaN(topicId) || topicId <= 0) {
        console.warn(`⚠️ Get topic rejected — invalid topic ID: "${req.params.topicId}"`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid topicId. Must be a positive integer.',
        });
        return;
      }

      console.log(`🔍 Looking up topic with id: ${topicId}`);
      const topic = await TopicService.getTopicById(topicId);
      if (!topic) {
        console.warn(`⚠️ No topic found with id: ${topicId}`);
        res.status(404).json({
          error: 'Not Found',
          message: `Topic with id ${topicId} not found.`,
        });
        return;
      }

      console.log(`✅ Found topic: "${topic.topic ?? 'N/A'}" (id: ${topicId})`);
      res.status(200).json(topic);
    } catch (error: any) {
      console.error('❌ Could not fetch topic —', error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch topic from database.',
        details: error?.message,
      });
    }
  }
}
