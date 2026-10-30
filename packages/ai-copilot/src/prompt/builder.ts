import pino from 'pino';
import type { Evidence } from '../types.js';
import { ANALYSIS_PROMPT_TEMPLATE, SYSTEM_PROMPT } from './templates.js';

const logger = pino();

export class PromptBuilder {
  private systemPrompt = SYSTEM_PROMPT;
  private dataStartMarker = '[DATA START]';
  private dataEndMarker = '[DATA END]';
  private maxPromptTokens = 4000;
  private charsPerToken = 4; // Rough estimate

  buildAnalysisPrompt(evidence: Evidence): string {
    try {
      // Serialize evidence to JSON with safe formatting
      const evidenceJson = JSON.stringify(evidence, null, 2);

      // Build prompt using template
      const prompt = ANALYSIS_PROMPT_TEMPLATE(this.systemPrompt, evidenceJson);

      // Validate prompt length
      const estimatedTokens = Math.ceil(prompt.length / this.charsPerToken);

      if (estimatedTokens > this.maxPromptTokens) {
        throw new Error(
          `Prompt too long: ${estimatedTokens} tokens > ${this.maxPromptTokens} token limit`
        );
      }

      return prompt;
    } catch (error) {
      logger.error({ error }, 'Failed to build analysis prompt');
      throw error;
    }
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  getDataMarkers(): { start: string; end: string } {
    return {
      start: this.dataStartMarker,
      end: this.dataEndMarker,
    };
  }
}
