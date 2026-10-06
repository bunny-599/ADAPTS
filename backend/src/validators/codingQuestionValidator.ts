import { CodingQuestion, CodingTestCase } from '../types/question';

export interface CodingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class CodingQuestionValidator {
  private static readonly SUPPORTED_LANGUAGES = new Set(['cpp']);
  private static readonly FORBIDDEN_SHELL_PATTERNS = [
    /rm\s+-rf/i,
    /mkfs/i,
    /curl\s+/i,
    /wget\s+/i,
    /nc\s+-/i,
    /bash\s+-c/i,
    /\/bin\/sh/i,
    /chmod\s+/i,
  ];

  /**
   * Performs deterministic structural validation of a coding question.
   */
  public static validate(question: Partial<CodingQuestion>): CodingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic Question Metadata
    if (!question.question || question.question.trim().length === 0) {
      errors.push('Question text is required.');
    }

    if (question.type !== 'CODING') {
      errors.push(`Expected question type "CODING", received "${question.type}".`);
    }

    const language = (question.language || 'cpp').toLowerCase();
    if (!this.SUPPORTED_LANGUAGES.has(language)) {
      errors.push(`Unsupported language "${question.language}". Only C++ is currently supported.`);
    }

    if (!question.starterCode || question.starterCode.trim().length === 0) {
      warnings.push('Starter code is missing or empty.');
    }

    if (!question.constraints || question.constraints.trim().length === 0) {
      warnings.push('Constraints are missing.');
    }

    // 2. Test Cases Validation
    const testCases = question.testCases;
    if (!Array.isArray(testCases) || testCases.length === 0) {
      errors.push('At least one test case is required for a coding question.');
    } else {
      const seenInputs = new Set<string>();

      testCases.forEach((tc: CodingTestCase, index: number) => {
        const testCaseRef = `Test case #${index + 1}`;

        if (tc.input === undefined || tc.input === null) {
          errors.push(`${testCaseRef}: "input" must be provided.`);
        }

        if (tc.expectedOutput === undefined || tc.expectedOutput === null) {
          errors.push(`${testCaseRef}: "expectedOutput" must be provided.`);
        }

        if (tc.weight !== undefined && (typeof tc.weight !== 'number' || tc.weight <= 0 || isNaN(tc.weight))) {
          errors.push(`${testCaseRef}: "weight" must be a positive number.`);
        }

        // Security check: test cases must be pure data, never shell instructions
        const combinedData = `${tc.input || ''} ${tc.expectedOutput || ''}`;
        for (const pattern of this.FORBIDDEN_SHELL_PATTERNS) {
          if (pattern.test(combinedData)) {
            errors.push(`${testCaseRef}: Contains suspicious shell command pattern.`);
            break;
          }
        }

        // Duplicate test input detection
        const normalizedInput = (tc.input || '').trim();
        if (seenInputs.has(normalizedInput)) {
          warnings.push(`${testCaseRef}: Has identical input to another test case.`);
        } else {
          seenInputs.add(normalizedInput);
        }
      });
    }

    // 3. Skills Validation
    if (!Array.isArray(question.skills) || question.skills.length === 0) {
      warnings.push('No skills assigned to coding question.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
