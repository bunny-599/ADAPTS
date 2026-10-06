import assert from 'node:assert/strict';
import { ResearchService } from '../src/services/researchService';
import { ISearchProvider, SearchResultItem, ResearchTopicDTO } from '../src/types/research';
import { ILLMProvider } from '../src/services/llm/llmProvider';
import { validateResearchKnowledge, validateResearchResult, ResearchValidationError } from '../src/validators/researchValidator';
import { classifySourceType } from '../src/services/search/searchProvider';

console.log('Running ResearchService & Web Search Mock Test Suite...');

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

// Mock Search Provider
class MockSearchProvider implements ISearchProvider {
  public queriesExecuted: string[] = [];
  public resultsToReturn: SearchResultItem[] = [];
  public shouldFail: boolean = false;

  constructor(results: SearchResultItem[] = [], shouldFail: boolean = false) {
    this.resultsToReturn = results;
    this.shouldFail = shouldFail;
  }

  async search(query: string, maxResults: number = 2): Promise<SearchResultItem[]> {
    this.queriesExecuted.push(query);
    if (this.shouldFail) {
      throw new Error('Search provider connection timed out.');
    }
    return this.resultsToReturn.slice(0, maxResults);
  }
}

// Mock LLM Provider
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
  const sampleTopic: ResearchTopicDTO = {
    field: 'Computer Science',
    domain: 'Web Development',
    topic: 'React Hooks',
    subtopics: ['useState', 'useEffect', 'useContext'],
  };

  // 1. Multiple search queries generation
  test('Multiple search queries generated from topic and subtopics', () => {
    const service = new ResearchService();
    const queries = service.generateQueries(sampleTopic);
    assert.ok(queries.length >= 3);
    assert.ok(queries.some((q) => q.includes('React Hooks official documentation')));
    assert.ok(queries.some((q) => q.includes('useState')));
    assert.ok(queries.some((q) => q.includes('useEffect')));
  });

  // 2. Successful search & source deduplication
  await test('Successful search & source deduplication by normalized URL', async () => {
    const mockResults: SearchResultItem[] = [
      {
        title: 'Built-in React Hooks – React',
        url: 'https://react.dev/reference/react/hooks/',
        snippet: 'Hooks let you use different React features from your components.',
        sourceType: 'official_documentation',
      },
      {
        title: 'Duplicate React Doc Link',
        url: 'https://react.dev/reference/react/hooks', // Same normalized URL
        snippet: 'Duplicate snippet',
        sourceType: 'official_documentation',
      },
      {
        title: 'MDN Web Docs - Using the State Hook',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/State',
        snippet: 'State hook allows function components to hold state.',
        sourceType: 'official_documentation',
      },
    ];

    const mockSearch = new MockSearchProvider(mockResults);
    // Allow search to return 3 results per query
    mockSearch.search = async (q: string) => mockResults;
    const mockLLM = new MockLLMProvider([
      {
        concept: 'useState',
        summary: 'useState is a React Hook that lets you add a state variable to your component.',
        subtopic: 'useState',
        sourceUrl: 'https://react.dev/reference/react/hooks',
        sourceTitle: 'Built-in React Hooks – React',
      },
    ]);

    const service = new ResearchService(mockSearch, mockLLM);
    // Stub persistence since DB connection is optional in mock test
    service.persistResearchData = async () => 101;

    const res = await service.researchTopic(sampleTopic);

    assert.equal(res.status, 'success');
    assert.equal(res.topic, 'React Hooks');
    // Verify deduplication: 2 unique URLs instead of 3 across all queries
    assert.equal(res.sources.length, 2);
    assert.equal(res.sources[0].url, 'https://react.dev/reference/react/hooks');
    assert.equal(res.sources[1].url, 'https://developer.mozilla.org/en-US/docs/Web/API/State');
    assert.equal(res.knowledge.length, 1);
    assert.equal(res.knowledge[0].concept, 'useState');
    assert.equal(res.knowledge[0].sourceUrl, 'https://react.dev/reference/react/hooks');
  });

  // 3. Source classification (official documentation vs technical article vs academic)
  test('Source classification logic correctly classifies domains', () => {
    assert.equal(classifySourceType('https://react.dev/reference/react').sourceType, 'official_documentation');
    assert.equal(classifySourceType('https://docs.python.org/3/').sourceType, 'official_documentation');
    assert.equal(classifySourceType('https://developer.mozilla.org/en-US/').sourceType, 'official_documentation');
    assert.equal(classifySourceType('https://cs.stanford.edu/people/bst').sourceType, 'academic');
    assert.equal(classifySourceType('https://geeksforgeeks.org/binary-search-tree').sourceType, 'technical_article');
    assert.equal(classifySourceType('https://randomblog123.com/hooks').sourceType, 'other');
  });

  // 4. Knowledge item validation (Concept, summary, sourceUrl, sourceTitle)
  test('Knowledge item validation enforces required fields and source retention', () => {
    const valid = [
      {
        concept: 'useEffect',
        summary: 'Runs side effects in function components.',
        subtopic: 'useEffect',
        sourceUrl: 'https://react.dev',
        sourceTitle: 'React Docs',
      },
    ];
    const validated = validateResearchKnowledge(valid);
    assert.equal(validated.length, 1);
    assert.equal(validated[0].sourceUrl, 'https://react.dev');

    // Missing sourceUrl
    assert.throws(
      () =>
        validateResearchKnowledge([
          {
            concept: 'useEffect',
            summary: 'Runs side effects.',
            sourceTitle: 'React Docs',
          },
        ]),
      /sourceUrl/
    );

    // Missing concept
    assert.throws(
      () =>
        validateResearchKnowledge([
          {
            summary: 'Runs side effects.',
            sourceUrl: 'https://react.dev',
            sourceTitle: 'React Docs',
          },
        ]),
      /concept/
    );
  });

  // 5. Empty search results error handling
  await test('Empty search results throws informative error', async () => {
    const mockSearch = new MockSearchProvider([]); // returns 0 results
    const service = new ResearchService(mockSearch, new MockLLMProvider([]));

    await assert.rejects(
      async () => service.researchTopic(sampleTopic),
      /No web sources could be found/
    );
  });

  // 6. Search provider failure error handling
  await test('Search provider failure handled cleanly', async () => {
    const mockSearch = new MockSearchProvider([], true); // shouldFail = true
    const service = new ResearchService(mockSearch, new MockLLMProvider([]));

    await assert.rejects(
      async () => service.researchTopic(sampleTopic),
      /No web sources could be found/
    );
  });

  // 7. LLM extraction failure graceful fallback
  await test('LLM extraction failure falls back gracefully to direct source snippets', async () => {
    const mockSearch = new MockSearchProvider([
      {
        title: 'Binary Search Tree - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Binary_search_tree',
        snippet: 'A binary search tree is a rooted binary tree data structure with key ordering.',
        sourceType: 'other',
      },
    ]);
    const failingLLM = new MockLLMProvider(new Error('LLM rate limit reached'));
    const service = new ResearchService(mockSearch, failingLLM);
    service.persistResearchData = async () => 102;

    const bstTopic: ResearchTopicDTO = {
      field: 'Computer Science',
      domain: 'Data Structures and Algorithms',
      topic: 'Binary Search Trees',
      subtopics: ['Search', 'Insertion'],
    };

    const res = await service.researchTopic(bstTopic);
    assert.equal(res.status, 'success');
    assert.ok(res.knowledge.length >= 1);
    assert.equal(res.knowledge[0].sourceUrl, 'https://en.wikipedia.org/wiki/Binary_search_tree');
    assert.ok(res.knowledge[0].summary.includes('binary search tree'));
  });

  // 8. Full ResearchResult schema validation
  test('Full research result validation validates object and sub-arrays', () => {
    const payload = {
      status: 'success',
      topic: 'React Hooks',
      sessionId: 10,
      sources: [
        {
          title: 'React Docs',
          url: 'https://react.dev',
          domain: 'react.dev',
          sourceType: 'official_documentation',
        },
      ],
      knowledge: [
        {
          concept: 'useState',
          summary: 'Manages component state.',
          sourceUrl: 'https://react.dev',
          sourceTitle: 'React Docs',
        },
      ],
    };

    const valid = validateResearchResult(payload);
    assert.equal(valid.status, 'success');
    assert.equal(valid.topic, 'React Hooks');
    assert.equal(valid.sources.length, 1);
    assert.equal(valid.knowledge.length, 1);

    assert.throws(
      () => validateResearchResult({ status: 'failed', topic: 'React' }),
      /Research status must be "success"/
    );
  });

  console.log(`\nResearch Tests: ${passed} / ${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal research test runner error:', err);
  process.exit(1);
});
