import { TopicAnalysisResult, StructuredTopic, ClarificationRequired, InvalidTopic } from '../types/topic';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and sanitizes raw JSON output received from an LLM.
 * Ensures the response strictly conforms to TopicAnalysisResult without trusting arbitrary LLM output.
 */
export function validateTopicAnalysisOutput(raw: unknown): TopicAnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('LLM response must be a valid JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  // Check status
  if (!obj.status || typeof obj.status !== 'string') {
    throw new ValidationError('Missing or invalid "status" field in LLM response.');
  }

  const status = obj.status.trim().toLowerCase();

  if (status === 'success') {
    if (typeof obj.field !== 'string' || obj.field.trim().length === 0) {
      throw new ValidationError('"field" must be a non-empty string for successful analysis.');
    }
    if (typeof obj.domain !== 'string' || obj.domain.trim().length === 0) {
      throw new ValidationError('"domain" must be a non-empty string for successful analysis.');
    }
    if (typeof obj.topic !== 'string' || obj.topic.trim().length === 0) {
      throw new ValidationError('"topic" must be a non-empty string for successful analysis.');
    }
    if (!Array.isArray(obj.subtopics)) {
      throw new ValidationError('"subtopics" must be an array for successful analysis.');
    }

    const subtopics = obj.subtopics.map((item, index) => {
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw new ValidationError(`Subtopic at index ${index} must be a non-empty string.`);
      }
      return item.trim();
    });

    const validated: StructuredTopic = {
      status: 'success',
      field: obj.field.trim(),
      domain: obj.domain.trim(),
      topic: obj.topic.trim(),
      subtopics,
    };
    return validated;
  }

  if (status === 'clarification_required') {
    if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
      throw new ValidationError('"message" must be a non-empty string for clarification_required.');
    }
    if (!Array.isArray(obj.options)) {
      throw new ValidationError('"options" must be an array for clarification_required.');
    }

    const options = obj.options.map((item, index) => {
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw new ValidationError(`Option at index ${index} must be a non-empty string.`);
      }
      return item.trim();
    });

    const validated: ClarificationRequired = {
      status: 'clarification_required',
      message: obj.message.trim(),
      options,
    };
    return validated;
  }

  if (status === 'invalid') {
    if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
      throw new ValidationError('"message" must be a non-empty string for invalid status.');
    }

    const validated: InvalidTopic = {
      status: 'invalid',
      message: obj.message.trim(),
    };
    return validated;
  }

  throw new ValidationError(`Unsupported status "${obj.status}". Expected "success", "clarification_required", or "invalid".`);
}
