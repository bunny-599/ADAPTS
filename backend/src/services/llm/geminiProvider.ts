import { GoogleGenAI } from '@google/genai';
import { ILLMProvider } from './llmProvider';

export class GeminiProvider implements ILLMProvider {
  private ai: GoogleGenAI | null = null;
  private modelName: string;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key && key.trim().length > 0) {
      this.ai = new GoogleGenAI({ apiKey: key.trim() });
    }
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  }

  public isConfigured(): boolean {
    return this.ai !== null;
  }

  public async generateStructuredResponse(systemPrompt: string, userPrompt: string): Promise<unknown> {
    if (!this.ai) {
      throw new Error(
        'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in backend/.env'
      );
    }

    const candidateModels = [
      this.modelName,

      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('LLM returned an empty response.');
        }

        try {
          return JSON.parse(responseText);
        } catch (parseError: any) {
          throw new Error(`Failed to parse LLM response as JSON: ${parseError.message}`);
        }
      } catch (error: any) {
        lastError = error;
        // If temporary high demand (503) or not found (404), try fallback model
        const errorMsg = error?.message || '';
        const isUnavailable =
          error?.status === 503 ||
          errorMsg.includes('503') ||
          error?.status === 404 ||
          errorMsg.includes('404') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('high demand') ||
          errorMsg.includes('RESOURCE_EXHAUSTED');
        if (isUnavailable) {
          console.warn(`[GeminiProvider] Model ${model} unavailable (${errorMsg.substring(0, 100)}...), trying fallback...`);
          continue;
        }
        if (error?.message?.includes('API_KEY_INVALID') || error?.status === 400) {
          throw new Error('Gemini API authentication failed. Please verify your GEMINI_API_KEY.');
        }
        throw error;
      }
    }

    throw lastError || new Error('All candidate Gemini models failed.');
  }
}
