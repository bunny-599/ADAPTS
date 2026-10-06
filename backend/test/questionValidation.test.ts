import assert from 'node:assert/strict';
import { QuestionValidationEngine } from '../src/services/questionValidationEngine';
import { Question } from '../src/types/question';

console.log('Running Question Validation Engine Test Suite...');

let passed = 0;
let total = 0;

function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return (result as Promise<void>)
        .then(() => {
          console.log(`✓ PASS: ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(`✗ FAIL: ${name}`);
          console.error(err.message);
        });
    } else {
      console.log(`✓ PASS: ${name}`);
      passed++;
    }
  } catch (error: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(error.message);
  }
}

const engine = new QuestionValidationEngine();

const validQuestion: Question = {
  type: 'MCQ',
  question: 'What is the primary purpose of the useEffect hook in React functional components?',
  options: [
    'To perform side effects such as data fetching and subscriptions',
    'To store and persist component local state across renders',
    'To optimize calculations by memoizing expensive function return values',
    'To create reference objects that persist for the full component lifetime',
  ],
  correctAnswer: 'To perform side effects such as data fetching and subscriptions',
  explanation: 'useEffect is designed specifically to execute side effects after rendering completes.',
  difficulty: 0.45,
  concept: 'useEffect',
  subtopic: 'useEffect',
  skills: ['React Hooks', 'Side Effects'],
  cognitiveLevel: 'understand',
  sourceReferences: ['https://react.dev/reference/react/useEffect'],
};

async function runValidationTests() {
  // 1. Valid question receives VALID status and high quality score
  test('Valid question receives VALID status and high quality score (>= 0.85)', () => {
    const res = engine.validateSingleQuestion(validQuestion, 0, new Map(), {
      validKnowledgeUrls: new Set(['https://react.dev/reference/react/useEffect']),
      knownSubtopics: new Set(['useEffect', 'useState']),
    });

    assert.equal(res.status, 'VALID');
    assert.ok(res.qualityScore >= 0.85);
    assert.equal(res.issues.length, 0);
    assert.equal(res.metrics.structuralScore, 1.0);
    assert.equal(res.metrics.distractorScore, 1.0);
  });

  // 2. Missing correct answer is classified as INVALID
  test('Missing correct answer results in INVALID status and error issue', () => {
    const invalidQ: Question = { ...validQuestion, correctAnswer: '' };
    const res = engine.validateSingleQuestion(invalidQ, 0, new Map(), {});

    assert.equal(res.status, 'INVALID');
    assert.ok(res.issues.some((i) => i.code === 'MISSING_CORRECT_ANSWER'));
  });

  // 3. MCQ correctAnswer not in options is classified as INVALID
  test('MCQ answer not present in options list is classified as INVALID', () => {
    const invalidQ: Question = {
      ...validQuestion,
      correctAnswer: 'Completely unlisted answer',
    };
    const res = engine.validateSingleQuestion(invalidQ, 0, new Map(), {});

    assert.equal(res.status, 'INVALID');
    assert.ok(res.issues.some((i) => i.code === 'CORRECT_ANSWER_NOT_IN_OPTIONS'));
  });

  // 4. Duplicate options in MCQ triggers INVALID status
  test('Duplicate options in MCQ flagged with DUPLICATE_OPTIONS', () => {
    const invalidQ: Question = {
      ...validQuestion,
      options: [
        'To perform side effects such as data fetching and subscriptions',
        'Duplicate option text here',
        'Duplicate option text here',
        'To create reference objects that persist for the full component lifetime',
      ],
    };
    const res = engine.validateSingleQuestion(invalidQ, 0, new Map(), {});

    assert.equal(res.status, 'INVALID');
    assert.ok(res.issues.some((i) => i.code === 'DUPLICATE_OPTIONS'));
  });

  // 5. Trivial distractors (All of the above) causes FLAGGED status
  test('Trivial distractors (e.g. "All of the above") generates warning', () => {
    const flaggedQ: Question = {
      ...validQuestion,
      options: [
        'To perform side effects such as data fetching and subscriptions',
        'To store component state',
        'To create references',
        'All of the above',
      ],
    };
    const res = engine.validateSingleQuestion(flaggedQ, 0, new Map(), {});

    assert.ok(res.status === 'FLAGGED' || res.status === 'INVALID');
    assert.ok(res.issues.some((i) => i.code === 'TRIVIAL_DISTRACTOR'));
  });

  // 6. Ambiguous question phrasing detection
  test('Ambiguous question phrasing triggers AMBIGUOUS_QUESTION_PHRASING warning', () => {
    const ambiguousQ: Question = {
      ...validQuestion,
      question: 'Which of the following is true or false regarding hooks in React apps?',
    };
    const res = engine.validateSingleQuestion(ambiguousQ, 0, new Map(), {});

    assert.ok(res.issues.some((i) => i.code === 'AMBIGUOUS_QUESTION_PHRASING'));
  });

  // 7. Contradictory explanation detection
  test('Explanation contradicting the correct answer triggers EXPLANATION_CONTRADICTS_ANSWER', () => {
    const contradictoryQ: Question = {
      ...validQuestion,
      correctAnswer: 'Redux',
      options: ['Redux', 'Context API', 'MobX', 'Zustand'],
      explanation: 'Redux is incorrect because it is not built into React core.',
    };
    const res = engine.validateSingleQuestion(contradictoryQ, 0, new Map(), {});

    assert.equal(res.status, 'INVALID');
    assert.ok(res.issues.some((i) => i.code === 'EXPLANATION_CONTRADICTS_ANSWER'));
  });

  // 8. Missing source references check
  test('Missing source references results in INVALID status', () => {
    const unsourcedQ: Question = { ...validQuestion, sourceReferences: [] };
    const res = engine.validateSingleQuestion(unsourcedQ, 0, new Map(), {});

    assert.equal(res.status, 'INVALID');
    assert.ok(res.issues.some((i) => i.code === 'MISSING_SOURCE_REFERENCE'));
  });

  // 9. Unrecognized subtopic warning
  test('Subtopic not aligned with recognized topic triggers POOR_SUBTOPIC_ALIGNMENT warning', () => {
    const misalignedQ: Question = {
      ...validQuestion,
      subtopic: 'Quantum Physics Engine',
    };
    const res = engine.validateSingleQuestion(misalignedQ, 0, new Map(), {
      knownSubtopics: new Set(['useState', 'useEffect']),
    });

    assert.ok(res.issues.some((i) => i.code === 'POOR_SUBTOPIC_ALIGNMENT'));
  });

  // 10. Pool validation separates into VALID, FLAGGED, and INVALID with correct summary
  test('Pool validation categorizes pool into VALID, FLAGGED, and INVALID pools accurately', () => {
    const poolQuestions: Question[] = [
      validQuestion, // VALID
      {
        ...validQuestion,
        question: 'What is another valid question text that is long enough to pass?',
      }, // VALID
      {
        ...validQuestion,
        question: 'Which of the following is true or false regarding hooks in React?', // FLAGGED
      },
      {
        ...validQuestion,
        correctAnswer: 'Missing from options completely', // INVALID
      },
    ];

    const result = engine.validatePool(poolQuestions, {
      knownSubtopics: new Set(['useEffect', 'useState']),
    });

    assert.equal(result.summary.totalAnalyzed, 4);
    assert.equal(result.summary.validCount, 2);
    assert.equal(result.summary.flaggedCount, 1);
    assert.equal(result.summary.invalidCount, 1);
    assert.equal(result.validQuestions.length, 2);
    assert.equal(result.flaggedQuestions.length, 1);
    assert.equal(result.invalidQuestions.length, 1);
  });

  // ==========================================================
  // Trial 13.1 Question-Answer Semantic Consistency Regression Tests
  // ==========================================================

  // TEST 1: Linear search checks elements sequentially -> PASS
  test('TEST 1: Primary mechanism of linear search checks elements sequentially -> PASS', () => {
    const q: Question = {
      type: 'MCQ',
      question: 'What is the primary operational mechanism of a linear search algorithm?',
      options: [
        'It checks each element sequentially until the target is found or the collection is exhausted.',
        'It divides the collection in half repeatedly until the target is isolated.',
        'It hashes elements for O(1) direct bucket lookup.',
        'It constructs a balanced binary search tree first.',
      ],
      correctAnswer: 'It checks each element sequentially until the target is found or the collection is exhausted.',
      explanation: 'Linear search iterates sequentially through elements from beginning to end.',
      difficulty: 0.3,
      concept: 'Linear Search',
      subtopic: 'Searching Algorithms',
      skills: ['Linear Search'],
      cognitiveLevel: 'understand',
      sourceReferences: ['https://example.com/linear-search'],
    };

    const res = engine.validateSingleQuestion(q, 0, new Map(), {});
    assert.equal(res.status, 'VALID');
    assert.equal(res.questionAnswerConsistency?.questionAnswerConsistency, true);
  });

  // TEST 2: Linear search claimed to divide collection in half -> FAIL
  test('TEST 2: Primary mechanism of linear search claimed to divide in half -> FAIL', () => {
    const q: Question = {
      type: 'MCQ',
      question: 'What is the primary operational mechanism of a linear search algorithm?',
      options: [
        'It checks each element sequentially until the target is found or the collection is exhausted.',
        'It divides the collection in half repeatedly until the target is isolated.',
        'It hashes elements for direct access.',
        'It builds a heap.',
      ],
      correctAnswer: 'It divides the collection in half repeatedly until the target is isolated.',
      explanation: 'Dividing the space repeatedly in half.',
      difficulty: 0.3,
      concept: 'Linear Search',
      subtopic: 'Searching Algorithms',
      skills: ['Linear Search'],
      cognitiveLevel: 'understand',
      sourceReferences: ['https://example.com/linear-search'],
    };

    const res = engine.validateSingleQuestion(q, 0, new Map(), {});
    assert.equal(res.status, 'INVALID');
    assert.equal(res.questionAnswerConsistency?.questionAnswerConsistency, false);
    assert.ok(res.questionAnswerConsistency?.reason?.includes('describes binary search'));
    assert.ok(res.issues.some((i) => i.code === 'QUESTION_ANSWER_INCONSISTENCY'));
  });

  // TEST 3: Best-case time complexity of linear search is O(1) -> PASS
  test('TEST 3: Best-case time complexity of linear search is O(1) -> PASS', () => {
    const q: Question = {
      type: 'MCQ',
      question: 'What is the best-case time complexity of a linear search?',
      options: ['O(1)', 'O(N)', 'O(log N)', 'O(N^2)'],
      correctAnswer: 'O(1)',
      explanation: 'Best case occurs when target is located at the first index.',
      difficulty: 0.25,
      concept: 'Linear Search Complexity',
      subtopic: 'Searching Algorithms',
      skills: ['Complexity Analysis'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/linear-search'],
    };

    const res = engine.validateSingleQuestion(q, 0, new Map(), {});
    assert.equal(res.status, 'VALID');
    assert.equal(res.questionAnswerConsistency?.questionAnswerConsistency, true);
  });

  // TEST 4: Worst-case time complexity of linear search is O(N) -> PASS
  test('TEST 4: Worst-case time complexity of linear search is O(N) -> PASS', () => {
    const q: Question = {
      type: 'MCQ',
      question: 'What is the worst-case time complexity of a linear search?',
      options: ['O(1)', 'O(N)', 'O(log N)', 'O(N^2)'],
      correctAnswer: 'O(N)',
      explanation: 'Worst case occurs when target is at the last index or absent.',
      difficulty: 0.25,
      concept: 'Linear Search Complexity',
      subtopic: 'Searching Algorithms',
      skills: ['Complexity Analysis'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/linear-search'],
    };

    const res = engine.validateSingleQuestion(q, 0, new Map(), {});
    assert.equal(res.status, 'VALID');
    assert.equal(res.questionAnswerConsistency?.questionAnswerConsistency, true);
  });

  // TEST 5: Best-case time complexity of linear search claimed to be O(N) -> FAIL
  test('TEST 5: Best-case time complexity of linear search claimed to be O(N) -> FAIL', () => {
    const q: Question = {
      type: 'MCQ',
      question: 'What is the best-case time complexity of a linear search?',
      options: ['O(1)', 'O(N)', 'O(log N)', 'O(N^2)'],
      correctAnswer: 'O(N)',
      explanation: 'It must examine elements.',
      difficulty: 0.25,
      concept: 'Linear Search Complexity',
      subtopic: 'Searching Algorithms',
      skills: ['Complexity Analysis'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/linear-search'],
    };

    const res = engine.validateSingleQuestion(q, 0, new Map(), {});
    assert.equal(res.status, 'INVALID');
    assert.equal(res.questionAnswerConsistency?.questionAnswerConsistency, false);
    assert.ok(res.questionAnswerConsistency?.reason?.includes('worst-case complexity'));
    assert.ok(res.issues.some((i) => i.code === 'QUESTION_ANSWER_INCONSISTENCY'));
  });

  // TEST 6: Binary search repeatedly divides search space in half -> PASS
  test('TEST 6: Primary mechanism of binary search repeatedly divides search space in half -> PASS', () => {
    const q: Question = {
      type: 'MCQ',
      question: 'What is the primary mechanism of binary search?',
      options: [
        'It repeatedly divides the search space approximately in half.',
        'It checks each element sequentially from beginning to end.',
        'It uses a hash table for key lookups.',
        'It randomly samples items.',
      ],
      correctAnswer: 'It repeatedly divides the search space approximately in half.',
      explanation: 'Binary search halves search interval each iteration on sorted arrays.',
      difficulty: 0.35,
      concept: 'Binary Search',
      subtopic: 'Searching Algorithms',
      skills: ['Binary Search'],
      cognitiveLevel: 'understand',
      sourceReferences: ['https://example.com/binary-search'],
    };

    const res = engine.validateSingleQuestion(q, 0, new Map(), {});
    assert.equal(res.status, 'VALID');
    assert.equal(res.questionAnswerConsistency?.questionAnswerConsistency, true);
  });

  // Traversal & Data Structure Semantic Tests
  test('BFS requires Queue -> PASS; BFS with Stack -> FAIL', () => {
    const passQ: Question = {
      type: 'MCQ',
      question: 'Which data structure is primarily used to implement breadth-first search (BFS)?',
      options: ['Queue', 'Stack', 'Priority Queue', 'Disjoint Set'],
      correctAnswer: 'Queue',
      explanation: 'BFS uses a FIFO queue to explore nodes level-by-level.',
      difficulty: 0.3,
      concept: 'BFS',
      subtopic: 'Graph Traversal',
      skills: ['BFS', 'Queue'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/bfs'],
    };
    assert.equal(engine.validateSingleQuestion(passQ, 0, new Map(), {}).status, 'VALID');

    const failQ: Question = { ...passQ, correctAnswer: 'Stack' };
    const failRes = engine.validateSingleQuestion(failQ, 0, new Map(), {});
    assert.equal(failRes.status, 'INVALID');
    assert.equal(failRes.questionAnswerConsistency?.questionAnswerConsistency, false);
    assert.ok(failRes.questionAnswerConsistency?.reason?.includes('queue (FIFO)'));
  });

  test('DFS requires Stack/recursion -> PASS; DFS with Queue -> FAIL', () => {
    const passQ: Question = {
      type: 'MCQ',
      question: 'What data structure or mechanism is primarily used to implement depth-first search (DFS)?',
      options: ['Stack or recursion', 'Queue', 'Hash Table', 'B-Tree'],
      correctAnswer: 'Stack or recursion',
      explanation: 'DFS uses a LIFO call stack or explicit stack to probe deeply.',
      difficulty: 0.3,
      concept: 'DFS',
      subtopic: 'Graph Traversal',
      skills: ['DFS', 'Stack'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/dfs'],
    };
    assert.equal(engine.validateSingleQuestion(passQ, 0, new Map(), {}).status, 'VALID');

    const failQ: Question = { ...passQ, correctAnswer: 'Queue' };
    const failRes = engine.validateSingleQuestion(failQ, 0, new Map(), {});
    assert.equal(failRes.status, 'INVALID');
    assert.equal(failRes.questionAnswerConsistency?.questionAnswerConsistency, false);
    assert.ok(failRes.questionAnswerConsistency?.reason?.includes('stack or recursion'));
  });

  test('Stack is LIFO -> PASS; Stack with FIFO -> FAIL', () => {
    const passQ: Question = {
      type: 'MCQ',
      question: 'What is the operational order principle of a Stack data structure?',
      options: ['LIFO (Last-In, First-Out)', 'FIFO (First-In, First-Out)', 'Random access', 'Priority order'],
      correctAnswer: 'LIFO (Last-In, First-Out)',
      explanation: 'Stack operates as Last-In First-Out.',
      difficulty: 0.2,
      concept: 'Stack',
      subtopic: 'Data Structures',
      skills: ['Stack'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/stack'],
    };
    assert.equal(engine.validateSingleQuestion(passQ, 0, new Map(), {}).status, 'VALID');

    const failQ: Question = { ...passQ, correctAnswer: 'FIFO (First-In, First-Out)' };
    const failRes = engine.validateSingleQuestion(failQ, 0, new Map(), {});
    assert.equal(failRes.status, 'INVALID');
    assert.equal(failRes.questionAnswerConsistency?.questionAnswerConsistency, false);
  });

  test('Queue is FIFO -> PASS; Queue with LIFO -> FAIL', () => {
    const passQ: Question = {
      type: 'MCQ',
      question: 'What is the operational order principle of a Queue data structure?',
      options: ['FIFO (First-In, First-Out)', 'LIFO (Last-In, First-Out)', 'Sorted order', 'Key-value mapping'],
      correctAnswer: 'FIFO (First-In, First-Out)',
      explanation: 'Queue operates as First-In First-Out.',
      difficulty: 0.2,
      concept: 'Queue',
      subtopic: 'Data Structures',
      skills: ['Queue'],
      cognitiveLevel: 'remember',
      sourceReferences: ['https://example.com/queue'],
    };
    assert.equal(engine.validateSingleQuestion(passQ, 0, new Map(), {}).status, 'VALID');

    const failQ: Question = { ...passQ, correctAnswer: 'LIFO (Last-In, First-Out)' };
    const failRes = engine.validateSingleQuestion(failQ, 0, new Map(), {});
    assert.equal(failRes.status, 'INVALID');
    assert.equal(failRes.questionAnswerConsistency?.questionAnswerConsistency, false);
  });
}

runValidationTests()
  .then(() => {
    console.log(`\nQuestion Validation Tests: ${passed} / ${total} passed.`);
    if (passed < total) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Fatal validation engine test runner error:', err);
    process.exit(1);
  });

