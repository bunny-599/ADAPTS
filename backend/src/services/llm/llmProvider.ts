export interface LLMResponse {
  rawText: string;
}

export interface ILLMProvider {
  /**
   * Generates a structured response from the LLM based on system instructions and user input.
   * Returns parsed JSON or throws an error.
   */
  generateStructuredResponse(systemPrompt: string, userPrompt: string): Promise<unknown>;

  /**
   * Checks if the LLM provider is properly configured with an API key.
   */
  isConfigured?(): boolean;
}

