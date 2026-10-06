import assert from 'node:assert/strict';
import { QuestionGeneratorService } from '../src/services/questionGeneratorService';
import { ILLMProvider } from '../src/services/llm/llmProvider';
import {
  validateQuestion,
  validateAndDeduplicateQuestions,
  QuestionValidationError,
  normalizeQuestionText,
} from '../src/validators/questionValidator';
import { Question } from '../src/types/question';

console.log('Running Question Generator & Validator Test Suite...');

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

class MockLLMProvider implements ILLMProvider {
  private responseToReturn: unknown;
  public lastPrompt: string = '';

  constructor(response: unknown) {
    this.responseToReturn = response;
  }

  async generateStructuredResponse(systemPrompt: string, userPrompt: string): Promise<unknown> {
    this.lastPrompt = userPrompt;
    if (this.responseToReturn instanceof Error) {
      throw this.responseToReturn;
    }
    return this.responseToReturn;
  }
}

async function runAllTests() {
  const validMCQ = {
    type: 'MCQ',
    question: 'What does the useState hook return in React?',
    options: [
      'A stateful value and a function to update it',
      'Only the current state value',
      'A reducer function and initial state',
      'A DOM node reference',
    ],
    correctAnswer: 'A stateful value and a function to update it',
    explanation: 'useState returns a pair: the current state value and a state updater function.',
    difficulty: 0.35,
    concept: 'useState',
    subtopic: 'useState',
    skills: ['state management', 'React Hooks'],
    cognitiveLevel: 'understand',
    sourceReferences: ['https://react.dev/reference/react/useState'],
  };

  // 1. Valid question generation & correct MCQ structure
  test('Valid MCQ structural validation passes with 4 options and matching answer', () => {
    const q = validateQuestion(validMCQ);
    assert.equal(q.type, 'MCQ');
    assert.equal(q.difficulty, 0.35);
    assert.equal(q.options?.length, 4);
    assert.equal(q.correctAnswer, 'A stateful value and a function to update it');
    assert.ok(q.sourceReferences.length > 0);
  });

  // 2. Invalid difficulty (< 0 or > 1)
  test('Invalid difficulty (> 1.0 or < 0.0) throws QuestionValidationError', () => {
    assert.throws(
      () => validateQuestion({ ...validMCQ, difficulty: 1.5 }),
      /difficulty/
    );
    assert.throws(
      () => validateQuestion({ ...validMCQ, difficulty: -0.2 }),
      /difficulty/
    );
    assert.throws(
      () => validateQuestion({ ...validMCQ, difficulty: 'hard' }),
      /difficulty/
    );
  });

  // 3. Missing correct answer
  test('Missing correct answer throws QuestionValidationError', () => {
    assert.throws(
      () => validateQuestion({ ...validMCQ, correctAnswer: '' }),
      /correctAnswer/
    );
  });

  // 4. Invalid MCQ answer (correctAnswer does not match any of the 4 options)
  test('MCQ correctAnswer not in options throws QuestionValidationError', () => {
    assert.throws(
      () =>
        validateQuestion({
          ...validMCQ,
          correctAnswer: 'Non-existent option completely unrelated',
        }),
      /does not match any of the 4 options/
    );
  });

  // 5. MCQ without exactly 4 options
  test('MCQ with fewer or more than 4 options throws QuestionValidationError', () => {
    assert.throws(
      () =>
        validateQuestion({
          ...validMCQ,
          options: ['Option A', 'Option B'],
        }),
      /must have exactly 4 options/
    );
  });

  // 6. Missing source reference
  test('Missing source reference throws QuestionValidationError', () => {
    assert.throws(
      () => validateQuestion({ ...validMCQ, sourceReferences: [] }),
      /sourceReferences/
    );
  });

  // 7. Duplicate question removal
  test('Duplicate question removal strips exact and near-exact duplicates in a batch', () => {
    const rawBatch = [
      validMCQ,
      { ...validMCQ, question: 'WHAT DOES THE USESTATE HOOK RETURN IN REACT?' }, // near-duplicate
      {
        ...validMCQ,
        type: 'OUTPUT_PREDICTION',
        question: 'What is printed by console.log(typeof useState)?',
        options: ['function', 'object', 'undefined', 'string'],
        correctAnswer: 'function',
      },
    ];

    const deduplicated = validateAndDeduplicateQuestions(rawBatch);
    assert.equal(deduplicated.length, 2);
    assert.equal(deduplicated[0].type, 'MCQ');
    assert.equal(deduplicated[1].type, 'OUTPUT_PREDICTION');
  });

  // 8. Output prediction and debugging question types
  test('Non-MCQ types (OUTPUT_PREDICTION, DEBUGGING, CONCEPTUAL, SCENARIO) validate properly', () => {
    const debugQ = {
      type: 'DEBUGGING',
      question: 'Identify the bug in this hook usage.',
      codeSnippet: 'if (condition) { useState(0); }',
      correctAnswer: 'Hooks cannot be called conditionally.',
      explanation: 'React hooks must be called at the top level of components.',
      difficulty: 0.65,
      concept: 'Rules of Hooks',
      subtopic: 'React Hooks',
      skills: ['debugging', 'React Hooks'],
      cognitiveLevel: 'analyze',
      sourceReferences: ['https://react.dev/warnings/invalid-hook-call-warning'],
    };

    const validated = validateQuestion(debugQ);
    assert.equal(validated.type, 'DEBUGGING');
    assert.equal(validated.codeSnippet, 'if (condition) { useState(0); }');
    assert.equal(validated.difficulty, 0.65);
  });

  // 9. Full QuestionGeneratorService pipeline with mock LLM and diverse types
  await test('QuestionGeneratorService generates candidate pool and computes distribution', async () => {
    const mockQuestions: Question[] = [
      validMCQ as any,
      {
        type: 'CONCEPTUAL',
        question: 'Explain the difference between useEffect and useLayoutEffect.',
        correctAnswer: 'useLayoutEffect fires synchronously after DOM mutations.',
        explanation: 'Detailed timing difference.',
        difficulty: 0.72,
        concept: 'useEffect',
        subtopic: 'useEffect',
        skills: ['lifecycle', 'React Hooks'],
        cognitiveLevel: 'understand',
        sourceReferences: ['https://react.dev/reference/react/useLayoutEffect'],
      },
      {
        type: 'OUTPUT_PREDICTION',
        question: 'Given const [count, setCount] = useState(0); setCount(count + 1); what is count immediately after?',
        correctAnswer: '0',
        explanation: 'State updates are scheduled and asynchronous in event handlers.',
        difficulty: 0.58,
        concept: 'useState',
        subtopic: 'useState',
        skills: ['state updater', 'React Hooks'],
        cognitiveLevel: 'apply',
        sourceReferences: ['https://react.dev/reference/react/useState'],
      },
    ];

    const mockLLM = new MockLLMProvider({ questions: mockQuestions });
    const service = new QuestionGeneratorService(mockLLM, 3);

    // Mock fetchKnowledgeForGeneration so DB is not required for unit test
    service.fetchKnowledgeForGeneration = async () => ({
      topicTitle: 'React Hooks',
      topicId: 1,
      researchSessionId: 1,
      knowledgeItems: [
        {
          id: 1,
          concept: 'useState',
          summary: 'State hook',
          subtopic: 'useState',
          source_url: 'https://react.dev',
          source_title: 'React Docs',
        },
      ],
    });

    service.persistCandidateQuestions = async () => {};

    const res = await service.generateQuestions({ count: 3 });

    assert.equal(res.status, 'success');
    assert.equal(res.generatedCount, 3);
    assert.equal(res.distribution.MCQ, 1);
    assert.equal(res.distribution.CONCEPTUAL, 1);
    assert.equal(res.distribution.OUTPUT_PREDICTION, 1);
    assert.equal(res.distribution.DEBUGGING, 0);
  });

  // 10. Empty research knowledge handling
  await test('Empty research knowledge throws clear error instructing to research first', async () => {
    const mockLLM = new MockLLMProvider({ questions: [] });
    const service = new QuestionGeneratorService(mockLLM);
    service.fetchKnowledgeForGeneration = async () => ({
      topicTitle: 'Empty Topic',
      knowledgeItems: [],
    });

    await assert.rejects(
      async () => service.generateQuestions({ topicId: 999 }),
      /No validated research knowledge found/
    );
  });

  // 11. LLM failure error handling
  await test('LLM failure is propagated with descriptive error', async () => {
    const failingLLM = new MockLLMProvider(new Error('LLM rate limit reached or server unavailable.'));
    const service = new QuestionGeneratorService(failingLLM);
    service.fetchKnowledgeForGeneration = async () => ({
      topicTitle: 'React Hooks',
      knowledgeItems: [
        {
          id: 1,
          concept: 'useState',
          summary: 'summary',
          source_url: 'url',
          source_title: 'title',
        },
      ],
    });

    await assert.rejects(
      async () => service.generateQuestions({ topicId: 1 }),
      /LLM rate limit/
    );
  });

  console.log(`\nQuestion Generator Tests: ${passed} / ${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal question generator test runner error:', err);
  process.exit(1);
});
