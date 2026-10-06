import assert from 'node:assert/strict';
import { TopicAnalyzerService } from '../src/services/topicAnalyzer';
import { ILLMProvider } from '../src/services/llm/llmProvider';
import { StructuredTopic, ClarificationRequired, InvalidTopic } from '../src/types/topic';
import { validateTopicAnalysisOutput, ValidationError } from '../src/validators/topicValidator';

console.log('Running TopicAnalyzer & LLM Mock Test Suite...');

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

// Mock LLM Provider helper
class MockLLMProvider implements ILLMProvider {
  private responseToReturn: unknown;
  public lastUserPrompt: string = '';
  public lastSystemPrompt: string = '';

  constructor(response: unknown) {
    this.responseToReturn = response;
  }

  public setResponse(response: unknown) {
    this.responseToReturn = response;
  }

  async generateStructuredResponse(systemPrompt: string, userPrompt: string): Promise<unknown> {
    this.lastSystemPrompt = systemPrompt;
    this.lastUserPrompt = userPrompt;
    if (this.responseToReturn instanceof Error) {
      throw this.responseToReturn;
    }
    return this.responseToReturn;
  }
}

async function runAllTests() {
  // 1. Valid Binary Search Trees response
  await test('Valid Binary Search Trees response', async () => {
    const mockData = {
      status: 'success',
      field: 'Computer Science',
      domain: 'Data Structures and Algorithms',
      topic: 'Binary Search Trees',
      subtopics: ['Search', 'Insertion', 'Deletion', 'Traversal'],
    };
    const mockProvider = new MockLLMProvider(mockData);
    const analyzer = new TopicAnalyzerService(mockProvider);

    const result = (await analyzer.analyzeTopic('I learned Binary Search Trees')) as StructuredTopic;
    assert.equal(result.status, 'success');
    assert.equal(result.field, 'Computer Science');
    assert.equal(result.domain, 'Data Structures and Algorithms');
    assert.equal(result.topic, 'Binary Search Trees');
    assert.deepEqual(result.subtopics, ['Search', 'Insertion', 'Deletion', 'Traversal']);
  });

  // 2. Valid React Hooks response
  await test('Valid React Hooks response', async () => {
    const mockData = {
      status: 'success',
      field: 'Computer Science',
      domain: 'Web Development',
      topic: 'React Hooks',
      subtopics: ['useState', 'useEffect'],
    };
    const mockProvider = new MockLLMProvider(mockData);
    const analyzer = new TopicAnalyzerService(mockProvider);

    const result = (await analyzer.analyzeTopic(
      'I recently studied how React hooks work, especially useState and useEffect'
    )) as StructuredTopic;
    assert.equal(result.status, 'success');
    assert.equal(result.topic, 'React Hooks');
    assert.deepEqual(result.subtopics, ['useState', 'useEffect']);
  });

  // 3. Valid Python Decorators response
  await test('Valid Python Decorators response', async () => {
    const mockData = {
      status: 'success',
      field: 'Computer Science',
      domain: 'Programming',
      topic: 'Python Decorators',
      subtopics: ['Decorator Syntax', 'Wrapper Functions', 'functools.wraps'],
    };
    const mockProvider = new MockLLMProvider(mockData);
    const analyzer = new TopicAnalyzerService(mockProvider);

    const result = (await analyzer.analyzeTopic(
      'I learned about Python decorators and wrapper functions'
    )) as StructuredTopic;
    assert.equal(result.status, 'success');
    assert.equal(result.topic, 'Python Decorators');
    assert.ok(result.subtopics.includes('Wrapper Functions'));
  });

  // 4. Clarification-required response (Ambiguous input)
  await test('Clarification-required response for ambiguous input ("I learned trees")', async () => {
    const mockData = {
      status: 'clarification_required',
      message: 'Which type of tree did you study?',
      options: ['Binary Trees', 'Binary Search Trees', 'AVL Trees', 'B-Trees', 'Other'],
    };
    const mockProvider = new MockLLMProvider(mockData);
    const analyzer = new TopicAnalyzerService(mockProvider);

    const result = (await analyzer.analyzeTopic('I learned trees')) as ClarificationRequired;
    assert.equal(result.status, 'clarification_required');
    assert.match(result.message, /Which type of tree/i);
    assert.equal(result.options.length, 5);
    assert.ok(result.options.includes('Binary Search Trees'));
  });

  // 5. Invalid / Non-CS response ("I learned organic chemistry")
  await test('Invalid/Non-CS input handling ("I learned organic chemistry")', async () => {
    const mockData = {
      status: 'invalid',
      message: 'This version currently supports Computer Science topics only.',
    };
    const mockProvider = new MockLLMProvider(mockData);
    const analyzer = new TopicAnalyzerService(mockProvider);

    const result = (await analyzer.analyzeTopic('I learned organic chemistry')) as InvalidTopic;
    assert.equal(result.status, 'invalid');
    assert.match(result.message, /Computer Science topics only/i);
  });

  // 6. Malformed LLM response (Not valid JSON or string instead of object)
  await test('Malformed LLM response throws ValidationError', () => {
    assert.throws(
      () => validateTopicAnalysisOutput('Just a random string from model'),
      ValidationError
    );
    assert.throws(
      () => validateTopicAnalysisOutput(null),
      ValidationError
    );
  });

  // 7. Missing required fields in LLM output
  await test('Missing required fields throws ValidationError', () => {
    // Missing domain
    assert.throws(
      () =>
        validateTopicAnalysisOutput({
          status: 'success',
          field: 'Computer Science',
          topic: 'Binary Search Trees',
          subtopics: ['Search'],
        }),
      /domain/
    );

    // subtopics not an array
    assert.throws(
      () =>
        validateTopicAnalysisOutput({
          status: 'success',
          field: 'Computer Science',
          domain: 'DSA',
          topic: 'BST',
          subtopics: 'Search',
        }),
      /subtopics/
    );

    // Invalid status string
    assert.throws(
      () =>
        validateTopicAnalysisOutput({
          status: 'unknown_status',
        }),
      /Unsupported status/
    );
  });

  // 8. Empty input check
  await test('Empty user input throws validation error', async () => {
    const mockProvider = new MockLLMProvider({});
    const analyzer = new TopicAnalyzerService(mockProvider);

    await assert.rejects(
      async () => analyzer.analyzeTopic(''),
      /Input must be a non-empty string/
    );
    await assert.rejects(
      async () => analyzer.analyzeTopic('   '),
      /Input must be a non-empty string/
    );
  });

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
