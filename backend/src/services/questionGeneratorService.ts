import { ILLMProvider } from './llm/llmProvider';
import { GeminiProvider } from './llm/geminiProvider';
import {
  Question,
  QuestionType,
  GenerateQuestionsRequest,
  GenerateQuestionsResponse,
} from '../types/question';
import { validateAndDeduplicateQuestions } from '../validators/questionValidator';
import { pool } from '../db';
import { ResearchService } from './researchService';

export class QuestionGeneratorService {
  public static mockCandidateQuestions = new Map<string, Question[]>();
  private llmProvider: ILLMProvider;
  private defaultCount: number;

  constructor(llmProvider?: ILLMProvider, defaultCount?: number) {
    this.llmProvider = llmProvider || new GeminiProvider();
    const envCount = process.env.QUESTION_GENERATION_COUNT
      ? parseInt(process.env.QUESTION_GENERATION_COUNT, 10)
      : 30;
    this.defaultCount = defaultCount || envCount || 30;
  }

  public setLLMProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Generates candidate assessment questions grounded strictly in validated research knowledge.
   */
  public async generateQuestions(
    req: GenerateQuestionsRequest
  ): Promise<GenerateQuestionsResponse> {
    const targetCount = req.count || this.defaultCount;

    // 1. Fetch research knowledge & topic data
    let { topicTitle, topicId, researchSessionId, knowledgeItems } =
      await this.fetchKnowledgeForGeneration(req.topicId, req.researchRunId, req.knowledgeItems, req.topicTitle);

    if (!knowledgeItems || knowledgeItems.length === 0) {
      throw new Error(
        `Cannot generate questions: No validated research knowledge found for topicId ${req.topicId || 'default'}. Please run web research first.`
      );
    }

    // 2. Prepare LLM system & user prompts
    const systemPrompt = `You are an expert Computer Science educator and assessment question generator.
Your goal is to generate a candidate pool of ${targetCount} high-quality assessment questions grounded STRICTLY in the provided verified research knowledge for ${topicTitle}.

TARGET AUDIENCE & DIFFICULTY LEVEL:
- Target audience is BEGINNER undergraduate college students who are learning the topic.
- Start from very BASIC, fundamental concepts:
  * What is the concept, its definition, and fundamental principles?
  * What are its core properties (e.g. immutability, zero-based indexing)?
  * Common basic operations & standard methods (e.g., for Strings: length(), charAt(), equals(), concatenation, substring).
  * Simple, beginner DSA patterns (e.g., traversing elements, string reversal, palindrome checking, character counting).
- DO NOT ask overly complex internal trivia, deep low-level memory reallocations, bytecode details, or obscure edge cases unless explicitly requested. Questions must feel encouraging, clear, and foundational for college students.
- Difficulty should be calibrated for beginners (predominantly between 0.20 and 0.45).

CRITICAL RULES:
1. ONLY generate questions for the target topic: ${topicTitle}. Do NOT confuse topics.
2. Every question MUST include "sourceReferences" linking back to the source identifiers or URLs provided in the knowledge.
3. THE 70/30 QUESTION TYPE RULE:
   - Exactly ~70% of the questions MUST be MCQ (Multiple Choice Questions with exactly 4 options and 1 unambiguous correct answer).
   - The remaining ~30% should be descriptive/code formats:
     * CONCEPTUAL: tests basic understanding of definitions and principles
     * OUTPUT_PREDICTION: short 3-5 line beginner code snippet where student predicts output
     * DEBUGGING: short 3-5 line code snippet with a common beginner bug to identify/fix
     * SCENARIO: practical beginner problem or use-case
4. For MCQs: "options" MUST be an array of 4 distinct answer choices, and "correctAnswer" MUST EXACTLY match one of the 4 options verbatim.
5. The "correctAnswer" MUST be 100% factually and conceptually accurate for the exact question asked.
6. Return strictly valid JSON:
{
  "questions": [
    {
      "type": "MCQ",
      "question": "Which method is used to find the number of characters in a Java String?",
      "options": ["length()", "size()", "count()", "getLength()"],
      "correctAnswer": "length()",
      "explanation": "In Java, the length() method returns the number of characters in the String.",
      "difficulty": 0.25,
      "concept": "String Methods",
      "subtopic": "Basic Operations",
      "skills": ["String Basics", "Built-in Methods"],
      "cognitiveLevel": "remember",
      "sourceReferences": ["..."]
    }
  ]
}
No markdown fences. No text outside JSON.`;

    const userPrompt = `Target Topic: ${topicTitle}
Number of questions requested: ${targetCount}

Verified Research Knowledge Evidence:
${knowledgeItems
  .map(
    (k, idx) =>
      `[Knowledge #${idx + 1}] ID: ${k.id} | Concept: ${k.concept} | Subtopic: ${k.subtopic || 'General'}
Summary: ${k.summary}
Source: ${k.source_title} (${k.source_url})`
  )
  .join('\n\n')}

Generate the diverse question pool now adhering strictly to the schema:`;

    // 3. Call LLM Provider
    const response = await this.llmProvider.generateStructuredResponse(systemPrompt, userPrompt);

    let rawQuestions: unknown[] = [];
    if (response && typeof response === 'object') {
      if (Array.isArray((response as any).questions)) {
        rawQuestions = (response as any).questions;
      } else if (Array.isArray(response)) {
        rawQuestions = response;
      }
    }

    if (rawQuestions.length === 0) {
      throw new Error('LLM did not return a valid list of questions.');
    }

    // 4. Validate & Deduplicate
    const validatedQuestions = validateAndDeduplicateQuestions(rawQuestions);

    if (validatedQuestions.length === 0) {
      throw new Error('No generated questions passed structural validation.');
    }

    // 5. Calculate distribution
    const distribution: Record<QuestionType, number> = {
      MCQ: 0,
      OUTPUT_PREDICTION: 0,
      CONCEPTUAL: 0,
      DEBUGGING: 0,
      SCENARIO: 0,
      CODING: 0,
    };

    for (const q of validatedQuestions) {
      if (distribution[q.type] !== undefined) {
        distribution[q.type]++;
      }
    }

    // 6. Persist candidate questions to PostgreSQL and in-memory store
    try {
      await this.persistCandidateQuestions(
        topicId,
        researchSessionId,
        validatedQuestions,
        topicTitle
      );
    } catch (dbErr) {
      console.warn('Failed to persist questions to PostgreSQL:', dbErr);
    }

    return {
      status: 'success',
      topic: topicTitle,
      generatedCount: validatedQuestions.length,
      questions: validatedQuestions,
      distribution,
    };
  }

  /**
   * Generates deterministic, high-quality, topic-grounded assessment questions for any CS topic.
   */
  public generateTopicGroundedQuestions(topicTitle: string, count: number = 8): Question[] {
    const isRest = /rest|api|http|endpoint|web\s*service/i.test(topicTitle);

    if (isRest) {
      return [
        {
          id: QuestionGeneratorService.nextMockQuestionId++,
          type: 'MCQ',
          question: 'According to RFC 7231 HTTP specifications, which of the following HTTP methods is guaranteed to be idempotent?',
          options: [
            'POST',
            'PUT',
            'PATCH (without conditional etags)',
            'CONNECT',
          ],
          correctAnswer: 'PUT',
          explanation: 'PUT replaces the target resource entirely with the request payload. Executing multiple identical PUT requests produces the exact same state on the server as a single request, making it idempotent.',
          difficulty: 0.45,
          concept: 'HTTP Idempotency',
          subtopic: 'HTTP Methods',
          skills: ['REST Design', 'HTTP Protocol'],
          cognitiveLevel: 'understand',
          sourceReferences: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods'],
        },
        {
          id: QuestionGeneratorService.nextMockQuestionId++,
          type: 'CONCEPTUAL',
          question: 'Explain why REST architecture mandates stateless communication between client and server, and analyze how this statelessness property enhances system scalability.',
          options: [],
          correctAnswer: 'Statelessness requires that each request from client to server contains all information necessary to understand and process the request, without the server retaining session context. This allows load balancers to route requests to any server node freely without session stickiness, significantly simplifying horizontal scaling and fault tolerance.',
          explanation: 'Statelessness decouples server memory from client state, enabling horizontal scaling and failure recovery.',
          difficulty: 0.65,
          concept: 'Stateless Architecture',
          subtopic: 'REST Principles',
          skills: ['System Design', 'Architectural Constraints'],
          cognitiveLevel: 'analyze',
          sourceReferences: ['https://restfulapi.net/statelessness/'],
        },
        {
          id: QuestionGeneratorService.nextMockQuestionId++,
          type: 'MCQ',
          question: 'Which HTTP status code should be returned by a REST API when a POST request successfully creates a new resource and includes a Location header pointing to it?',
          options: [
            '200 OK',
            '201 Created',
            '202 Accepted',
            '204 No Content',
          ],
          correctAnswer: '201 Created',
          explanation: 'HTTP 201 Created indicates that the request has succeeded and led to the creation of a new resource, typically accompanied by a Location header in the response.',
          difficulty: 0.35,
          concept: 'HTTP Status Codes',
          subtopic: 'Status Codes & Headers',
          skills: ['API Conventions', 'HTTP Statuses'],
          cognitiveLevel: 'remember',
          sourceReferences: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201'],
        },
        {
          id: QuestionGeneratorService.nextMockQuestionId++,
          type: 'DEBUGGING',
          question: 'An API route is declared as "GET /api/users/delete?id=42". What key architectural violation exists in this route, and how should it be corrected to adhere to REST conventions?',
          options: [],
          correctAnswer: 'Using GET to perform state-mutating actions (like deleting a user) violates the safe method constraint of HTTP GET. In REST, GET must remain read-only and safe. To correct it, the endpoint should use "DELETE /api/users/42".',
          explanation: 'HTTP GET must be safe and idempotent with no server side-effects. Deletions must use the DELETE HTTP verb on the resource URI.',
          difficulty: 0.55,
          concept: 'Safe Methods & URI Design',
          subtopic: 'Endpoint Design',
          skills: ['Code Review', 'REST Anti-patterns'],
          cognitiveLevel: 'analyze',
          sourceReferences: ['https://restfulapi.net/resource-naming/'],
        },
        {
          id: QuestionGeneratorService.nextMockQuestionId++,
          type: 'SCENARIO',
          question: 'When implementing a rate limiter for a public REST API, a client exceeds their quota. What HTTP status code and response header should your API return to inform the client when they can retry?',
          options: [
            '400 Bad Request with "Wait: 60"',
            '403 Forbidden with "Retry-Delay: 60"',
            '429 Too Many Requests with "Retry-After: 60"',
            '503 Service Unavailable with "Timeout: 60"',
          ],
          correctAnswer: '429 Too Many Requests with "Retry-After: 60"',
          explanation: 'RFC 6585 specifies HTTP 429 Too Many Requests for rate limiting, along with the Retry-After header indicating how many seconds to wait before making a new request.',
          difficulty: 0.50,
          concept: 'Rate Limiting & Throttling',
          subtopic: 'API Reliability',
          skills: ['Rate Limiting', 'HTTP Headers'],
          cognitiveLevel: 'apply',
          sourceReferences: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429'],
        },
        {
          id: QuestionGeneratorService.nextMockQuestionId++,
          type: 'MCQ',
          question: 'What is the primary purpose of the HTTP "ETag" response header in RESTful web services?',
          options: [
            'To encrypt the payload for transport security',
            'To provide a unique validator tag for cache revalidation and optimistic concurrency control',
            'To authenticate user sessions across distributed nodes',
            'To specify the MIME type and character encoding of the payload',
          ],
          correctAnswer: 'To provide a unique validator tag for cache revalidation and optimistic concurrency control',
          explanation: 'ETags allow clients and caches to perform conditional requests (using If-None-Match or If-Match) to save bandwidth and prevent lost updates.',
          difficulty: 0.60,
          concept: 'Caching & Concurrency',
          subtopic: 'HTTP Caching',
          skills: ['Caching', 'Concurrency Control'],
          cognitiveLevel: 'understand',
          sourceReferences: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag'],
        },
      ];
    }

    // Generic CS Topic generator strictly grounded in the topic title
    return [
      {
        id: QuestionGeneratorService.nextMockQuestionId++,
        type: 'MCQ',
        question: `What is the fundamental theoretical principle underlying ${topicTitle}?`,
        options: [
          `Deterministic abstraction and standard algorithmic guarantees defined for ${topicTitle}`,
          `Randomized nondeterministic execution without structural guarantees`,
          `Hardware-exclusive execution requiring kernel-level ring 0 permissions`,
          `Unbounded linear space scaling without asymptotic complexity bounds`,
        ],
        correctAnswer: `Deterministic abstraction and standard algorithmic guarantees defined for ${topicTitle}`,
        explanation: `In Computer Science, ${topicTitle} is characterized by rigorous design principles, deterministic constraints, and predictable complexity bounds.`,
        difficulty: 0.45,
        concept: `${topicTitle} Fundamentals`,
        subtopic: 'Core Theory',
        skills: ['Computer Science Foundations'],
        cognitiveLevel: 'understand',
        sourceReferences: ['https://en.wikipedia.org/wiki/Computer_science'],
      },
      {
        id: QuestionGeneratorService.nextMockQuestionId++,
        type: 'CONCEPTUAL',
        question: `Analyze the primary architectural and performance trade-offs encountered when deploying ${topicTitle} in production systems.`,
        options: [],
        correctAnswer: `Designing systems with ${topicTitle} requires balancing time complexity against memory footprint, latency versus throughput, and maintainability versus optimization.`,
        explanation: `Core trade-off evaluation is critical for production software engineering and systems architecture.`,
        difficulty: 0.65,
        concept: `${topicTitle} Trade-offs`,
        subtopic: 'System Architecture',
        skills: ['Systems Engineering', 'Trade-off Analysis'],
        cognitiveLevel: 'analyze',
        sourceReferences: ['https://en.wikipedia.org/wiki/Software_architecture'],
      },
      {
        id: QuestionGeneratorService.nextMockQuestionId++,
        type: 'SCENARIO',
        question: `In a high-throughput microservices environment utilizing ${topicTitle}, an engineer detects an unexpected bottleneck under peak load. What is the recommended diagnosis strategy?`,
        options: [
          'Inspect profiling metrics, analyze critical path complexity, and verify caching and concurrency boundaries',
          'Immediately restart all server clusters without reviewing telemetry',
          'Disable security middleware and remove request logging',
          'Switch to single-threaded sequential execution without benchmarking',
        ],
        correctAnswer: 'Inspect profiling metrics, analyze critical path complexity, and verify caching and concurrency boundaries',
        explanation: 'Data-driven performance profiling and metric analysis is the canonical approach to resolving distributed bottlenecks.',
        difficulty: 0.55,
        concept: `${topicTitle} Reliability & Diagnostics`,
        subtopic: 'Diagnostics & Operations',
        skills: ['Diagnostics', 'Performance Profiling'],
        cognitiveLevel: 'apply',
        sourceReferences: ['https://en.wikipedia.org/wiki/Profiling_(computer_programming)'],
      },
    ];
  }

  /**
   * Fetches research knowledge items from DB or provides context
   */
  public async fetchKnowledgeForGeneration(
    topicId?: number,
    researchRunId?: number,
    directKnowledge?: any[],
    directTitle?: string
  ): Promise<{
    topicTitle: string;
    topicId?: number;
    researchSessionId?: number;
    knowledgeItems: any[];
  }> {
    // 1. Direct knowledge items passed from frontend
    if (directKnowledge && directKnowledge.length > 0) {
      return {
        topicTitle: directTitle || 'Computer Science Topic',
        topicId,
        researchSessionId: researchRunId,
        knowledgeItems: directKnowledge.map((k, idx) => ({
          id: k.id || idx + 1,
          concept: k.concept,
          summary: k.summary,
          subtopic: k.subtopic,
          source_url: k.source_url || k.sourceUrl || 'https://en.wikipedia.org',
          source_title: k.source_title || k.sourceTitle || 'Technical Reference',
        })),
      };
    }

    // 2. Query PostgreSQL if database is active
    try {
      let query: string;
      let params: any[] = [];

      if (researchRunId) {
        query = `
          SELECT s.id as session_id, s.topic_title, s.topic_id,
                 k.id, k.concept, k.summary, k.subtopic, k.source_url, k.source_title
          FROM research_sessions s
          JOIN research_knowledge_items k ON k.session_id = s.id
          WHERE s.id = $1;
        `;
        params = [researchRunId];
      } else if (topicId) {
        query = `
          SELECT s.id as session_id, s.topic_title, s.topic_id,
                 k.id, k.concept, k.summary, k.subtopic, k.source_url, k.source_title
          FROM research_sessions s
          JOIN research_knowledge_items k ON k.session_id = s.id
          WHERE s.topic_id = $1
          ORDER BY s.created_at DESC;
        `;
        params = [topicId];
      } else {
        query = `
          SELECT s.id as session_id, s.topic_title, s.topic_id,
                 k.id, k.concept, k.summary, k.subtopic, k.source_url, k.source_title
          FROM research_sessions s
          JOIN research_knowledge_items k ON k.session_id = s.id
          ORDER BY s.created_at DESC
          LIMIT 20;
        `;
        params = [];
      }

      const res = await pool.query(query, params);
      if (res.rows.length > 0) {
        const firstRow = res.rows[0];
        return {
          topicTitle: firstRow.topic_title,
          topicId: firstRow.topic_id,
          researchSessionId: firstRow.session_id,
          knowledgeItems: res.rows.map((r) => ({
            id: r.id,
            concept: r.concept,
            summary: r.summary,
            subtopic: r.subtopic,
            source_url: r.source_url,
            source_title: r.source_title,
          })),
        };
      }
    } catch (dbErr) {
      console.warn('PostgreSQL query failed in fetchKnowledgeForGeneration, checking in-memory session:', dbErr);
    }

    // 3. Check in-memory research session from ResearchService
    const inMem = ResearchService.getInMemorySession(researchRunId, topicId);
    if (inMem && inMem.knowledge && inMem.knowledge.length > 0) {
      return {
        topicTitle: inMem.topicTitle,
        topicId: inMem.topicId || topicId,
        researchSessionId: inMem.sessionId,
        knowledgeItems: inMem.knowledge.map((k, idx) => ({
          id: idx + 1,
          concept: k.concept,
          summary: k.summary,
          subtopic: k.subtopic,
          source_url: k.sourceUrl,
          source_title: k.sourceTitle,
        })),
      };
    }

    // 4. Fallback if at least topic is known
    return {
      topicTitle: directTitle || inMem?.topicTitle || 'Computer Science Topic',
      topicId,
      researchSessionId: researchRunId,
      knowledgeItems: [],
    };
  }

  private static nextMockQuestionId: number = 100;

  /**
   * Persists valid candidate questions into PostgreSQL and in-memory store
   */
  public async persistCandidateQuestions(
    topicId: number | undefined,
    researchSessionId: number | undefined,
    questions: Question[],
    topicTitle?: string
  ): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const q of questions) {
          const insertRes = await client.query(
            `INSERT INTO candidate_questions (
              topic_id, research_session_id, type, question, options,
              correct_answer, explanation, difficulty, concept, subtopic,
              skills, cognitive_level, source_references, code_snippet, scenario_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id;`,
            [
              topicId || null,
              researchSessionId || null,
              q.type,
              q.question,
              q.options ? JSON.stringify(q.options) : null,
              q.correctAnswer,
              q.explanation,
              q.difficulty,
              q.concept,
              q.subtopic,
              JSON.stringify(q.skills),
              q.cognitiveLevel,
              JSON.stringify(q.sourceReferences),
              (q as any).codeSnippet || null,
              (q as any).scenarioText || null,
            ]
          );

          if (insertRes.rows && insertRes.rows.length > 0) {
            q.id = insertRes.rows[0].id;
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (dbErr) {
      console.warn('PostgreSQL persistCandidateQuestions failed, assigning in-memory IDs:', dbErr);
    }

    // Ensure every single question has a guaranteed unique numeric ID
    for (const q of questions) {
      if (!q.id) {
        q.id = QuestionGeneratorService.nextMockQuestionId++;
      }
    }

    const key = topicId ? String(topicId) : 'default';
    QuestionGeneratorService.mockCandidateQuestions.set(key, questions);
    if (topicTitle) {
      QuestionGeneratorService.mockCandidateQuestions.set(topicTitle.toLowerCase(), questions);
    }
    QuestionGeneratorService.mockCandidateQuestions.set('default', questions);
  }
}

export const questionGeneratorService = new QuestionGeneratorService();
