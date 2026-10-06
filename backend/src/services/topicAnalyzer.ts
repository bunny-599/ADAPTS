import { ILLMProvider } from './llm/llmProvider';
import { GeminiProvider } from './llm/geminiProvider';
import { TopicAnalysisResult } from '../types/topic';
import { validateTopicAnalysisOutput } from '../validators/topicValidator';

export const TOPIC_UNDERSTANDING_SYSTEM_PROMPT = `You are a Computer Science topic understanding system for an adaptive assessment platform.
Your task is to analyze a user's natural-language description of something they learned, and identify:
1. Field
2. Domain
3. Topic
4. Relevant subtopics

V1 strictly supports Computer Science only (e.g. Programming, Data Structures, Algorithms, Databases, Operating Systems, Computer Networks, Web Development, Software Engineering, Machine Learning, Artificial Intelligence, Cybersecurity, Cloud Computing, Distributed Systems, Computer Architecture, etc.).

RULES:
1. If the input describes a valid Computer Science concept or skill (even with informal phrasing or specific details like "I studied React hooks especially useState and useEffect"), return a JSON object with:
{
  "status": "success",
  "field": "Computer Science",
  "domain": "<Specific CS Domain, e.g. Data Structures and Algorithms, Web Development, Programming>",
  "topic": "<Canonical Topic Title, e.g. Binary Search Trees, React Hooks>",
  "subtopics": ["<Subtopic 1>", "<Subtopic 2>", ...]
}

2. If the input is genuinely ambiguous (e.g., "I learned trees", "trees", "code"), DO NOT guess blindly. Return:
{
  "status": "clarification_required",
  "message": "<Polite clarifying question, e.g. What kind of trees did you study?>",
  "options": ["<Option 1>", "<Option 2>", "<Option 3>", "<Option 4>", "Other"]
}

3. If the input is clearly NOT Computer Science (e.g., "organic chemistry", "world history", "baking bread"), return:
{
  "status": "invalid",
  "message": "This platform currently supports Computer Science topics only."
}

CRITICAL: Return strictly raw JSON conforming to one of the above 3 schemas. Do NOT include markdown code fences (no \`\`\`json). Do NOT include any explanations outside the JSON.`;

export class TopicAnalyzerService {
  private llmProvider: ILLMProvider;

  constructor(llmProvider?: ILLMProvider) {
    this.llmProvider = llmProvider || new GeminiProvider();
  }

  public setProvider(provider: ILLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Analyzes the user's natural language input using the LLM provider,
   * validates the response structure, and returns safe typed results.
   */
  public async analyzeTopic(input: string): Promise<TopicAnalysisResult> {
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      throw new Error('Input must be a non-empty string.');
    }

    const trimmedInput = input.trim();
    const userPrompt = `User learned: "${trimmedInput}"`;

    try {
      const rawResponse = await this.llmProvider.generateStructuredResponse(
        TOPIC_UNDERSTANDING_SYSTEM_PROMPT,
        userPrompt
      );

      // Validate schema strictly
      return validateTopicAnalysisOutput(rawResponse);
    } catch (llmErr: any) {
      console.warn('[TopicAnalyzer] LLM error, using deterministic CS topic fallback:', llmErr.message);
      return this.fallbackDecomposition(trimmedInput);
    }
  }

  private fallbackDecomposition(input: string): TopicAnalysisResult {
    const lower = input.toLowerCase();

    // 1. Non-CS check
    const nonCS = ['chemistry', 'biology', 'history', 'baking', 'cooking', 'recipe', 'geography', 'gardening'];
    if (nonCS.some((word) => lower.includes(word))) {
      return {
        status: 'invalid',
        message: 'This platform currently supports Computer Science topics only.',
      };
    }

    // 2. Ambiguity check (Section 7)
    if (lower === 'trees' || lower === 'tree' || lower === 'i learned trees' || lower === 'data structures') {
      return {
        status: 'clarification_required',
        message: 'Which type of tree did you learn?',
        options: ['Binary Tree', 'Binary Search Tree', 'AVL Tree', 'B-Tree', 'Tree Traversals'],
      };
    }

    // 3. Known CS Concepts
    if (lower.includes('binary search tree') || lower.includes('bst')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Data Structures and Algorithms',
        topic: 'Binary Search Trees',
        subtopics: ['Search', 'Insertion', 'Deletion', 'Traversal', 'Time Complexity'],
      };
    }

    if (lower.includes('linear search')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Algorithms',
        topic: 'Linear Search',
        subtopics: ['Sequential Scan', 'Best Case O(1)', 'Worst Case O(N)', 'Space Complexity'],
      };
    }

    if (lower.includes('binary search')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Algorithms',
        topic: 'Binary Search',
        subtopics: ['Divide and Conquer', 'Sorted Arrays', 'Logarithmic Time', 'Boundary Cases'],
      };
    }

    if (lower.includes('react') || lower.includes('hook')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Web Development',
        topic: 'React Hooks',
        subtopics: ['useState', 'useEffect', 'useContext', 'useMemo', 'Custom Hooks'],
      };
    }

    if (lower.includes('python') || lower.includes('decorator')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Programming Languages',
        topic: 'Python Decorators',
        subtopics: ['Function Wrappers', 'Higher-Order Functions', 'functools.wraps', 'Arguments Passing'],
      };
    }

    if (lower.includes('sql') || lower.includes('join')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Database Systems',
        topic: 'SQL Joins',
        subtopics: ['Inner Join', 'Left Join', 'Right Join', 'Full Outer Join', 'Query Optimization'],
      };
    }

    if (lower.includes('rest') || lower.includes('api')) {
      return {
        status: 'success',
        field: 'Computer Science',
        domain: 'Software Engineering',
        topic: 'REST APIs',
        subtopics: ['HTTP Methods', 'Status Codes', 'Statelessness', 'JSON Payload Design'],
      };
    }

    // Canonical CS Fallback
    const capitalizedTopic = input.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      status: 'success',
      field: 'Computer Science',
      domain: 'Computer Science',
      topic: capitalizedTopic,
      subtopics: ['Core Concepts', 'Implementation Details', 'Time & Space Complexity', 'Best Practices'],
    };
  }
}

// Default singleton instance
export const topicAnalyzer = new TopicAnalyzerService();

// Exported high-level function
export async function analyzeTopic(input: string): Promise<TopicAnalysisResult> {
  return topicAnalyzer.analyzeTopic(input);
}
