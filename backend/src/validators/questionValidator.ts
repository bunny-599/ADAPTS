import { Question, QuestionType, CognitiveLevel } from '../types/question';

export class QuestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionValidationError';
  }
}

const VALID_TYPES: QuestionType[] = [
  'MCQ',
  'OUTPUT_PREDICTION',
  'CONCEPTUAL',
  'DEBUGGING',
  'SCENARIO',
  'CODING',
];

const VALID_COGNITIVE_LEVELS: CognitiveLevel[] = [
  'remember',
  'understand',
  'apply',
  'analyze',
];

/**
 * Normalizes question text for duplicate detection
 */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basic structural validation layer for generated questions (Trial 5).
 * Validates types, required fields, difficulty ranges, options formatting, and source references.
 */
export function validateQuestion(raw: unknown, index: number = 0): Question {
  if (!raw || typeof raw !== 'object') {
    throw new QuestionValidationError(`Question at index ${index} must be an object.`);
  }

  const q = raw as Record<string, unknown>;

  // 1. Question Type
  if (!q.type || typeof q.type !== 'string' || !VALID_TYPES.includes(q.type as QuestionType)) {
    throw new QuestionValidationError(
      `Question at index ${index} has invalid or missing type "${q.type}". Must be one of: ${VALID_TYPES.join(', ')}`
    );
  }
  const type = q.type as QuestionType;

  // 2. Question Text
  if (typeof q.question !== 'string' || q.question.trim().length === 0) {
    throw new QuestionValidationError(`Question at index ${index} is missing question text.`);
  }

  // 3. Correct Answer
  if (typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length === 0) {
    throw new QuestionValidationError(`Question at index ${index} is missing correctAnswer.`);
  }

  // 4. Difficulty (continuous 0.0 to 1.0)
  const diff = Number(q.difficulty);
  if (isNaN(diff) || diff < 0.0 || diff > 1.0) {
    throw new QuestionValidationError(
      `Question at index ${index} has invalid difficulty "${q.difficulty}". Must be a continuous number between 0.0 and 1.0.`
    );
  }

  // 5. Concept & Subtopic
  if (typeof q.concept !== 'string' || q.concept.trim().length === 0) {
    throw new QuestionValidationError(`Question at index ${index} is missing concept.`);
  }
  if (typeof q.subtopic !== 'string' || q.subtopic.trim().length === 0) {
    throw new QuestionValidationError(`Question at index ${index} is missing subtopic.`);
  }

  // 6. Source References
  if (!Array.isArray(q.sourceReferences) || q.sourceReferences.length === 0) {
    throw new QuestionValidationError(
      `Question at index ${index} must have a non-empty sourceReferences array.`
    );
  }
  const sourceReferences = q.sourceReferences.map((s) => String(s).trim());

  // 7. Explanation
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';

  // 8. Skills
  const skills = Array.isArray(q.skills)
    ? q.skills.map((s) => String(s).trim())
    : [q.concept.trim()];

  // 9. Cognitive Level
  const cog =
    typeof q.cognitiveLevel === 'string' &&
    VALID_COGNITIVE_LEVELS.includes(q.cognitiveLevel.toLowerCase() as CognitiveLevel)
      ? (q.cognitiveLevel.toLowerCase() as CognitiveLevel)
      : 'understand';

  // 10. MCQ Specific validation: Exactly 4 options, correctAnswer must match one option
  if (type === 'MCQ') {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new QuestionValidationError(
        `MCQ question at index ${index} must have exactly 4 options.`
      );
    }

    const options = q.options.map((opt) => String(opt).trim()) as [string, string, string, string];
    const match = options.some(
      (opt) => opt.toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
    );

    if (!match) {
      throw new QuestionValidationError(
        `MCQ question at index ${index} correctAnswer "${q.correctAnswer}" does not match any of the 4 options: [${options.join(', ')}]`
      );
    }

    return {
      type: 'MCQ',
      question: q.question.trim(),
      options,
      correctAnswer: q.correctAnswer.trim(),
      explanation,
      difficulty: Number(diff.toFixed(3)),
      concept: q.concept.trim(),
      subtopic: q.subtopic.trim(),
      skills,
      cognitiveLevel: cog,
      sourceReferences,
    };
  }

  // 11. Handle CODING type
  if (type === 'CODING') {
    return {
      type: 'CODING',
      language: 'cpp',
      question: q.question.trim(),
      options: undefined,
      correctAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : 'Correct C++ solution',
      explanation,
      difficulty: Number(diff.toFixed(3)),
      concept: q.concept.trim(),
      id: q.id !== undefined && q.id !== null ? q.id as any : undefined,
      subtopic: q.subtopic.trim(),
      skills,
      cognitiveLevel: cog,
      sourceReferences,
      starterCode: typeof q.starterCode === 'string' ? q.starterCode : undefined,
      constraints: typeof q.constraints === 'string' ? q.constraints : undefined,
      expectedComplexity: q.expectedComplexity as any,
      testCases: Array.isArray(q.testCases) ? (q.testCases as any) : undefined,
    };
  }

  // 12. Handle other types with optional codeSnippet/scenarioText/options
  const codeSnippet = typeof q.codeSnippet === 'string' ? q.codeSnippet.trim() : undefined;
  const scenarioText = typeof q.scenarioText === 'string' ? q.scenarioText.trim() : undefined;
  const options =
    Array.isArray(q.options) && q.options.length === 4
      ? (q.options.map((opt) => String(opt).trim()) as [string, string, string, string])
      : undefined;

  return {
    id: q.id !== undefined && q.id !== null ? q.id as any : undefined,
    type,
    question: q.question.trim(),
    options,
    codeSnippet,
    scenarioText,
    correctAnswer: q.correctAnswer.trim(),
    explanation,
    difficulty: Number(diff.toFixed(3)),
    concept: q.concept.trim(),
    subtopic: q.subtopic.trim(),
    skills,
    cognitiveLevel: cog,
    sourceReferences,
  };
}

/**
 * Validates and deduplicates a batch of questions
 */
export function validateAndDeduplicateQuestions(rawList: unknown[]): Question[] {
  if (!Array.isArray(rawList)) {
    throw new QuestionValidationError('Questions must be an array.');
  }

  const validQuestions: Question[] = [];
  const seenTexts = new Set<string>();

  for (let i = 0; i < rawList.length; i++) {
    try {
      const q = validateQuestion(rawList[i], i);
      const normalized = normalizeQuestionText(q.question);

      if (!seenTexts.has(normalized)) {
        seenTexts.add(normalized);
        validQuestions.push(q);
      }
    } catch (err: any) {
      console.warn(`Question validation warning for item #${i}: ${err.message}`);
    }
  }

  return validQuestions;
}
