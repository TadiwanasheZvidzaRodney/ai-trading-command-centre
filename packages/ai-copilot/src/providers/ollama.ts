import type { HealthCheckResult } from '../types.js';
import { BaseAIProvider } from './base.js';

export class OllamaProvider extends BaseAIProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'mistral') {
    super();
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async available(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = (await response.json()) as {
        models?: Array<{ name?: string }>;
      };

      if (!Array.isArray(data.models)) return false;

      return data.models.some(m => m.name?.startsWith(this.model));
    } catch (error) {
      this.log.debug({ error }, 'Ollama provider not available');
      return false;
    }
  }

  async analyze(prompt: string, temperature: number): Promise<string> {
    return this.retry(async () => {
      const start = Date.now();

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          temperature,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        response?: string;
      };

      if (!data.response) {
        throw new Error('No response from Ollama');
      }

      const latency = Date.now() - start;
      this.log.info({ latency }, 'Ollama analysis completed');
      return data.response;
    });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
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
        message: 'Ollama API responsive',
      };
    } catch (error) {
      const latency = Date.now() - start;
      return {
        status: 'error',
        latencyMs: latency,
        message: error instanceof Error ? error.message : 'Connection refused',
      };
    }
  }
}
