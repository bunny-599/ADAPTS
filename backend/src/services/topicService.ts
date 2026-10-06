import { pool } from '../db';
import { Topic, CreateTopicDTO } from '../types/topic';

export class TopicService {
  private static mockTopics: Topic[] = [];
  private static nextId: number = 1;

  public static async createTopic(dto: CreateTopicDTO): Promise<Topic> {
    const { input, field, domain, topic, subtopics } = dto;

    try {
      const query = `
        INSERT INTO topics (input, field, domain, topic, subtopics)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, input, field, domain, topic, subtopics, created_at;
      `;
      const values = [
        input,
        field || null,
        domain || null,
        topic || null,
        subtopics ? JSON.stringify(subtopics) : null,
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (dbErr) {
      console.warn('PostgreSQL createTopic unavailable, saving topic in-memory:', dbErr);
      const mock: Topic = {
        id: this.nextId++,
        input,
        field: field || null,
        domain: domain || null,
        topic: topic || null,
        subtopics: subtopics || null,
        created_at: new Date().toISOString(),
      };
      this.mockTopics.unshift(mock);
      return mock;
    }
  }

  public static async getAllTopics(): Promise<Topic[]> {
    try {
      const query = `
        SELECT id, input, field, domain, topic, subtopics, created_at
        FROM topics
        ORDER BY created_at DESC;
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (dbErr) {
      console.warn('PostgreSQL getAllTopics unavailable, returning in-memory topics:', dbErr);
      return this.mockTopics;
    }
  }

  public static async getTopicById(id: number): Promise<Topic | null> {
    try {
      const query = `
        SELECT id, input, field, domain, topic, subtopics, created_at
        FROM topics
        WHERE id = $1;
      `;
      const result = await pool.query(query, [id]);
      if (result.rows.length > 0) return result.rows[0];
    } catch (dbErr) {
      console.warn('PostgreSQL getTopicById unavailable, checking in-memory topics:', dbErr);
    }
    const mock = this.mockTopics.find((t) => t.id === id);
    return mock || null;
  }
}
