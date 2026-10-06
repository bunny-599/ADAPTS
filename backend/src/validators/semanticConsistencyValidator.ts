import { Question } from '../types/question';
import { ILLMProvider } from '../services/llm/llmProvider';

export interface QuestionAnswerConsistencyResult {
  questionAnswerConsistency: boolean;
  confidence: number;
  reason?: string;
  issues: string[];
}

export class SemanticConsistencyValidator {
  /**
   * Deterministic domain semantic analysis evaluating:
   * 1. Operational mechanism mismatches (e.g. Linear Search vs Binary Search)
   * 2. Qualifier & Complexity mismatches (e.g. best-case O(1) vs worst-case O(N))
   * 3. Traversal data structures (BFS -> Queue vs DFS -> Stack/Recursion)
   * 4. Abstract data type ordering (Stack -> LIFO vs Queue -> FIFO)
   */
  public static validateConsistency(
    question: Question,
    _context: { knowledge?: any[]; llmProvider?: ILLMProvider } = {}
  ): QuestionAnswerConsistencyResult {
    const qText = (question.question || '').toLowerCase();
    const ansText = (question.correctAnswer || '').toLowerCase();

    // 1. Complexity Qualifier Check (Best-case vs Worst-case vs Average-case)
    const complexityResult = this.checkComplexityQualifiers(qText, ansText);
    if (complexityResult) {
      return complexityResult;
    }

    // 2. Algorithm Operational Mechanism Check (Linear Search vs Binary Search)
    const searchResult = this.checkSearchMechanisms(qText, ansText);
    if (searchResult) {
      return searchResult;
    }

    // 3. Traversal Data Structure Check (BFS vs DFS)
    const traversalResult = this.checkTraversalMechanisms(qText, ansText);
    if (traversalResult) {
      return traversalResult;
    }

    // 4. Data Structure Order Discipline Check (Stack vs Queue)
    const dsResult = this.checkDataStructureOrders(qText, ansText);
    if (dsResult) {
      return dsResult;
    }

    // Default PASS for consistent or unflagged items
    return {
      questionAnswerConsistency: true,
      confidence: 0.95,
      issues: [],
    };
  }

  /**
   * Asynchronous validation with LLM review when needed.
   */
  public static async validateConsistencyAsync(
    question: Question,
    context: { knowledge?: any[]; llmProvider?: ILLMProvider } = {}
  ): Promise<QuestionAnswerConsistencyResult> {
    // First run the deterministic semantic rules
    const fastCheck = this.validateConsistency(question, context);
    if (!fastCheck.questionAnswerConsistency) {
      return fastCheck;
    }

    // If an LLM provider is provided and active, run semantic validation for conceptual questions
    if (context.llmProvider && context.llmProvider.isConfigured?.()) {

      try {
        const systemPrompt = `You are an expert Computer Science question-answer semantic consistency validator.
Analyze whether the proposed correctAnswer is factually and conceptually accurate for the exact question asked.

CRITICAL RULES:
1. Detect concept mismatches (e.g. describing binary search when linear search was asked).
2. Detect qualifier mismatches (e.g. giving worst-case complexity when best-case was asked).
3. Do NOT rewrite the question or alter the correct answer.
4. Return strictly valid JSON:
{
  "consistent": true,
  "confidence": 0.95,
  "reason": "The answer accurately addresses the question.",
  "issues": []
}
Or if inconsistent:
{
  "consistent": false,
  "confidence": 0.99,
  "reason": "The proposed answer describes binary search rather than linear search.",
  "issues": ["concept_mismatch", "correct_answer_mismatch"]
}`;

        const userPrompt = `Question: "${question.question}"
Options: ${JSON.stringify(question.options || [])}
Proposed Correct Answer: "${question.correctAnswer}"
Explanation: "${question.explanation || ''}"
Concept: "${question.concept || ''}"
Subtopic: "${question.subtopic || ''}"

Validate semantic question-answer consistency now:`;

        const response: any = await context.llmProvider.generateStructuredResponse(systemPrompt, userPrompt);
        if (response && typeof response.consistent === 'boolean') {
          return {
            questionAnswerConsistency: response.consistent,
            confidence: typeof response.confidence === 'number' ? response.confidence : 0.9,
            reason: response.reason,
            issues: Array.isArray(response.issues) ? response.issues : (response.consistent ? [] : ['concept_mismatch']),
          };
        }
      } catch (err: any) {
        // Fall back gracefully to deterministic check result
      }
    }

    return fastCheck;
  }

  /**
   * Checks complexity qualifiers such as best-case vs worst-case
   */
  private static checkComplexityQualifiers(
    qText: string,
    ansText: string
  ): QuestionAnswerConsistencyResult | null {
    const isComplexityQuestion =
      qText.includes('complexity') ||
      qText.includes('time') ||
      qText.includes('running time') ||
      qText.includes('efficiency');

    if (!isComplexityQuestion) return null;

    const hasBestCase =
      qText.includes('best-case') ||
      qText.includes('best case') ||
      qText.includes('minimum time') ||
      qText.includes('fastest') ||
      qText.includes('minimum number of comparisons');

    const hasWorstCase =
      qText.includes('worst-case') ||
      qText.includes('worst case') ||
      qText.includes('maximum time') ||
      qText.includes('slowest') ||
      qText.includes('maximum number of comparisons');

    // --- Linear Search Complexity ---
    if (qText.includes('linear search') || qText.includes('sequential search')) {
      if (hasBestCase) {
        // Linear search best-case is O(1)
        const claimsLinear =
          ansText === 'o(n)' ||
          ansText === 'o(n)' ||
          ansText.includes('o(n)') ||
          ansText.includes('linear') ||
          ansText.includes('order n');

        if (claimsLinear && !ansText.includes('o(1)')) {
          return {
            questionAnswerConsistency: false,
            confidence: 0.99,
            reason: 'O(N) is the worst-case complexity for linear search; best-case complexity is O(1) when the target is at the first position.',
            issues: ['qualifier_mismatch', 'complexity_mismatch', 'correct_answer_mismatch'],
          };
        }

        if (ansText.includes('o(1)') || ansText.includes('constant')) {
          return {
            questionAnswerConsistency: true,
            confidence: 0.99,
            issues: [],
          };
        }
      }

      if (hasWorstCase) {
        // Linear search worst-case is O(N)
        const claimsConstant =
          ansText === 'o(1)' ||
          ansText.includes('o(1)') ||
          ansText.includes('constant');

        if (claimsConstant && !ansText.includes('o(n)')) {
          return {
            questionAnswerConsistency: false,
            confidence: 0.99,
            reason: 'O(1) is the best-case complexity; worst-case complexity for linear search is O(N) when the target is at the end or absent.',
            issues: ['qualifier_mismatch', 'complexity_mismatch', 'correct_answer_mismatch'],
          };
        }

        if (ansText.includes('o(n)') || ansText.includes('linear')) {
          return {
            questionAnswerConsistency: true,
            confidence: 0.99,
            issues: [],
          };
        }
      }
    }

    // --- Binary Search Complexity ---
    if (qText.includes('binary search')) {
      if (hasBestCase) {
        // Best case of binary search is O(1) (target found on first comparison)
        const claimsLogOrLinear =
          ansText.includes('o(log n)') ||
          ansText.includes('o(logn)') ||
          ansText.includes('o(n)');

        if (claimsLogOrLinear && !ansText.includes('o(1)')) {
          return {
            questionAnswerConsistency: false,
            confidence: 0.99,
            reason: 'O(log N) is the worst/average-case complexity for binary search; best-case complexity is O(1) when the target is at the midpoint.',
            issues: ['qualifier_mismatch', 'complexity_mismatch', 'correct_answer_mismatch'],
          };
        }
      }

      if (hasWorstCase) {
        // Worst case of binary search is O(log N)
        const claimsConstant = ansText.includes('o(1)') && !ansText.includes('o(log');
        if (claimsConstant) {
          return {
            questionAnswerConsistency: false,
            confidence: 0.99,
            reason: 'O(1) is the best-case complexity for binary search; worst-case complexity is O(log N).',
            issues: ['qualifier_mismatch', 'complexity_mismatch', 'correct_answer_mismatch'],
          };
        }
      }
    }

    return null;
  }

  /**
   * Checks algorithm operational mechanisms (Linear Search vs Binary Search)
   */
  private static checkSearchMechanisms(
    qText: string,
    ansText: string
  ): QuestionAnswerConsistencyResult | null {
    const isLinearSearchQ =
      qText.includes('linear search') || qText.includes('sequential search');
    const isBinarySearchQ = qText.includes('binary search');

    // Describing Binary Search attributes
    const describesBinarySearch =
      ansText.includes('divides the collection in half') ||
      ansText.includes('divide the collection in half') ||
      ansText.includes('divides the search space') ||
      ansText.includes('divide the search space') ||
      ansText.includes('dividing in half') ||
      ansText.includes('repeatedly halves') ||
      ansText.includes('halves the search space') ||
      ansText.includes('halved') ||
      ansText.includes('logarithmic probe') ||
      (ansText.includes('sorts the collection first') && !isBinarySearchQ);

    // Describing Linear Search attributes
    const describesLinearSearch =
      ansText.includes('checks each element sequentially') ||
      ansText.includes('checks elements sequentially') ||
      ansText.includes('examines each element sequentially') ||
      ansText.includes('examines elements sequentially') ||
      ansText.includes('one by one from beginning to end') ||
      ansText.includes('one by one until') ||
      ansText.includes('sequential examination') ||
      ansText.includes('checks each element one by one');

    // Case 1: Question asks for Linear Search mechanism, but answer describes Binary Search
    if (isLinearSearchQ && describesBinarySearch) {
      return {
        questionAnswerConsistency: false,
        confidence: 0.99,
        reason: 'The proposed answer describes binary search while the question asks about linear search.',
        issues: ['concept_mismatch', 'correct_answer_mismatch'],
      };
    }

    // Case 2: Question asks for Binary Search mechanism, but answer describes Linear Search
    if (isBinarySearchQ && describesLinearSearch) {
      return {
        questionAnswerConsistency: false,
        confidence: 0.99,
        reason: 'The proposed answer describes linear search while the question asks about binary search.',
        issues: ['concept_mismatch', 'correct_answer_mismatch'],
      };
    }

    // Valid confirmations
    if (isLinearSearchQ && describesLinearSearch) {
      return {
        questionAnswerConsistency: true,
        confidence: 0.99,
        issues: [],
      };
    }

    if (isBinarySearchQ && describesBinarySearch) {
      return {
        questionAnswerConsistency: true,
        confidence: 0.99,
        issues: [],
      };
    }

    return null;
  }

  /**
   * Checks traversal mechanisms and underlying data structures (BFS vs DFS)
   */
  private static checkTraversalMechanisms(
    qText: string,
    ansText: string
  ): QuestionAnswerConsistencyResult | null {
    const isBFSQuestion =
      qText.includes('breadth-first search') ||
      qText.includes('breadth first search') ||
      /\bbfs\b/.test(qText);

    const isDFSQuestion =
      qText.includes('depth-first search') ||
      qText.includes('depth first search') ||
      /\bdfs\b/.test(qText);

    const isDataStructureQuery =
      qText.includes('data structure') ||
      qText.includes('mechanism') ||
      qText.includes('uses') ||
      qText.includes('implemented with') ||
      qText.includes('implemented using');

    if (!isDataStructureQuery) return null;

    if (isBFSQuestion) {
      // BFS requires a Queue (FIFO)
      const mentionsStack =
        (ansText.includes('stack') || ansText.includes('lifo')) &&
        !ansText.includes('queue');

      if (mentionsStack) {
        return {
          questionAnswerConsistency: false,
          confidence: 0.99,
          reason: 'BFS requires a queue (FIFO), not a stack or recursion.',
          issues: ['concept_mismatch', 'data_structure_mismatch'],
        };
      }

      if (ansText.includes('queue') || ansText.includes('fifo')) {
        return {
          questionAnswerConsistency: true,
          confidence: 0.99,
          issues: [],
        };
      }
    }

    if (isDFSQuestion) {
      // DFS requires a Stack or recursion (LIFO)
      const mentionsQueue =
        (ansText.includes('queue') || ansText.includes('fifo')) &&
        !ansText.includes('stack') &&
        !ansText.includes('recursion');

      if (mentionsQueue) {
        return {
          questionAnswerConsistency: false,
          confidence: 0.99,
          reason: 'DFS uses a stack or recursion (LIFO), not a queue.',
          issues: ['concept_mismatch', 'data_structure_mismatch'],
        };
      }

      if (ansText.includes('stack') || ansText.includes('recursion') || ansText.includes('lifo')) {
        return {
          questionAnswerConsistency: true,
          confidence: 0.99,
          issues: [],
        };
      }
    }

    return null;
  }

  /**
   * Checks fundamental data structure ordering (Stack -> LIFO vs Queue -> FIFO)
   */
  private static checkDataStructureOrders(
    qText: string,
    ansText: string
  ): QuestionAnswerConsistencyResult | null {
    const isStackQuery = /\bstack\b/.test(qText) && (qText.includes('order') || qText.includes('principle') || qText.includes('discipline') || qText.includes('operation'));
    const isQueueQuery = /\bqueue\b/.test(qText) && (qText.includes('order') || qText.includes('principle') || qText.includes('discipline') || qText.includes('operation'));

    if (isStackQuery) {
      // Stack MUST be LIFO
      if (ansText.includes('fifo') || ansText.includes('first-in, first-out') || ansText.includes('first-in first-out')) {
        return {
          questionAnswerConsistency: false,
          confidence: 0.99,
          reason: 'A stack operates on LIFO (Last-In, First-Out), not FIFO.',
          issues: ['concept_mismatch', 'property_mismatch'],
        };
      }

      if (ansText.includes('lifo') || ansText.includes('last-in, first-out') || ansText.includes('last-in first-out')) {
        return {
          questionAnswerConsistency: true,
          confidence: 0.99,
          issues: [],
        };
      }
    }

    if (isQueueQuery) {
      // Queue MUST be FIFO
      if (ansText.includes('lifo') || ansText.includes('last-in, first-out') || ansText.includes('last-in first-out')) {
        return {
          questionAnswerConsistency: false,
          confidence: 0.99,
          reason: 'A queue operates on FIFO (First-In, First-Out), not LIFO.',
          issues: ['concept_mismatch', 'property_mismatch'],
        };
      }

      if (ansText.includes('fifo') || ansText.includes('first-in, first-out') || ansText.includes('first-in first-out')) {
        return {
          questionAnswerConsistency: true,
          confidence: 0.99,
          issues: [],
        };
      }
    }

    return null;
  }
}
