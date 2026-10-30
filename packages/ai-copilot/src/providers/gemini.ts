import type { HealthCheckResult } from '../types.js';
import { BaseAIProvider } from './base.js';

export class GeminiProvider extends BaseAIProvider {
  name = 'gemini';
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

  constructor(apiKey: string) {
    super();
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('GEMINI_API_KEY is required but not provided');
    }
    this.apiKey = apiKey;
  }

  async available(): Promise<boolean> {
    try {
      const { status } = await this.healthCheck();
      return status === 'ok';
    } catch (error) {
      this.log.debug({ error }, 'Gemini provider not available');
      return false;
    }
  }

  async analyze(prompt: string, temperature: number): Promise<string> {
    return this.retry(async () => {
      const start = Date.now();

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: 2000,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_UNSPECIFIED',
              threshold: 'BLOCK_NONE',
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        const message = `HTTP ${response.status}: ${error}`;
        throw new Error(message);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        error?: {
          message?: string;
        };
      };

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No text content in Gemini response');
      }

      const latency = Date.now() - start;
      this.log.info({ latency }, 'Gemini analysis completed');
      return text;
    });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Test' }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
        }),
      });

      const latency = Date.now() - start;

      if (!response.ok) {
        return {
          status: 'error',
          latencyMs: latency,
          message: `HTTP ${response.status}`,
        };
      }

      return {
        status: 'ok',
        latencyMs: latency,
        message: 'Gemini API responsive',
      };
    } catch (error) {
      const latency = Date.now() - start;
      return {
        status: 'error',
        latencyMs: latency,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
