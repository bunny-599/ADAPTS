import { Question, QuestionType, CognitiveLevel } from '../types/question';
import {
  GAConfig,
  GAWeights,
  FitnessBreakdown,
  FitnessResult,
  Chromosome,
  Individual,
} from '../types/assessment';

/**
 * Pseudo-random number generator (Mulberry32) for reproducible/deterministic testing.
 */
class Mulberry32PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export const DEFAULT_GA_WEIGHTS: GAWeights = {
  coverage: 0.25,
  difficulty: 0.20,
  typeDiversity: 0.15,
  cognitiveDiversity: 0.10,
  redundancy: 0.15,
  time: 0.05,
  skillTargets: 0.10,
};

export const DEFAULT_TIME_ESTIMATES: Record<QuestionType, number> = {
  MCQ: 30,
  CONCEPTUAL: 60,
  OUTPUT_PREDICTION: 90,
  DEBUGGING: 120,
  SCENARIO: 90,
  CODING: 180,
};

export const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 50,
  generations: 100,
  mutationRate: 0.10,
  crossoverRate: 0.80,
  elitismCount: 2,
  tournamentSize: 3,
  stagnationLimit: 20,
  weights: DEFAULT_GA_WEIGHTS,
  timeEstimates: DEFAULT_TIME_ESTIMATES,
};

export class GeneticAssessmentOptimizer {
  private config: GAConfig;
  private weights: GAWeights;
  private timeEstimates: Record<QuestionType, number>;
  private random: () => number;
  private validQuestions: Question[];
  private questionMap: Map<string, Question>;
  private targetQuestionCount: number;
  private targetDifficulty: number;
  private skillTargets: Record<string, number>;
  private questionTypeTargets?: Record<string, number>;
  private cognitiveTargets?: Record<string, number>;

  // Pre-computed pool metrics for normalizing fitness
  private poolSubtopics: Set<string>;
  private poolTypes: Set<QuestionType>;
  private poolCognitiveLevels: Set<CognitiveLevel>;

  constructor(
    validQuestions: Question[],
    targetQuestionCount: number,
    targetDifficulty = 0.5,
    skillTargets: Record<string, number> = {},
    customConfig: Partial<GAConfig> = {},
    questionTypeTargets?: Record<string, number>,
    cognitiveTargets?: Record<string, number>
  ) {
    this.validQuestions = validQuestions;
    this.targetQuestionCount = targetQuestionCount;
    this.targetDifficulty = Math.max(0, Math.min(1, targetDifficulty));
    this.skillTargets = skillTargets || {};
    this.questionTypeTargets = questionTypeTargets || customConfig.questionTypeTargets;
    this.cognitiveTargets = cognitiveTargets || customConfig.cognitiveTargets;

    this.config = {
      ...DEFAULT_GA_CONFIG,
      ...customConfig,
    };

    this.weights = {
      ...DEFAULT_GA_WEIGHTS,
      ...(customConfig.weights || {}),
    };

    this.timeEstimates = {
      ...DEFAULT_TIME_ESTIMATES,
      ...(customConfig.timeEstimates || {}),
    };

    // Setup seeded PRNG or native Math.random
    if (typeof this.config.seed === 'number') {
      const prng = new Mulberry32PRNG(this.config.seed);
      this.random = () => prng.next();
    } else {
      this.random = () => Math.random();
    }

    // Build question lookup map
    this.questionMap = new Map();
    this.poolSubtopics = new Set();
    this.poolTypes = new Set();
    this.poolCognitiveLevels = new Set();

    let fallbackCounter = 1;
    for (const q of this.validQuestions) {
      if (q.id === undefined || q.id === null) {
        q.id = fallbackCounter++;
      }
      const qId = String(q.id);
      this.questionMap.set(qId, q);
      if (q.subtopic) this.poolSubtopics.add(q.subtopic);
      if (q.type) this.poolTypes.add(q.type);
      if (q.cognitiveLevel) this.poolCognitiveLevels.add(q.cognitiveLevel);
    }
  }

  /**
   * Evaluates the fitness of a single chromosome.
   */
  public evaluateFitness(chromosome: Chromosome): FitnessResult {
    const questions = chromosome
      .map((id) => this.questionMap.get(String(id)))
      .filter((q): q is Question => q !== undefined);

    const count = questions.length;
    if (count === 0) {
      return {
        total: 0,
        breakdown: {
          coverage: 0,
          difficulty: 0,
          typeDiversity: 0,
          cognitiveDiversity: 0,
          redundancy: 0,
          time: 0,
          skillTargets: 0,
        },
      };
    }

    // A. Subtopic Coverage: ratio of unique subtopics covered vs max achievable
    const coveredSubtopics = new Set<string>();
    questions.forEach((q) => {
      if (q.subtopic) coveredSubtopics.add(q.subtopic);
    });
    const maxPossibleSubtopics = Math.min(this.poolSubtopics.size, this.targetQuestionCount);
    const coverageScore = maxPossibleSubtopics > 0
      ? Math.min(1.0, coveredSubtopics.size / maxPossibleSubtopics)
      : 1.0;

    // B. Target Difficulty: 1.0 - absolute difference between average and target
    const avgDifficulty = questions.reduce((acc, q) => acc + (q.difficulty || 0), 0) / count;
    const difficultyDiff = Math.abs(avgDifficulty - this.targetDifficulty);
    const difficultyScore = Math.max(0, 1.0 - difficultyDiff);

    // C. Question Type Diversity: ratio of distinct types covered vs max achievable, OR alignment with questionTypeTargets
    let typeDiversityScore = 1.0;
    const typeTargetKeys = this.questionTypeTargets ? Object.keys(this.questionTypeTargets) : [];
    if (typeTargetKeys.length > 0) {
      let matchedTypeWeights = 0;
      let totalTypeWeights = 0;
      for (const [tType, tFreq] of Object.entries(this.questionTypeTargets!)) {
        totalTypeWeights += tFreq;
        const matchingCount = questions.filter((q) => q.type === tType).length;
        const actualFreq = matchingCount / count;
        const matchRatio = tFreq > 0 ? Math.min(1.0, actualFreq / tFreq) : 1.0;
        matchedTypeWeights += matchRatio * tFreq;
      }
      typeDiversityScore = totalTypeWeights > 0 ? matchedTypeWeights / totalTypeWeights : 1.0;
    } else {
      const coveredTypes = new Set<QuestionType>();
      questions.forEach((q) => {
        if (q.type) coveredTypes.add(q.type);
      });
      const maxPossibleTypes = Math.min(this.poolTypes.size, this.targetQuestionCount);
      typeDiversityScore = maxPossibleTypes > 0
        ? Math.min(1.0, coveredTypes.size / maxPossibleTypes)
        : 1.0;
    }

    // D. Cognitive Level Diversity: ratio of distinct cognitive levels vs max achievable, OR alignment with cognitiveTargets
    let cognitiveDiversityScore = 1.0;
    const cogTargetKeys = this.cognitiveTargets ? Object.keys(this.cognitiveTargets) : [];
    if (cogTargetKeys.length > 0) {
      let matchedCogWeights = 0;
      let totalCogWeights = 0;
      for (const [tCog, tFreq] of Object.entries(this.cognitiveTargets!)) {
        totalCogWeights += tFreq;
        const matchingCount = questions.filter((q) => q.cognitiveLevel === tCog).length;
        const actualFreq = matchingCount / count;
        const matchRatio = tFreq > 0 ? Math.min(1.0, actualFreq / tFreq) : 1.0;
        matchedCogWeights += matchRatio * tFreq;
      }
      cognitiveDiversityScore = totalCogWeights > 0 ? matchedCogWeights / totalCogWeights : 1.0;
    } else {
      const coveredLevels = new Set<CognitiveLevel>();
      questions.forEach((q) => {
        if (q.cognitiveLevel) coveredLevels.add(q.cognitiveLevel);
      });
      const maxPossibleLevels = Math.min(this.poolCognitiveLevels.size, this.targetQuestionCount);
      cognitiveDiversityScore = maxPossibleLevels > 0
        ? Math.min(1.0, coveredLevels.size / maxPossibleLevels)
        : 1.0;
    }

    // E. Redundancy Penalty: penalize repeating concepts and over-clustering in a single subtopic
    const conceptCounts = new Map<string, number>();
    const subtopicCounts = new Map<string, number>();
    for (const q of questions) {
      conceptCounts.set(q.concept, (conceptCounts.get(q.concept) || 0) + 1);
      subtopicCounts.set(q.subtopic, (subtopicCounts.get(q.subtopic) || 0) + 1);
    }

    // Fraction of questions that have unique concepts
    const uniqueConceptsRatio = conceptCounts.size / count;

    // Balance across subtopics: calculate max proportion occupied by a single subtopic
    let maxSubtopicProportion = 1.0;
    if (this.poolSubtopics.size > 1) {
      const maxCount = Math.max(...Array.from(subtopicCounts.values()));
      maxSubtopicProportion = maxCount / count;
    } else {
      maxSubtopicProportion = 0; // If pool only has 1 subtopic, don't penalize concentration
    }

    // Redundancy score: higher is better (1.0 = zero concept duplicates, balanced distribution)
    const subtopicPenalty = this.poolSubtopics.size > 1 ? Math.max(0, maxSubtopicProportion - 0.5) : 0;
    const redundancyScore = Math.max(0, Math.min(1.0, (uniqueConceptsRatio * 0.7) + ((1.0 - subtopicPenalty) * 0.3)));

    // F. Estimated Completion Time
    let totalSeconds = 0;
    for (const q of questions) {
      const typeEstimate = this.timeEstimates[q.type] || 60;
      totalSeconds += typeEstimate;
    }
    // Expected average time is roughly 65s per question
    const idealTime = count * 65;
    const timeDeviation = Math.abs(totalSeconds - idealTime) / idealTime;
    const timeScore = Math.max(0, 1.0 - Math.min(1.0, timeDeviation * 0.5));

    // G. Skill Targets
    let skillScore = 1.0;
    const targetKeys = Object.keys(this.skillTargets);
    if (targetKeys.length > 0) {
      let matchedTargetWeights = 0;
      let totalTargetWeights = 0;

      for (const [targetSkill, targetFreq] of Object.entries(this.skillTargets)) {
        totalTargetWeights += targetFreq;
        const normalizedSkill = targetSkill.toLowerCase().trim();
        const matchingCount = questions.filter((q) =>
          Array.isArray(q.skills) && q.skills.some((s) => s.toLowerCase().includes(normalizedSkill))
        ).length;
        const actualFreq = matchingCount / count;
        // Reward match closeness up to target
        const matchRatio = targetFreq > 0 ? Math.min(1.0, actualFreq / targetFreq) : 1.0;
        matchedTargetWeights += matchRatio * targetFreq;
      }

      skillScore = totalTargetWeights > 0 ? matchedTargetWeights / totalTargetWeights : 1.0;
    }

    // Compute weighted total
    const totalWeights =
      this.weights.coverage +
      this.weights.difficulty +
      this.weights.typeDiversity +
      this.weights.cognitiveDiversity +
      this.weights.redundancy +
      this.weights.time +
      this.weights.skillTargets;

    const rawTotal =
      coverageScore * this.weights.coverage +
      difficultyScore * this.weights.difficulty +
      typeDiversityScore * this.weights.typeDiversity +
      cognitiveDiversityScore * this.weights.cognitiveDiversity +
      redundancyScore * this.weights.redundancy +
      timeScore * this.weights.time +
      skillScore * this.weights.skillTargets;

    const total = totalWeights > 0 ? Number((rawTotal / totalWeights).toFixed(4)) : 0;

    return {
      total,
      breakdown: {
        coverage: Number(coverageScore.toFixed(4)),
        difficulty: Number(difficultyScore.toFixed(4)),
        typeDiversity: Number(typeDiversityScore.toFixed(4)),
        cognitiveDiversity: Number(cognitiveDiversityScore.toFixed(4)),
        redundancy: Number(redundancyScore.toFixed(4)),
        time: Number(timeScore.toFixed(4)),
        skillTargets: Number(skillScore.toFixed(4)),
      },
    };
  }

  /**
   * Generates a single valid chromosome of length targetQuestionCount without duplicates.
   */
  public generateChromosome(): Chromosome {
    const allIds = this.validQuestions.map((q) => q.id!);
    // Fisher-Yates partial shuffle
    const shuffled = [...allIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, this.targetQuestionCount);
  }

  /**
   * Generates initial population of unique chromosomes.
   */
  public generateInitialPopulation(): Individual[] {
    const population: Individual[] = [];
    const seen = new Set<string>();

    let attempts = 0;
    const maxAttempts = this.config.populationSize * 10;

    while (population.length < this.config.populationSize && attempts < maxAttempts) {
      attempts++;
      const chrom = this.generateChromosome();
      const key = [...chrom].sort().join('|');

      if (!seen.has(key)) {
        seen.add(key);
        population.push({
          chromosome: chrom,
          fitness: this.evaluateFitness(chrom),
        });
      }
    }

    // If populationSize exceeds distinct combinations, fill remaining
    while (population.length < this.config.populationSize) {
      const chrom = this.generateChromosome();
      population.push({
        chromosome: chrom,
        fitness: this.evaluateFitness(chrom),
      });
    }

    return population;
  }

  /**
   * Tournament selection.
   */
  public tournamentSelect(population: Individual[]): Individual {
    let best = population[Math.floor(this.random() * population.length)];

    for (let i = 1; i < this.config.tournamentSize; i++) {
      const candidate = population[Math.floor(this.random() * population.length)];
      if (candidate.fitness.total > best.fitness.total) {
        best = candidate;
      }
    }

    return best;
  }

  /**
   * Order/Set Crossover between two parents with duplicate repair.
   * Guarantees length == targetQuestionCount, no duplicate IDs, and valid pool IDs only.
   */
  public crossover(parentA: Chromosome, parentB: Chromosome): Chromosome {
    if (this.random() > this.config.crossoverRate) {
      return [...parentA];
    }

    const cutPoint = Math.max(1, Math.floor(this.random() * (this.targetQuestionCount - 1)));
    const childSet = new Set<string | number>();
    const child: Chromosome = [];

    // Take first slice from parent A
    for (let i = 0; i < cutPoint; i++) {
      child.push(parentA[i]);
      childSet.add(parentA[i]);
    }

    // Fill from parent B avoiding duplicates
    for (const gene of parentB) {
      if (!childSet.has(gene) && child.length < this.targetQuestionCount) {
        child.push(gene);
        childSet.add(gene);
      }
    }

    // Repair if child length is less than targetQuestionCount
    if (child.length < this.targetQuestionCount) {
      const allIds = this.validQuestions.map((q) => q.id!);
      const unused = allIds.filter((id) => !childSet.has(id));

      // Shuffle unused
      for (let i = unused.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [unused[i], unused[j]] = [unused[j], unused[i]];
      }

      for (const id of unused) {
        if (child.length >= this.targetQuestionCount) break;
        child.push(id);
        childSet.add(id);
      }
    }

    return child;
  }

  /**
   * Mutation: Replaces a gene with an unused valid question from the pool.
   * Guarantees length and uniqueness.
   */
  public mutate(chromosome: Chromosome): Chromosome {
    if (this.random() > this.config.mutationRate) {
      return chromosome;
    }

    const mutated = [...chromosome];
    const presentSet = new Set(mutated);
    const availablePool = this.validQuestions
      .map((q) => q.id!)
      .filter((id) => !presentSet.has(id));

    if (availablePool.length === 0) {
      return mutated;
    }

    // Pick random index to replace
    const replaceIdx = Math.floor(this.random() * mutated.length);
    const randomPoolIdx = Math.floor(this.random() * availablePool.length);
    mutated[replaceIdx] = availablePool[randomPoolIdx];

    return mutated;
  }

  /**
   * Runs the complete Genetic Algorithm optimization.
   */
  public optimize(): {
    best: Individual;
    generationsRun: number;
    initialFitness: number;
    finalFitness: number;
  } {
    if (this.validQuestions.length < this.targetQuestionCount) {
      throw new Error('Not enough valid questions to build the requested assessment.');
    }

    let population = this.generateInitialPopulation();

    // Sort descending by fitness
    population.sort((a, b) => b.fitness.total - a.fitness.total);

    let bestIndividual = population[0];
    const initialFitness = bestIndividual.fitness.total;
    let stagnationCount = 0;
    let generationsRun = 0;

    for (let gen = 0; gen < this.config.generations; gen++) {
      generationsRun++;

      // 1. Elitism: preserve top N
      const nextGen: Individual[] = [];
      for (let e = 0; e < this.config.elitismCount && e < population.length; e++) {
        nextGen.push(population[e]);
      }

      // 2. Generate offspring
      while (nextGen.length < this.config.populationSize) {
        const parent1 = this.tournamentSelect(population);
        const parent2 = this.tournamentSelect(population);

        let childChrom = this.crossover(parent1.chromosome, parent2.chromosome);
        childChrom = this.mutate(childChrom);

        nextGen.push({
          chromosome: childChrom,
          fitness: this.evaluateFitness(childChrom),
        });
      }

      population = nextGen;
      population.sort((a, b) => b.fitness.total - a.fitness.total);

      // Check improvement for early stopping
      if (population[0].fitness.total > bestIndividual.fitness.total) {
        bestIndividual = population[0];
        stagnationCount = 0;
      } else {
        stagnationCount++;
      }

      if (this.config.stagnationLimit && stagnationCount >= this.config.stagnationLimit) {
        break;
      }
    }

    return {
      best: bestIndividual,
      generationsRun,
      initialFitness,
      finalFitness: bestIndividual.fitness.total,
    };
  }
}
