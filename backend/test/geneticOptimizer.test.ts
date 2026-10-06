import assert from 'node:assert/strict';
import { Question } from '../src/types/question';
import {
  GeneticAssessmentOptimizer,
  DEFAULT_GA_WEIGHTS,
} from '../src/services/geneticAssessmentOptimizer';
import { AssessmentService } from '../src/services/assessmentService';

// Helper to generate a mock question pool
function createMockQuestionPool(count = 25): Question[] {
  const subtopics = ['Search Operations', 'Tree Insertion', 'Tree Deletion', 'Tree Traversals'];
  const types: Question['type'][] = [
    'MCQ',
    'OUTPUT_PREDICTION',
    'CONCEPTUAL',
    'DEBUGGING',
    'SCENARIO',
  ];
  const cognitiveLevels: Question['cognitiveLevel'][] = [
    'remember',
    'understand',
    'apply',
    'analyze',
  ];

  const questions: Question[] = [];
  for (let i = 1; i <= count; i++) {
    const subtopic = subtopics[(i - 1) % subtopics.length];
    const type = types[(i - 1) % types.length];
    const cognitiveLevel = cognitiveLevels[(i - 1) % cognitiveLevels.length];
    const difficulty = Number((0.2 + ((i * 0.03) % 0.7)).toFixed(2)); // range ~0.2 to 0.9

    questions.push({
      id: i,
      type,
      question: `Question ${i}: How does ${subtopic} operate in a BST?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: `Explanation for question ${i}`,
      difficulty,
      concept: `Concept ${(i % 8) + 1}`, // Some duplicate concepts to test redundancy
      subtopic,
      skills: [`skill-${(i % 5) + 1}`, 'algorithms'],
      cognitiveLevel,
      sourceReferences: ['https://en.wikipedia.org/wiki/Binary_search_tree'],
    });
  }

  return questions;
}

async function runTests() {
  console.log('=== Running Trial 7: Genetic Algorithm Optimization Tests ===\n');
  const mockPool = createMockQuestionPool(25);
  const targetCount = 10;
  const targetDifficulty = 0.5;

  // Test 1: Chromosome contains correct number of questions
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, { seed: 42 });
    const chrom = optimizer.generateChromosome();
    assert.equal(chrom.length, targetCount, 'Chromosome must contain exactly targetQuestionCount questions');
    console.log('✓ Test 1: Chromosome contains correct number of questions');
  }

  // Test 2: Chromosome contains no duplicate question IDs
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, { seed: 101 });
    for (let i = 0; i < 20; i++) {
      const chrom = optimizer.generateChromosome();
      const uniqueIds = new Set(chrom);
      assert.equal(uniqueIds.size, targetCount, 'Chromosome must contain no duplicate question IDs');
    }
    console.log('✓ Test 2: Chromosome contains zero duplicates');
  }

  // Test 3: All chromosome questions are valid questions from pool
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, { seed: 202 });
    const chrom = optimizer.generateChromosome();
    const validIds = new Set(mockPool.map((q) => q.id));
    for (const qId of chrom) {
      assert.ok(validIds.has(qId), `Question ID ${qId} must be in the valid pool`);
    }
    console.log('✓ Test 3: All chromosome questions belong to the valid question pool');
  }

  // Test 4: Initial population generation
  {
    const popSize = 30;
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, {
      populationSize: popSize,
      seed: 303,
    });
    const population = optimizer.generateInitialPopulation();
    assert.equal(population.length, popSize, 'Initial population must equal configured populationSize');
    for (const individual of population) {
      assert.equal(individual.chromosome.length, targetCount);
      assert.ok(individual.fitness.total >= 0 && individual.fitness.total <= 1.0);
    }
    console.log('✓ Test 4: Initial population generated with valid individuals and fitness');
  }

  // Test 5: Fitness calculation and breakdown structure
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, { 'algorithms': 0.8 }, { seed: 404 });
    const chrom = optimizer.generateChromosome();
    const fitnessResult = optimizer.evaluateFitness(chrom);

    assert.ok(typeof fitnessResult.total === 'number');
    assert.ok(fitnessResult.total >= 0 && fitnessResult.total <= 1.0);
    assert.ok(fitnessResult.breakdown.coverage >= 0 && fitnessResult.breakdown.coverage <= 1.0);
    assert.ok(fitnessResult.breakdown.difficulty >= 0 && fitnessResult.breakdown.difficulty <= 1.0);
    assert.ok(fitnessResult.breakdown.typeDiversity >= 0 && fitnessResult.breakdown.typeDiversity <= 1.0);
    assert.ok(fitnessResult.breakdown.cognitiveDiversity >= 0 && fitnessResult.breakdown.cognitiveDiversity <= 1.0);
    assert.ok(fitnessResult.breakdown.redundancy >= 0 && fitnessResult.breakdown.redundancy <= 1.0);
    assert.ok(fitnessResult.breakdown.time >= 0 && fitnessResult.breakdown.time <= 1.0);
    assert.ok(fitnessResult.breakdown.skillTargets >= 0 && fitnessResult.breakdown.skillTargets <= 1.0);
    console.log('✓ Test 5: Fitness evaluation produces normalized total and complete breakdown');
  }

  // Test 6: Difficulty scoring (closer average difficulty scores higher)
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, 0.5);
    // Chromosome A: average difficulty ~0.50
    // Chromosome B: average difficulty ~0.85
    const chromA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // average difficulty ~0.35
    const chromB = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24]; // average difficulty ~0.70

    // Compare with target = 0.35
    const optTargetA = new GeneticAssessmentOptimizer(mockPool, 10, 0.35);
    const fitA = optTargetA.evaluateFitness(chromA);
    const fitB = optTargetA.evaluateFitness(chromB);
    assert.ok(
      fitA.breakdown.difficulty > fitB.breakdown.difficulty,
      'Assessment closer to target difficulty must score higher on difficulty fit'
    );
    console.log('✓ Test 6: Difficulty fit correctly rewards proximity to target difficulty');
  }

  // Test 7: Subtopic coverage scoring
  {
    // Create pool with 4 subtopics
    const opt = new GeneticAssessmentOptimizer(mockPool, 4, 0.5);
    // Chromosome with all 4 different subtopics (q1, q2, q3, q4 have subtopics 0, 1, 2, 3)
    const chromDiverse = [1, 2, 3, 4];
    // Chromosome with only 1 subtopic (q1, q5, q9, q13 all have subtopic 0)
    const chromSingleSub = [1, 5, 9, 13];

    const fitDiverse = opt.evaluateFitness(chromDiverse);
    const fitSingle = opt.evaluateFitness(chromSingleSub);

    assert.ok(
      fitDiverse.breakdown.coverage > fitSingle.breakdown.coverage,
      'Broad subtopic coverage must score higher than single subtopic cluster'
    );
    assert.equal(fitDiverse.breakdown.coverage, 1.0, 'Full coverage should score 1.0');
    console.log('✓ Test 7: Subtopic coverage rewards diverse subtopic representation');
  }

  // Test 8: Type diversity scoring
  {
    const opt = new GeneticAssessmentOptimizer(mockPool, 5, 0.5);
    // q1..q5 covers 5 different types
    const chromAllTypes = [1, 2, 3, 4, 5];
    // q1, q6, q11, q16, q21 all have MCQ type
    const chromOneType = [1, 6, 11, 16, 21];

    const fitDiverse = opt.evaluateFitness(chromAllTypes);
    const fitOne = opt.evaluateFitness(chromOneType);

    assert.ok(
      fitDiverse.breakdown.typeDiversity > fitOne.breakdown.typeDiversity,
      'Varied question types must score higher than single question type'
    );
    console.log('✓ Test 8: Question type diversity rewards variety of question types');
  }

  // Test 9: Cognitive diversity scoring
  {
    const opt = new GeneticAssessmentOptimizer(mockPool, 4, 0.5);
    // q1..q4 covers remember, understand, apply, analyze
    const chromDiverse = [1, 2, 3, 4];
    // q1, q5, q9, q13 all share same cognitive level
    const chromSingle = [1, 5, 9, 13];

    const fitDiverse = opt.evaluateFitness(chromDiverse);
    const fitSingle = opt.evaluateFitness(chromSingle);

    assert.ok(
      fitDiverse.breakdown.cognitiveDiversity > fitSingle.breakdown.cognitiveDiversity,
      'Varied cognitive levels must score higher than single cognitive level'
    );
    console.log('✓ Test 9: Cognitive level diversity rewards multi-level cognitive questions');
  }

  // Test 10: Redundancy penalty
  {
    // Questions with unique concepts vs questions with duplicate concepts
    const opt = new GeneticAssessmentOptimizer(mockPool, 4, 0.5);
    // q1, q2, q3, q4 have concepts 1, 2, 3, 4 (all distinct)
    const chromUnique = [1, 2, 3, 4];
    // q1, q9, q17, q25 have concepts (1 % 8) = 1, (9 % 8) = 1, etc. (all same concept)
    const chromRedundant = [1, 9, 17, 25];

    const fitUnique = opt.evaluateFitness(chromUnique);
    const fitRedundant = opt.evaluateFitness(chromRedundant);

    assert.ok(
      fitUnique.breakdown.redundancy > fitRedundant.breakdown.redundancy,
      'Assessments with duplicate concepts should be penalized on redundancy'
    );
    console.log('✓ Test 10: Redundancy scoring penalizes repeated concepts');
  }

  // Test 11: Mutation preserves chromosome validity
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, {
      mutationRate: 1.0, // Force mutation
      seed: 555,
    });
    const chrom = optimizer.generateChromosome();
    const mutated = optimizer.mutate(chrom);

    assert.equal(mutated.length, targetCount, 'Mutated chromosome must retain exact length');
    const uniqueIds = new Set(mutated);
    assert.equal(uniqueIds.size, targetCount, 'Mutated chromosome must not contain duplicates');
    const validIds = new Set(mockPool.map((q) => q.id));
    for (const id of mutated) {
      assert.ok(validIds.has(id), 'Mutated gene must belong to the valid pool');
    }
    console.log('✓ Test 11: Mutation strictly preserves chromosome validity, length and uniqueness');
  }

  // Test 12: Crossover preserves chromosome validity
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, {
      crossoverRate: 1.0, // Force crossover
      seed: 777,
    });
    const parentA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const parentB = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

    for (let trial = 0; trial < 10; trial++) {
      const child = optimizer.crossover(parentA, parentB);
      assert.equal(child.length, targetCount, 'Crossover child must contain targetQuestionCount genes');
      const uniqueChild = new Set(child);
      assert.equal(uniqueChild.size, targetCount, 'Crossover child must have zero duplicates');
      const validIds = new Set(mockPool.map((q) => q.id));
      for (const id of child) {
        assert.ok(validIds.has(id), 'Child question ID must come from valid question pool');
      }
    }
    console.log('✓ Test 12: Crossover preserves chromosome validity and repairs duplicates');
  }

  // Test 13: Elitism preserves best chromosome
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, {
      populationSize: 20,
      generations: 5,
      elitismCount: 2,
      seed: 888,
    });
    const result = optimizer.optimize();
    assert.ok(result.finalFitness >= result.initialFitness, 'Best fitness must not degrade when elitism is active');
    console.log('✓ Test 13: Elitism ensures the best chromosome is never lost across generations');
  }

  // Test 14: Optimizer improves or maintains best fitness across generations
  {
    const optimizer = new GeneticAssessmentOptimizer(mockPool, targetCount, 0.55, { 'algorithms': 0.8 }, {
      populationSize: 40,
      generations: 50,
      stagnationLimit: 15,
      seed: 999,
    });
    const { initialFitness, finalFitness, generationsRun } = optimizer.optimize();
    assert.ok(finalFitness >= initialFitness, 'Final fitness should be greater than or equal to initial fitness');
    assert.ok(generationsRun > 1, 'Algorithm should iterate through multiple generations');
    console.log(`✓ Test 14: Optimizer successfully searched space: initial=${initialFitness}, final=${finalFitness} in ${generationsRun} generations`);
  }

  // Test 15: Seeded execution is deterministic
  {
    const opt1 = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, {
      populationSize: 20,
      generations: 10,
      seed: 12345,
    });
    const opt2 = new GeneticAssessmentOptimizer(mockPool, targetCount, targetDifficulty, {}, {
      populationSize: 20,
      generations: 10,
      seed: 12345,
    });

    const res1 = opt1.optimize();
    const res2 = opt2.optimize();

    assert.equal(res1.finalFitness, res2.finalFitness, 'Seeded executions must produce identical fitness');
    assert.deepEqual(res1.best.chromosome, res2.best.chromosome, 'Seeded executions must select identical questions');
    console.log('✓ Test 15: Seeded PRNG produces fully deterministic and reproducible results');
  }

  // Test 16: Insufficient valid questions error handling
  {
    const smallPool = createMockQuestionPool(5);
    const optimizer = new GeneticAssessmentOptimizer(smallPool, 10, 0.5);
    assert.throws(
      () => optimizer.optimize(),
      /Not enough valid questions/i,
      'Should throw clear error when pool size is smaller than requested question count'
    );

    await assert.rejects(
      async () => {
        await AssessmentService.optimizeAssessment({
          targetQuestionCount: 10,
          questions: smallPool,
        });
      },
      /Not enough valid questions/i,
      'Service must reject when insufficient valid questions are supplied'
    );
    console.log('✓ Test 16: Insufficient valid questions gracefully rejected with clear error');
  }

  // Test 17: Assessment Service execution with mocked question pool
  {
    const serviceResult = await AssessmentService.optimizeAssessment({
      targetQuestionCount: 8,
      targetDifficulty: 0.5,
      questions: mockPool,
      config: { seed: 777, generations: 25 },
    });

    assert.equal(serviceResult.status, 'success');
    assert.equal(serviceResult.questionCount, 8);
    assert.equal(serviceResult.questions.length, 8);
    // Verify question ordering is 1 to N
    serviceResult.questions.forEach((q, idx) => {
      assert.equal(q.order, idx + 1);
      // Verify answers are not exposed in returned question item
      assert.equal((q as any).correctAnswer, undefined);
      assert.equal((q as any).explanation, undefined);
    });
    assert.ok(serviceResult.fitness > 0);
    assert.ok(serviceResult.subtopicsCovered.length > 0);
    assert.ok(serviceResult.typesCovered.length > 0);
    console.log('✓ Test 17: AssessmentService formats questions in order and protects learner answers');
  }

  // Test 18: Skill targets bonus weighting
  {
    const skillTarget = { 'skill-1': 0.8 };
    const optWithSkill = new GeneticAssessmentOptimizer(mockPool, 6, 0.5, skillTarget, { seed: 100 });
    const chrom = [1, 2, 3, 4, 5, 6];
    const fitness = optWithSkill.evaluateFitness(chrom);
    assert.ok(fitness.breakdown.skillTargets > 0, 'Matching skill targets should yield positive skill score');
    console.log('✓ Test 18: Skill targets are evaluated and properly rewarded in fitness breakdown');
  }

  console.log('\n=== All Trial 7 Genetic Algorithm Tests Passed Successfully! ===\n');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
